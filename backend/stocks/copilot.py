import hashlib
import json
import uuid
from dataclasses import dataclass
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core import signing
from django.db import transaction
from django.http import StreamingHttpResponse
from django.utils import timezone
from django_ratelimit.core import is_ratelimited
from rest_framework import status
from rest_framework.exceptions import ParseError, ValidationError
from rest_framework.response import Response

from .ai_context import build_stream_meta, build_structured_context, render_system_prompt
from .ai_providers import (
    ProviderResponseError,
    ProviderTimeoutError,
    ProviderUnavailableError,
    get_ai_provider,
)
from .models import AIUsageCounter, Company
from .serializers import ChatMessageSerializer


NEW_YORK = ZoneInfo("America/New_York")
ANON_COOKIE_SALT = "stocks.ai.anon"


@dataclass
class IdentityReservation:
    usage_key_hash: str
    user_id: int | None
    limit: int
    used: int
    remaining: int
    cookie_value: str | None = None


class CopilotRequestError(Exception):
    def __init__(self, *, status_code, code, message, extra=None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.extra = extra or {}

    def to_response(self):
        payload = {
            "code": self.code,
            "error": self.message,
            "message": self.message,
        }
        payload.update(self.extra)
        return Response(payload, status=self.status_code)


def build_copilot_response(request, ticker):
    identity = resolve_identity_reservation(request)
    try:
        serializer = _validated_payload(request)
        company = _get_company_or_error(ticker)
        provider = get_ai_provider()
        provider.ensure_configured()
        _enforce_burst_limit(request)

        context = build_structured_context(company)
        system_prompt = render_system_prompt(context)
        conversation = list(serializer.validated_data.get("history", []))
        conversation.append({"role": "user", "content": serializer.validated_data["message"]})
        identity = reserve_daily_quota(identity)
    except ProviderUnavailableError as exc:
        response = Response(
            {
                "code": "provider_unavailable",
                "error": str(exc),
                "message": str(exc),
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
        maybe_set_anon_cookie(response, identity.cookie_value)
        return response
    except CopilotRequestError as exc:
        response = exc.to_response()
        maybe_set_anon_cookie(response, identity.cookie_value)
        return response

    meta_payload = build_stream_meta(
        company,
        context,
        remaining_daily_quota=identity.remaining,
    )

    response = StreamingHttpResponse(
        _stream_copilot_events(
            provider=provider,
            conversation=conversation,
            company=company,
            identity=identity,
            meta_payload=meta_payload,
            system_prompt=system_prompt,
        ),
        content_type="text/event-stream",
    )
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    maybe_set_anon_cookie(response, identity.cookie_value)
    return response


def resolve_identity_reservation(request):
    if getattr(request, "user", None) and request.user.is_authenticated:
        usage_key = f"user:{request.user.pk}"
        return IdentityReservation(
            usage_key_hash=_hash_usage_key(usage_key),
            user_id=request.user.pk,
            limit=settings.AI_DAILY_LIMIT_AUTHENTICATED,
            used=0,
            remaining=settings.AI_DAILY_LIMIT_AUTHENTICATED,
        )

    anon_id, cookie_value = _read_or_issue_anon_id(request)
    usage_key = f"anon:{anon_id}"
    return IdentityReservation(
        usage_key_hash=_hash_usage_key(usage_key),
        user_id=None,
        limit=settings.AI_DAILY_LIMIT_ANONYMOUS,
        used=0,
        remaining=settings.AI_DAILY_LIMIT_ANONYMOUS,
        cookie_value=cookie_value,
    )


@transaction.atomic
def reserve_daily_quota(identity):
    counter, _created = AIUsageCounter.objects.select_for_update().get_or_create(
        usage_key_hash=identity.usage_key_hash,
        day=current_ai_day(),
        defaults={
            "user_id": identity.user_id,
            "request_count": 0,
        },
    )
    if counter.request_count >= identity.limit:
        used = counter.request_count
        is_anonymous = identity.user_id is None
        raise CopilotRequestError(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            code="daily_limit_reached",
            message=(
                f"You've used {identity.limit}/{identity.limit} free prompts today. Sign in for "
                f"{settings.AI_DAILY_LIMIT_AUTHENTICATED} daily prompts."
                if is_anonymous
                else f"You've used {identity.limit}/{identity.limit} prompts today. Try again tomorrow."
            ),
            extra={
                "limit": identity.limit,
                "used": used,
                "remaining": 0,
                "needs_auth_upgrade": is_anonymous,
            },
        )

    counter.request_count += 1
    counter.user_id = identity.user_id
    counter.save(update_fields=["request_count", "user", "updated_at"])
    identity.used = counter.request_count
    identity.remaining = max(identity.limit - counter.request_count, 0)
    return identity


def _stream_copilot_events(*, provider, conversation, company, identity, meta_payload, system_prompt):
    streamed_text = False
    try:
        yield _sse_event("meta", meta_payload)
        for event in provider.stream_response(system_prompt=system_prompt, conversation=conversation):
            if event.type == "text" and event.text:
                streamed_text = True
                yield _sse_event("text", {"content": event.text})

        yield _sse_event(
            "done",
            {
                "remaining_quota": identity.remaining,
                "provider": provider.name,
                "ticker": company.ticker,
            },
        )
    except ProviderTimeoutError:
        yield _sse_event(
            "error",
            {
                "code": "provider_timeout",
                "message": "The AI copilot timed out. Please try again.",
                "partial": streamed_text,
                "remaining_quota": identity.remaining,
            },
        )
    except (ProviderResponseError, ProviderUnavailableError):
        yield _sse_event(
            "error",
            {
                "code": "provider_unavailable",
                "message": "The AI copilot is temporarily unavailable. Please try again shortly.",
                "partial": streamed_text,
                "remaining_quota": identity.remaining,
            },
        )
    except Exception:
        yield _sse_event(
            "error",
            {
                "code": "internal_error",
                "message": "Something went wrong while generating the answer. Please try again.",
                "partial": streamed_text,
                "remaining_quota": identity.remaining,
            },
        )
    except GeneratorExit:
        raise


def maybe_set_anon_cookie(response, cookie_value):
    if not cookie_value:
        return
    response.set_cookie(
        settings.AI_ANON_COOKIE,
        cookie_value,
        max_age=settings.AI_ANON_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="Lax",
        path="/",
    )


def current_ai_day():
    return timezone.now().astimezone(NEW_YORK).date()


def _validated_payload(request):
    try:
        serializer = ChatMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return serializer
    except ParseError as exc:
        raise CopilotRequestError(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="invalid_json",
            message="Invalid JSON request body.",
        ) from exc
    except ValidationError as exc:
        detail = getattr(exc, "detail", None)
        message = "Message is required."
        if isinstance(detail, dict):
            first_error = next(iter(detail.values()))
            message = str(first_error[0] if isinstance(first_error, list) else first_error)
        elif isinstance(detail, list) and detail:
            message = str(detail[0])
        raise CopilotRequestError(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="invalid_request",
            message=message,
        ) from exc


def _get_company_or_error(ticker):
    company = Company.objects.filter(ticker=ticker.upper()).first()
    if company is None:
        raise CopilotRequestError(
            status_code=status.HTTP_404_NOT_FOUND,
            code="unknown_ticker",
            message=f"Company {ticker.upper()} not found.",
        )
    return company


def _enforce_burst_limit(request):
    rate = f"{settings.AI_BURST_LIMIT_PER_MINUTE}/m"
    limited = is_ratelimited(
        request=request,
        group="stocks-copilot",
        key="ip",
        rate=rate,
        increment=True,
    )
    if limited:
        raise CopilotRequestError(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            code="burst_limit_reached",
            message="You're sending prompts too quickly. Please wait a minute and try again.",
        )


def _read_or_issue_anon_id(request):
    signer = signing.TimestampSigner(salt=ANON_COOKIE_SALT)
    raw_cookie = request.COOKIES.get(settings.AI_ANON_COOKIE)
    max_age_seconds = settings.AI_ANON_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60

    if raw_cookie:
        try:
            anon_id = signer.unsign(raw_cookie, max_age=max_age_seconds)
            return anon_id, None
        except signing.BadSignature:
            pass
        except signing.SignatureExpired:
            pass

    anon_id = str(uuid.uuid4())
    return anon_id, signer.sign(anon_id)


def _hash_usage_key(raw_key):
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def _sse_event(event_type, payload):
    data = {"type": event_type}
    data.update(payload)
    return f"data: {json.dumps(data)}\n\n"
