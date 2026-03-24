from django.test import override_settings

from stocks.health import evaluate_health


def test_health_is_ok_for_reachable_postgres_in_production():
    with override_settings(STOCKPULSE_ENV="production", IS_PRODUCTION=True, DEBUG=False):
        payload, status_code = evaluate_health(db_ok=True, db_vendor="postgresql")

    assert status_code == 200
    assert payload["status"] == "ok"
    assert payload["checks"]["db"] == "ok"
    assert payload["checks"]["debug"] == "off"


def test_health_rejects_sqlite_in_production():
    with override_settings(STOCKPULSE_ENV="production", IS_PRODUCTION=True, DEBUG=False):
        payload, status_code = evaluate_health(db_ok=True, db_vendor="sqlite")

    assert status_code == 503
    assert payload["status"] == "error"
    assert payload["checks"]["db"] == "sqlite_not_allowed"


def test_health_rejects_debug_mode_in_production():
    with override_settings(STOCKPULSE_ENV="production", IS_PRODUCTION=True, DEBUG=True):
        payload, status_code = evaluate_health(db_ok=True, db_vendor="postgresql")

    assert status_code == 503
    assert payload["status"] == "error"
    assert payload["checks"]["debug"] == "debug_not_allowed"
