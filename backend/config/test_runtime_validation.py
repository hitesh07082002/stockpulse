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
            enable_google_oauth_mock=True,
        )

    message = str(exc_info.value)
    assert "DEBUG must be False" in message
    assert "SECRET_KEY must be set" in message
    assert "SQLite is not allowed" in message
    assert "ALLOWED_HOSTS must list" in message
    assert "CORS_ALLOWED_ORIGINS must list" in message
    assert "ENABLE_GOOGLE_OAUTH_MOCK must be False" in message


def test_production_validation_accepts_locked_down_configuration():
    validate_runtime_configuration(
        environment="production",
        is_production=True,
        debug=False,
        secret_key="prod-secret-key",
        database_url="postgres://stockpulse:secret@db:5432/stockpulse",
        allowed_hosts=["stockpulse.hiteshsadhwani.xyz"],
        cors_allowed_origins=["https://stockpulse.hiteshsadhwani.xyz"],
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
        enable_google_oauth_mock=True,
    )
