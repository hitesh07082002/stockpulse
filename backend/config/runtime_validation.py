from django.core.exceptions import ImproperlyConfigured


DEFAULT_SECRET_KEY = "django-insecure-dev-key-change-in-production"


def parse_bool_env(raw_value, *, default):
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"true", "1", "yes", "on"}


def validate_runtime_configuration(
    *,
    environment,
    is_production,
    debug,
    secret_key,
    database_url,
    allowed_hosts,
    cors_allowed_origins,
    enable_google_oauth_mock,
):
    errors = []

    if not is_production:
        return

    if debug:
        errors.append("DEBUG must be False in production.")

    if not secret_key or secret_key == DEFAULT_SECRET_KEY:
        errors.append("SECRET_KEY must be set to a unique non-default value in production.")

    if not database_url:
        errors.append("DATABASE_URL is required in production.")
    elif database_url.startswith("sqlite"):
        errors.append("SQLite is not allowed in production; configure PostgreSQL via DATABASE_URL.")

    if not allowed_hosts:
        errors.append("ALLOWED_HOSTS must list the production domain.")

    if not cors_allowed_origins:
        errors.append("CORS_ALLOWED_ORIGINS must list the production frontend origin.")

    if enable_google_oauth_mock:
        errors.append("ENABLE_GOOGLE_OAUTH_MOCK must be False in production.")

    if errors:
        message = "\n".join(f"- {error}" for error in errors)
        raise ImproperlyConfigured(
            f"Invalid {environment} configuration:\n{message}"
        )
