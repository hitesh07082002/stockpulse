import pytest
from django.core.exceptions import ImproperlyConfigured

from config.runtime_validation import DEFAULT_SECRET_KEY, validate_runtime_configuration


def test_production_validation_rejects_fail_open_defaults():
    with pytest.raises(ImproperlyConfigured) as exc_info:
        validate_runtime_configuration(
            environment="production",
            is_production=True,
            debug=True,
            secret_key=DEFAULT_SECRET_KEY,
            database_url="sqlite:///tmp/db.sqlite3",
            allowed_hosts=[],
            cors_allowed_origins=[],
            frontend_app_origin="",
            email_backend="django.core.mail.backends.console.EmailBackend",
            default_from_email="",
            email_host="",
            email_use_tls=True,
            email_use_ssl=True,
            enable_google_oauth_mock=True,
        )

    message = str(exc_info.value)
    assert "DEBUG must be False" in message
    assert "SECRET_KEY must be set" in message
    assert "SQLite is not allowed" in message
    assert "ALLOWED_HOSTS must list" in message
    assert "CORS_ALLOWED_ORIGINS must list" in message
    assert "FRONTEND_APP_ORIGIN must point" in message
    assert "EMAIL_BACKEND must deliver real mail" in message
    assert "DEFAULT_FROM_EMAIL must be set" in message
    assert "EMAIL_USE_TLS and EMAIL_USE_SSL cannot both be True." in message
    assert "ENABLE_GOOGLE_OAUTH_MOCK must be False" in message


def test_production_validation_requires_smtp_host_when_using_smtp_backend():
    with pytest.raises(ImproperlyConfigured) as exc_info:
        validate_runtime_configuration(
            environment="production",
            is_production=True,
            debug=False,
            secret_key="prod-secret-key",
            database_url="postgres://stockpulse:secret@db:5432/stockpulse",
            allowed_hosts=["stockpulse.hiteshsadhwani.xyz"],
            cors_allowed_origins=["https://stockpulse.hiteshsadhwani.xyz"],
            frontend_app_origin="https://stockpulse.hiteshsadhwani.xyz",
            email_backend="django.core.mail.backends.smtp.EmailBackend",
            default_from_email="noreply@stockpulse.dev",
            email_host="",
            email_use_tls=True,
            email_use_ssl=False,
            enable_google_oauth_mock=False,
        )

    assert "EMAIL_HOST is required" in str(exc_info.value)


def test_production_validation_accepts_locked_down_configuration():
    validate_runtime_configuration(
        environment="production",
        is_production=True,
        debug=False,
        secret_key="prod-secret-key",
        database_url="postgres://stockpulse:secret@db:5432/stockpulse",
        allowed_hosts=["stockpulse.hiteshsadhwani.xyz"],
        cors_allowed_origins=["https://stockpulse.hiteshsadhwani.xyz"],
        frontend_app_origin="https://stockpulse.hiteshsadhwani.xyz",
        email_backend="django.core.mail.backends.smtp.EmailBackend",
        default_from_email="noreply@stockpulse.dev",
        email_host="smtp.postmarkapp.com",
        email_use_tls=True,
        email_use_ssl=False,
        enable_google_oauth_mock=False,
    )


def test_non_production_validation_allows_local_defaults():
    validate_runtime_configuration(
        environment="development",
        is_production=False,
        debug=True,
        secret_key=DEFAULT_SECRET_KEY,
        database_url="sqlite:///tmp/db.sqlite3",
        allowed_hosts=[],
        cors_allowed_origins=[],
        frontend_app_origin="http://localhost:5173",
        email_backend="django.core.mail.backends.console.EmailBackend",
        default_from_email="noreply@stockpulse.dev",
        email_host="",
        email_use_tls=False,
        email_use_ssl=False,
        enable_google_oauth_mock=True,
    )
