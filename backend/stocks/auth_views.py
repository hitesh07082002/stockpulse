import logging

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.http import HttpResponse, HttpResponseRedirect
from django.middleware.csrf import get_token
from django.utils.html import escape
from django_ratelimit.core import is_ratelimited
from rest_framework import serializers, status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .auth_services import (
    GoogleOAuthError,
    authenticate_password_user,
    build_frontend_redirect,
    build_google_authorization_url,
    build_mock_google_profile,
    build_user_payload,
    clear_auth_cookies,
    create_password_user,
    exchange_google_code_for_tokens,
    find_password_reset_user,
    fetch_google_profile,
    google_oauth_is_configured,
    issue_refresh_token,
    link_or_create_google_user,
    read_google_state,
    resolve_password_reset_user,
    send_password_reset_email,
    set_auth_cookies,
    update_user_password,
)
from .authentication import CookieJWTAuthentication

logger = logging.getLogger(__name__)
PASSWORD_RESET_REQUEST_MESSAGE = "If an account exists for that email, we sent a reset link."


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, max_length=128, trim_whitespace=False)
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate_email(self, value):
        from django.contrib.auth import get_user_model

        normalized = value.strip().lower()
        User = get_user_model()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("An account already exists for that email.")
        return normalized

    def validate_password(self, value):
        validate_password(value)
        return value


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(max_length=128, trim_whitespace=False)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.strip().lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(min_length=8, max_length=128, trim_whitespace=False)

    def validate_password(self, value):
        validate_password(value)
        return value


def _session_payload(user=None, *, has_refresh_session=False):
    is_authenticated = bool(user and user.is_authenticated)
    return {
        "is_authenticated": is_authenticated,
        "user": build_user_payload(user) if is_authenticated else None,
        "limits": {
            "anonymous_daily": settings.AI_DAILY_LIMIT_ANONYMOUS,
            "authenticated_daily": settings.AI_DAILY_LIMIT_AUTHENTICATED,
            "current_daily": (
                settings.AI_DAILY_LIMIT_AUTHENTICATED
                if is_authenticated
                else settings.AI_DAILY_LIMIT_ANONYMOUS
            ),
        },
        "google_signin_available": google_oauth_is_configured() or settings.ENABLE_GOOGLE_OAUTH_MOCK,
        "has_refresh_session": has_refresh_session,
    }


def _response_with_auth(request, user, *, http_status=status.HTTP_200_OK):
    get_token(request)
    refresh_token = issue_refresh_token(user)
    response = Response(
        _session_payload(user, has_refresh_session=True),
        status=http_status,
    )
    return set_auth_cookies(response, refresh_token)


def _is_auth_rate_limited(request, *, group: str, rate: str) -> bool:
    return is_ratelimited(
        request=request,
        group=group,
        key="ip",
        rate=rate,
        method=["POST"],
        increment=True,
    )


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def session_view(request):
    get_token(request)
    user = None
    has_refresh_session = bool(request.COOKIES.get(settings.SIMPLE_JWT["REFRESH_COOKIE"]))
    try:
        auth_result = CookieJWTAuthentication().authenticate(request)
        if auth_result:
            user = auth_result[0]
    except Exception:
        user = None
    return Response(_session_payload(user, has_refresh_session=has_refresh_session))


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def register_view(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = create_password_user(
        serializer.validated_data["email"],
        serializer.validated_data["password"],
        serializer.validated_data.get("name", ""),
    )
    return _response_with_auth(request, user, http_status=status.HTTP_201_CREATED)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = authenticate_password_user(
        serializer.validated_data["email"],
        serializer.validated_data["password"],
    )
    if not user:
        return Response(
            {"error": "Invalid email or password."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return _response_with_auth(request, user)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def refresh_view(request):
    get_token(request)
    raw_token = request.COOKIES.get(settings.SIMPLE_JWT["REFRESH_COOKIE"])
    if not raw_token:
        response = Response(
            {"error": "No refresh session available."},
            status=status.HTTP_401_UNAUTHORIZED,
        )
        return clear_auth_cookies(response)

    try:
        refresh_token = RefreshToken(raw_token)
        user = CookieJWTAuthentication().get_user(refresh_token)
    except (TokenError, AuthenticationFailed):
        response = Response(
            {"error": "Refresh session expired. Sign in again."},
            status=status.HTTP_401_UNAUTHORIZED,
        )
        return clear_auth_cookies(response)

    response = Response(_session_payload(user, has_refresh_session=True))
    return set_auth_cookies(response, refresh_token)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def logout_view(request):
    get_token(request)
    response = Response({"ok": True})
    return clear_auth_cookies(response)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def password_reset_request_view(request):
    if _is_auth_rate_limited(
        request,
        group="auth.password_reset.request",
        rate=settings.PASSWORD_RESET_REQUEST_RATE,
    ):
        return Response(
            {"error": "Too many reset attempts. Try again soon."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    serializer = PasswordResetRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = find_password_reset_user(serializer.validated_data["email"])
    if user:
        try:
            send_password_reset_email(user)
        except Exception:
            logger.exception("Password reset email failed for user_id=%s", user.id)

    return Response({"message": PASSWORD_RESET_REQUEST_MESSAGE})


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def password_reset_confirm_view(request):
    if _is_auth_rate_limited(
        request,
        group="auth.password_reset.confirm",
        rate=settings.PASSWORD_RESET_CONFIRM_RATE,
    ):
        return Response(
            {"error": "Too many reset attempts. Try again soon."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    serializer = PasswordResetConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = resolve_password_reset_user(
        serializer.validated_data["uid"],
        serializer.validated_data["token"],
    )
    if not user:
        return Response(
            {"error": "This reset link is invalid or has expired."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    update_user_password(user, serializer.validated_data["password"])
    return Response({"message": "Password updated. Sign in with your new password."})


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def google_start_view(request):
    next_path = request.query_params.get("next", "/")
    origin = request.query_params.get("origin")
    try:
        redirect_url = build_google_authorization_url(
            request,
            next_path=next_path,
            origin=origin,
        )
    except GoogleOAuthError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return HttpResponseRedirect(redirect_url)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def google_mock_consent_view(request):
    if not settings.ENABLE_GOOGLE_OAUTH_MOCK:
        return HttpResponse(status=404)

    state = request.query_params.get("state", "")
    callback_url = "/api/auth/google/callback/"
    email = settings.GOOGLE_OAUTH_MOCK_EMAIL
    html = f"""
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Mock Google Consent</title>
    <style>
      body {{ font-family: system-ui, sans-serif; background: #0b1020; color: #f8fafc; margin: 0; }}
      .wrap {{ min-height: 100vh; display: grid; place-items: center; padding: 24px; }}
      .card {{ width: min(420px, 100%); background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 24px; }}
      h1 {{ margin: 0 0 12px; font-size: 1.5rem; }}
      p {{ color: #cbd5e1; line-height: 1.5; }}
      button {{ margin-top: 20px; width: 100%; border: 0; border-radius: 999px; background: #f59e0b; color: #111827; padding: 12px 16px; font-weight: 700; cursor: pointer; }}
      code {{ color: #fbbf24; }}
    </style>
  </head>
  <body>
    <div class="wrap">
      <form class="card" method="get" action="{escape(callback_url)}">
        <h1>Continue with Google</h1>
        <p>This debug-only consent page stands in for Google OAuth when local credentials are not configured.</p>
        <p>You’ll be signed in as <code>{escape(email)}</code>.</p>
        <input type="hidden" name="state" value="{escape(state)}" />
        <input type="hidden" name="mock" value="1" />
        <input type="hidden" name="email" value="{escape(email)}" />
        <input type="hidden" name="name" value="Demo User" />
        <input type="hidden" name="sub" value="debug-demo-user" />
        <button type="submit">Continue as {escape(email)}</button>
      </form>
    </div>
  </body>
</html>
"""
    return HttpResponse(html)


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def google_callback_view(request):
    state_value = request.query_params.get("state", "")
    try:
        state_payload = read_google_state(state_value)
    except GoogleOAuthError as exc:
        return HttpResponseRedirect(
            build_frontend_redirect(
                request.query_params.get("origin"),
                "/",
                status="google-error",
                message=str(exc),
            )
        )

    redirect_origin = state_payload["origin"]
    redirect_next = state_payload["next"]

    try:
        if request.query_params.get("mock") == "1" and settings.ENABLE_GOOGLE_OAUTH_MOCK:
            profile = build_mock_google_profile(
                request.query_params.get("email"),
                request.query_params.get("name"),
                request.query_params.get("sub"),
            )
        else:
            code = request.query_params.get("code")
            if not code:
                raise GoogleOAuthError("Google sign-in did not complete. Try again.")
            token_payload = exchange_google_code_for_tokens(code)
            profile = fetch_google_profile(token_payload.get("access_token", ""))

        user, _created = link_or_create_google_user(profile)
    except GoogleOAuthError as exc:
        response = HttpResponseRedirect(
            build_frontend_redirect(
                redirect_origin,
                redirect_next,
                status="google-error",
                message=str(exc),
            )
        )
        return clear_auth_cookies(response)

    get_token(request)
    response = HttpResponseRedirect(
        build_frontend_redirect(
            redirect_origin,
            redirect_next,
            status="google-success",
        )
    )
    return set_auth_cookies(response, issue_refresh_token(user))
