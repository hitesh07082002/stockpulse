import hashlib
import json
import uuid
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
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
from .models import AIBudgetDay, AIUsageCounter, Company
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


@dataclass
class BudgetReservation:
    day: date
    amount_usd: Decimal


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
    budget = None
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
        reservation_amount = provider.estimate_reservation_usd(
            json.dumps({"system": system_prompt, "conversation": conversation}, sort_keys=True)
        )
        budget = reserve_budget(reservation_amount)
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
        if budget is not None:
            reconcile_budget(budget, Decimal("0.0000"))
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
            budget=budget,
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


@transaction.atomic
def reserve_budget(amount_usd):
    amount = Decimal(amount_usd)
    budget_day, _created = AIBudgetDay.objects.select_for_update().get_or_create(
        day=current_ai_day(),
        defaults={
            "request_count": 0,
            "reserved_cost_usd": Decimal("0.0000"),
            "actual_cost_usd": Decimal("0.0000"),
        },
    )

    current_total = Decimal(budget_day.actual_cost_usd) + Decimal(budget_day.reserved_cost_usd)
    if current_total + amount > settings.AI_DAILY_BUDGET_USD:
        if budget_day.hard_stop_triggered_at is None:
            budget_day.hard_stop_triggered_at = timezone.now()
            budget_day.save(update_fields=["hard_stop_triggered_at", "updated_at"])
        raise CopilotRequestError(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            code="budget_exhausted",
            message="The AI copilot is over today's budget. Please try again tomorrow.",
        )

    budget_day.request_count += 1
    budget_day.reserved_cost_usd = Decimal(budget_day.reserved_cost_usd) + amount
    budget_day.save(update_fields=["request_count", "reserved_cost_usd", "updated_at"])
    return BudgetReservation(day=budget_day.day, amount_usd=amount)


@transaction.atomic
def reconcile_budget(budget, actual_cost_usd):
    budget_day = AIBudgetDay.objects.select_for_update().get(day=budget.day)
    actual = Decimal(actual_cost_usd)
    budget_day.reserved_cost_usd = max(
        Decimal("0.0000"),
        Decimal(budget_day.reserved_cost_usd) - Decimal(budget.amount_usd),
    )
    budget_day.actual_cost_usd = Decimal(budget_day.actual_cost_usd) + actual
    if budget_day.actual_cost_usd >= settings.AI_DAILY_BUDGET_USD and budget_day.hard_stop_triggered_at is None:
        budget_day.hard_stop_triggered_at = timezone.now()
    budget_day.save(
        update_fields=[
            "reserved_cost_usd",
            "actual_cost_usd",
            "hard_stop_triggered_at",
            "updated_at",
        ]
    )


def _stream_copilot_events(*, provider, budget, conversation, company, identity, meta_payload, system_prompt):
    usage = None
    actual_cost = Decimal("0.0000")
    streamed_text = False
    try:
        yield _sse_event("meta", meta_payload)
        for event in provider.stream_response(system_prompt=system_prompt, conversation=conversation):
            if event.type == "text" and event.text:
                streamed_text = True
                yield _sse_event("text", {"content": event.text})
            elif event.type == "usage":
                usage = event.usage

        actual_cost = provider.calculate_actual_cost_usd(usage)
        reconcile_budget(budget, actual_cost)
        yield _sse_event(
            "done",
            {
                "remaining_quota": identity.remaining,
                "provider": provider.name,
                "ticker": company.ticker,
            },
        )
    except ProviderTimeoutError:
        actual_cost = provider.calculate_actual_cost_usd(usage)
        reconcile_budget(budget, actual_cost)
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
        actual_cost = provider.calculate_actual_cost_usd(usage)
        reconcile_budget(budget, actual_cost)
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
        actual_cost = provider.calculate_actual_cost_usd(usage)
        reconcile_budget(budget, actual_cost)
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
        actual_cost = provider.calculate_actual_cost_usd(usage)
        reconcile_budget(budget, actual_cost)
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
