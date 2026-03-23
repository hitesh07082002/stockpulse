from __future__ import annotations

from datetime import timedelta
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import requests
from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialAccount
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.urls import reverse
from django.utils.text import slugify
from rest_framework_simplejwt.tokens import RefreshToken


GOOGLE_STATE_SALT = "stocks.auth.google"


class GoogleOAuthError(Exception):
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
    normalized_email = (email or "").strip().lower()
    first_name, last_name = _clean_name_parts(name)
    user = User.objects.create_user(
        username=_build_unique_username(normalized_email),
        email=normalized_email,
        password=password,
        first_name=first_name,
        last_name=last_name,
    )
    EmailAddress.objects.update_or_create(
        user=user,
        email=normalized_email,
        defaults={"verified": True, "primary": True},
    )
    return user


def authenticate_password_user(email: str, password: str):
    User = get_user_model()
    normalized_email = (email or "").strip().lower()
    user = User.objects.filter(email__iexact=normalized_email).first()
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
    default_origin = allowed[0] if allowed else "http://localhost:5173"
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
        existing_social.extra_data = profile
        existing_social.save(update_fields=["extra_data"])
        EmailAddress.objects.update_or_create(
            user=user,
            email=email,
            defaults={"verified": True, "primary": True},
        )
        return user, False

    user = User.objects.filter(email__iexact=email).first()
    created = False
    if not user:
        first_name, last_name = _clean_name_parts(display_name)
        user = User.objects.create(
            username=_build_unique_username(email),
            email=email,
            first_name=first_name,
            last_name=last_name,
        )
        user.set_unusable_password()
        user.save(update_fields=["password"])
        created = True
    else:
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
    EmailAddress.objects.update_or_create(
        user=user,
        email=email,
        defaults={"verified": True, "primary": True},
    )
    return user, created
