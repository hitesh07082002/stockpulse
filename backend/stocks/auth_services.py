from __future__ import annotations

import logging
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import requests
from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialAccount
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.db import IntegrityError, transaction
from django.core.mail import EmailMultiAlternatives
from django.core import signing
from django.template.loader import render_to_string
from django.urls import reverse
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.text import slugify
from rest_framework_simplejwt.tokens import RefreshToken


GOOGLE_STATE_SALT = "stocks.auth.google"
PASSWORD_RESET_TOKEN_GENERATOR = PasswordResetTokenGenerator()
EMAIL_VERIFICATION_TOKEN_GENERATOR = PasswordResetTokenGenerator()
logger = logging.getLogger(__name__)


class GoogleOAuthError(Exception):
    pass


class AmbiguousEmailError(Exception):
    pass


class EmailConflictError(Exception):
    pass


def _default_port_for_scheme(scheme: str) -> int | None:
    if scheme == "https":
        return 443
    if scheme == "http":
        return 80
    return None


def _port_for_origin(parsed) -> int | None:
    return parsed.port or _default_port_for_scheme(parsed.scheme)


def _is_loopback_host(hostname: str | None) -> bool:
    return hostname in {"localhost", "127.0.0.1", "::1"}


def _clean_name_parts(name: str) -> tuple[str, str]:
    words = [part for part in (name or "").strip().split() if part]
    if not words:
        return "", ""
    if len(words) == 1:
        return words[0], ""
    return words[0], " ".join(words[1:])


def _normalize_email(email: str | None) -> str:
    return (email or "").strip().lower()


def sync_email_address(user, email: str | None = None, *, verified: bool = False):
    normalized_email = _normalize_email(email or getattr(user, "email", ""))
    if not normalized_email:
        return None

    email_address, _ = EmailAddress.objects.get_or_create(
        user=user,
        email=normalized_email,
        defaults={"verified": verified, "primary": True},
    )

    dirty_fields = []
    if verified and not email_address.verified:
        email_address.verified = True
        dirty_fields.append("verified")
    if not email_address.primary:
        email_address.primary = True
        dirty_fields.append("primary")
    if dirty_fields:
        email_address.save(update_fields=dirty_fields)

    EmailAddress.objects.filter(user=user).exclude(pk=email_address.pk).update(primary=False)
    return email_address


def is_email_verified(user) -> bool:
    if not user or not getattr(user, "email", ""):
        return False

    return EmailAddress.objects.filter(
        user=user,
        email__iexact=user.email,
        verified=True,
    ).exists()


def build_user_payload(user) -> dict:
    providers = list(
        SocialAccount.objects.filter(user=user).values_list("provider", flat=True)
    )
    if user.has_usable_password():
        providers.insert(0, "email")

    display_name = f"{user.first_name} {user.last_name}".strip() or user.email

    return {
        "id": user.id,
        "email": user.email,
        "email_verified": is_email_verified(user),
        "name": display_name,
        "providers": sorted(set(providers)),
    }


def _build_unique_username(email: str) -> str:
    User = get_user_model()
    base = slugify(email.split("@", 1)[0]) or "user"
    candidate = base[:140]
    suffix = 1
    while User.objects.filter(username__iexact=candidate).exists():
        suffix += 1
        candidate = f"{base[:120]}-{suffix}"
    return candidate


def create_password_user(email: str, password: str, name: str = ""):
    User = get_user_model()
    normalized_email = _normalize_email(email)
    first_name, last_name = _clean_name_parts(name)
    try:
        with transaction.atomic():
            user = User.objects.create_user(
                username=_build_unique_username(normalized_email),
                email=normalized_email,
                password=password,
                first_name=first_name,
                last_name=last_name,
            )
            sync_email_address(user, normalized_email, verified=False)
    except IntegrityError as exc:
        raise EmailConflictError(normalized_email) from exc
    return user


def get_user_by_email(email: str, *, active_only: bool = False):
    User = get_user_model()
    normalized_email = _normalize_email(email)
    if not normalized_email:
        return None

    queryset = User.objects.filter(email__iexact=normalized_email)
    if active_only:
        queryset = queryset.filter(is_active=True)

    matches = list(queryset.order_by("id")[:2])
    if len(matches) > 1:
        raise AmbiguousEmailError(normalized_email)

    return matches[0] if matches else None


def authenticate_password_user(email: str, password: str):
    try:
        user = get_user_by_email(email)
    except AmbiguousEmailError as exc:
        logger.error("Duplicate email accounts detected for login email=%s", exc)
        return None

    if not user or not user.check_password(password):
        return None
    return user


def issue_refresh_token(user):
    return RefreshToken.for_user(user)


def _cookie_common_kwargs() -> dict:
    return {
        "httponly": settings.SIMPLE_JWT["AUTH_COOKIE_HTTP_ONLY"],
        "secure": settings.SIMPLE_JWT["AUTH_COOKIE_SECURE"],
        "samesite": settings.SIMPLE_JWT["AUTH_COOKIE_SAMESITE"],
        "path": settings.SIMPLE_JWT["AUTH_COOKIE_PATH"],
    }


def set_auth_cookies(response, refresh_token: RefreshToken):
    access_lifetime = settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"]
    refresh_lifetime = settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]
    cookie_kwargs = _cookie_common_kwargs()

    response.set_cookie(
        settings.SIMPLE_JWT["AUTH_COOKIE"],
        str(refresh_token.access_token),
        max_age=int(access_lifetime.total_seconds()),
        **cookie_kwargs,
    )
    response.set_cookie(
        settings.SIMPLE_JWT["REFRESH_COOKIE"],
        str(refresh_token),
        max_age=int(refresh_lifetime.total_seconds()),
        **cookie_kwargs,
    )
    response["Cache-Control"] = "no-store"
    return response


def clear_auth_cookies(response):
    cookie_kwargs = {"path": settings.SIMPLE_JWT["AUTH_COOKIE_PATH"]}
    response.delete_cookie(settings.SIMPLE_JWT["AUTH_COOKIE"], **cookie_kwargs)
    response.delete_cookie(settings.SIMPLE_JWT["REFRESH_COOKIE"], **cookie_kwargs)
    response["Cache-Control"] = "no-store"
    return response


def sanitize_next_path(next_path: str | None) -> str:
    if not next_path:
        return "/"

    parsed = urlsplit(next_path)
    if parsed.scheme or parsed.netloc:
        return "/"

    path = parsed.path or "/"
    if not path.startswith("/"):
        path = f"/{path}"

    query = urlencode(parse_qsl(parsed.query, keep_blank_values=True))
    return urlunsplit(("", "", path, query, ""))


def sanitize_frontend_origin(origin: str | None) -> str:
    allowed = [value for value in settings.CORS_ALLOWED_ORIGINS if value]
    configured_origin = getattr(settings, "FRONTEND_APP_ORIGIN", "").strip()
    default_origin = configured_origin or (allowed[0] if allowed else "http://localhost:5173")
    if not origin:
        return default_origin

    parsed = urlsplit(origin)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return default_origin

    normalized = f"{parsed.scheme}://{parsed.netloc}"
    if normalized in allowed:
        return normalized

    if _is_loopback_host(parsed.hostname):
        requested_port = _port_for_origin(parsed)
        for allowed_origin in allowed:
            allowed_parsed = urlsplit(allowed_origin)
            if (
                allowed_parsed.scheme == parsed.scheme
                and _is_loopback_host(allowed_parsed.hostname)
                and _port_for_origin(allowed_parsed) == requested_port
            ):
                return normalized

    return default_origin


def build_google_state(next_path: str, origin: str) -> str:
    payload = {
        "next": sanitize_next_path(next_path),
        "origin": sanitize_frontend_origin(origin),
    }
    return signing.dumps(payload, salt=GOOGLE_STATE_SALT)


def read_google_state(state: str) -> dict:
    try:
        payload = signing.loads(state, salt=GOOGLE_STATE_SALT, max_age=600)
    except signing.BadSignature as exc:
        raise GoogleOAuthError("Google sign-in expired. Try again.") from exc

    return {
        "next": sanitize_next_path(payload.get("next")),
        "origin": sanitize_frontend_origin(payload.get("origin")),
    }


def build_frontend_redirect(origin: str, next_path: str, status: str | None = None, message: str | None = None) -> str:
    target = urlsplit(f"{sanitize_frontend_origin(origin)}{sanitize_next_path(next_path)}")
    params = dict(parse_qsl(target.query, keep_blank_values=True))
    if status:
        params["auth"] = status
    if message:
        params["auth_message"] = message[:200]
    return urlunsplit(
        (
            target.scheme,
            target.netloc,
            target.path,
            urlencode(params),
            target.fragment,
        )
    )


def build_frontend_absolute_url(path: str, params: dict | None = None, *, origin: str | None = None) -> str:
    target = urlsplit(f"{sanitize_frontend_origin(origin)}{sanitize_next_path(path)}")
    search = urlencode(params or {})
    return urlunsplit((target.scheme, target.netloc, target.path, search, target.fragment))


def build_google_authorization_url(request, *, next_path: str, origin: str) -> str:
    state = build_google_state(next_path, origin)
    if not google_oauth_is_configured():
        if settings.DEBUG:
            return f"{reverse('auth-google-mock-consent')}?{urlencode({'state': state})}"
        raise GoogleOAuthError("Google sign-in is not configured.")

    redirect_uri = settings.GOOGLE_OAUTH_REDIRECT_URI
    if not redirect_uri:
        raise GoogleOAuthError("Google OAuth redirect URI is missing.")

    query = urlencode(
        {
            "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "online",
            "include_granted_scopes": "true",
            "prompt": "select_account",
        }
    )
    return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"


def google_oauth_is_configured() -> bool:
    return bool(
        settings.GOOGLE_OAUTH_CLIENT_ID
        and settings.GOOGLE_OAUTH_CLIENT_SECRET
        and settings.GOOGLE_OAUTH_REDIRECT_URI
    )


def exchange_google_code_for_tokens(code: str) -> dict:
    response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "code": code,
            "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
            "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=15,
    )
    if response.status_code >= 400:
        raise GoogleOAuthError("Google sign-in failed. Try again or use email/password.")
    return response.json()


def fetch_google_profile(access_token: str) -> dict:
    response = requests.get(
        "https://openidconnect.googleapis.com/v1/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=15,
    )
    if response.status_code >= 400:
        raise GoogleOAuthError("Could not read the Google account profile.")

    profile = response.json()
    if not profile.get("email") or not profile.get("email_verified"):
        raise GoogleOAuthError("Google account must have a verified email.")
    return profile


def build_mock_google_profile(email: str | None, name: str | None, sub: str | None) -> dict:
    normalized_email = (email or settings.GOOGLE_OAUTH_MOCK_EMAIL).strip().lower()
    return {
        "sub": sub or f"mock-{normalized_email}",
        "email": normalized_email,
        "email_verified": True,
        "name": name or "Demo User",
        "given_name": (name or "Demo").split(" ", 1)[0],
        "family_name": (name or "User").split(" ", 1)[-1],
        "picture": "",
    }


def link_or_create_google_user(profile: dict):
    User = get_user_model()
    provider = "google"
    uid = str(profile["sub"])
    email = profile["email"].strip().lower()
    display_name = profile.get("name") or email

    existing_social = (
        SocialAccount.objects.select_related("user")
        .filter(provider=provider, uid=uid)
        .first()
    )
    if existing_social:
        user = existing_social.user
        if not user.is_active:
            raise GoogleOAuthError("This account is disabled. Contact the site owner.")
        existing_social.extra_data = profile
        existing_social.save(update_fields=["extra_data"])
        sync_email_address(user, email, verified=True)
        return user, False

    try:
        user = get_user_by_email(email)
    except AmbiguousEmailError as exc:
        logger.error("Duplicate email accounts detected for google sign-in email=%s", exc)
        raise GoogleOAuthError(
            "We couldn't link that Google account automatically. Contact the site owner."
        ) from exc

    created = False
    if not user:
        first_name, last_name = _clean_name_parts(display_name)
        try:
            with transaction.atomic():
                user = User.objects.create(
                    username=_build_unique_username(email),
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                )
                user.set_unusable_password()
                user.save(update_fields=["password"])
                created = True
        except IntegrityError:
            user = get_user_by_email(email)
            if not user:
                raise GoogleOAuthError("Google sign-in could not be completed. Try again.")
    else:
        if not user.is_active:
            raise GoogleOAuthError("This account is disabled. Contact the site owner.")
        first_name, last_name = _clean_name_parts(display_name)
        dirty_fields = []
        if not user.first_name and first_name:
            user.first_name = first_name
            dirty_fields.append("first_name")
        if not user.last_name and last_name:
            user.last_name = last_name
            dirty_fields.append("last_name")
        if dirty_fields:
            user.save(update_fields=dirty_fields)

    SocialAccount.objects.update_or_create(
        provider=provider,
        uid=uid,
        defaults={"user": user, "extra_data": profile},
    )
    sync_email_address(user, email, verified=True)
    return user, created


def find_password_reset_user(email: str):
    normalized_email = _normalize_email(email)
    if not normalized_email:
        return None
    try:
        user = get_user_by_email(normalized_email, active_only=True)
    except AmbiguousEmailError as exc:
        logger.error("Duplicate email accounts detected for password reset email=%s", exc)
        return None

    if not user or not is_email_verified(user):
        return None
    return user


def find_email_verification_user(email: str):
    normalized_email = _normalize_email(email)
    if not normalized_email:
        return None
    try:
        user = get_user_by_email(normalized_email)
    except AmbiguousEmailError as exc:
        logger.error("Duplicate email accounts detected for verification resend email=%s", exc)
        return None

    if not user or not user.is_active or is_email_verified(user):
        return None
    return user


def build_email_verification_link(user) -> str:
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = EMAIL_VERIFICATION_TOKEN_GENERATOR.make_token(user)
    return build_frontend_absolute_url(
        "/verify-email",
        {"uid": uid, "token": token},
    )


def send_email_verification_email(user):
    verification_link = build_email_verification_link(user)
    context = {
        "user": user,
        "verification_link": verification_link,
        "expiry_minutes": max(1, int(settings.PASSWORD_RESET_TIMEOUT / 60)),
        "site_name": "StockPulse",
    }
    subject = render_to_string("stocks/emails/email_verification_subject.txt", context).strip()
    text_body = render_to_string("stocks/emails/email_verification_email.txt", context)
    html_body = render_to_string("stocks/emails/email_verification_email.html", context)

    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    message.attach_alternative(html_body, "text/html")
    message.send(fail_silently=False)


def resolve_email_verification_user(uid: str, token: str):
    User = get_user_model()
    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
    except Exception:
        return None

    if not user.is_active:
        return None
    if not EMAIL_VERIFICATION_TOKEN_GENERATOR.check_token(user, token):
        return None

    return user


def mark_user_email_verified(user):
    sync_email_address(user, user.email, verified=True)
    return user


def build_password_reset_link(user) -> str:
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = PASSWORD_RESET_TOKEN_GENERATOR.make_token(user)
    return build_frontend_absolute_url(
        "/reset-password",
        {"uid": uid, "token": token},
    )


def send_password_reset_email(user):
    reset_link = build_password_reset_link(user)
    context = {
        "user": user,
        "reset_link": reset_link,
        "expiry_minutes": max(1, int(settings.PASSWORD_RESET_TIMEOUT / 60)),
        "site_name": "StockPulse",
    }
    subject = render_to_string("stocks/emails/password_reset_subject.txt", context).strip()
    text_body = render_to_string("stocks/emails/password_reset_email.txt", context)
    html_body = render_to_string("stocks/emails/password_reset_email.html", context)

    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    message.attach_alternative(html_body, "text/html")
    message.send(fail_silently=False)


def resolve_password_reset_user(uid: str, token: str):
    User = get_user_model()
    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id, is_active=True)
    except Exception:
        return None

    if not PASSWORD_RESET_TOKEN_GENERATOR.check_token(user, token):
        return None

    return user


def update_user_password(user, password: str):
    user.set_password(password)
    user.save(update_fields=["password"])
    return user
