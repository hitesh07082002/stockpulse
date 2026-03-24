from django.conf import settings


def evaluate_health(*, db_ok, db_vendor):
    checks = {
        "db": "ok" if db_ok else "unreachable",
        "db_vendor": db_vendor if db_ok else None,
        "environment": settings.STOCKPULSE_ENV,
        "debug": "off" if not settings.DEBUG else "on",
    }

    if not db_ok:
        return {
            "status": "error",
            "checks": checks,
        }, 503

    if settings.IS_PRODUCTION and db_vendor == "sqlite":
        checks["db"] = "sqlite_not_allowed"
        return {
            "status": "error",
            "checks": checks,
        }, 503

    if settings.IS_PRODUCTION and settings.DEBUG:
        checks["debug"] = "debug_not_allowed"
        return {
            "status": "error",
            "checks": checks,
        }, 503

    return {
        "status": "ok",
        "checks": checks,
    }, 200
