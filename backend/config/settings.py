import os
from pathlib import Path
from datetime import timedelta
from decimal import Decimal
import dj_database_url
from dotenv import load_dotenv

from config.runtime_validation import (
    DEFAULT_SECRET_KEY,
    parse_bool_env,
    validate_runtime_configuration,
)

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


def split_csv_env(name, default):
    return [value.strip() for value in os.getenv(name, default).split(',') if value.strip()]

STOCKPULSE_ENV = os.getenv('STOCKPULSE_ENV', 'development').strip().lower()
IS_PRODUCTION = STOCKPULSE_ENV == 'production'

SECRET_KEY = os.getenv('SECRET_KEY', DEFAULT_SECRET_KEY)
DEBUG = parse_bool_env(os.getenv('DEBUG'), default=not IS_PRODUCTION)
ALLOWED_HOSTS = split_csv_env(
    'ALLOWED_HOSTS',
    '' if IS_PRODUCTION else 'localhost,127.0.0.1',
)

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',
    # Third party
    'rest_framework',
    'corsheaders',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',
    # Local
    'stocks',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database — SQLite for dev, PostgreSQL for production
DATABASE_URL = os.getenv('DATABASE_URL', '').strip()
database_url = DATABASE_URL or f"sqlite:///{BASE_DIR / 'db.sqlite3'}"
DATABASES = {
    'default': dj_database_url.parse(
        database_url,
        conn_max_age=int(os.getenv('DATABASE_CONN_MAX_AGE', '0')),
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
SPA_BUILD_DIR = Path(os.getenv('SPA_BUILD_DIR', BASE_DIR.parent / 'frontend' / 'dist'))
if SPA_BUILD_DIR.exists():
    STATICFILES_DIRS = [('spa', str(SPA_BUILD_DIR))]
    WHITENOISE_ROOT = str(SPA_BUILD_DIR)
if not DEBUG:
    STORAGES = {
        'staticfiles': {
            'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
        },
    }
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS
CORS_ALLOWED_ORIGINS = split_csv_env(
    'CORS_ALLOWED_ORIGINS',
    '' if IS_PRODUCTION else 'http://localhost:5173,http://127.0.0.1:5173',
)
CORS_ALLOW_CREDENTIALS = True
FRONTEND_APP_ORIGIN = (
    os.getenv('FRONTEND_APP_ORIGIN', '').strip()
    or (CORS_ALLOWED_ORIGINS[0] if CORS_ALLOWED_ORIGINS else ('https://stockpulse.hiteshsadhwani.xyz' if IS_PRODUCTION else 'http://localhost:5173'))
)

# CSRF
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

# DRF
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'stocks.authentication.CookieJWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 25,
}

# JWT — httpOnly cookies
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'CHECK_REVOKE_TOKEN': True,
    'AUTH_COOKIE': 'access_token',
    'REFRESH_COOKIE': 'refresh_token',
    'AUTH_COOKIE_HTTP_ONLY': True,
    'AUTH_COOKIE_SAMESITE': 'Lax',
    'AUTH_COOKIE_SECURE': not DEBUG,
    'AUTH_COOKIE_PATH': '/',
}

AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]

# django-allauth
SITE_ID = 1
ACCOUNT_LOGIN_METHODS = {'email'}
ACCOUNT_SIGNUP_FIELDS = ['email*', 'password1*', 'password2*']
ACCOUNT_EMAIL_VERIFICATION = 'mandatory'
SOCIALACCOUNT_PROVIDERS = {
    'google': {
        'SCOPE': ['profile', 'email'],
        'AUTH_PARAMS': {'access_type': 'online'},
    }
}

CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = not DEBUG
SECURE_SSL_REDIRECT = not DEBUG
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

GOOGLE_OAUTH_CLIENT_ID = os.getenv('GOOGLE_OAUTH_CLIENT_ID', '')
GOOGLE_OAUTH_CLIENT_SECRET = os.getenv('GOOGLE_OAUTH_CLIENT_SECRET', '')
GOOGLE_OAUTH_REDIRECT_URI = os.getenv('GOOGLE_OAUTH_REDIRECT_URI', '')
GOOGLE_OAUTH_MOCK_EMAIL = os.getenv('GOOGLE_OAUTH_MOCK_EMAIL', 'demo.user@stockpulse.dev')
ENABLE_GOOGLE_OAUTH_MOCK = parse_bool_env(
    os.getenv('ENABLE_GOOGLE_OAUTH_MOCK'),
    default=(DEBUG and not IS_PRODUCTION),
)

# Email / password reset
EMAIL_BACKEND = os.getenv(
    'EMAIL_BACKEND',
    'django.core.mail.backends.console.EmailBackend'
    if DEBUG
    else 'django.core.mail.backends.smtp.EmailBackend',
).strip()
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'noreply@stockpulse.dev').strip()
SERVER_EMAIL = os.getenv('SERVER_EMAIL', DEFAULT_FROM_EMAIL).strip()
EMAIL_HOST = os.getenv('EMAIL_HOST', '').strip()
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '').strip()
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = parse_bool_env(os.getenv('EMAIL_USE_TLS'), default=not DEBUG)
EMAIL_USE_SSL = parse_bool_env(os.getenv('EMAIL_USE_SSL'), default=False)
EMAIL_TIMEOUT = int(os.getenv('EMAIL_TIMEOUT', '15'))
PASSWORD_RESET_TIMEOUT = int(os.getenv('PASSWORD_RESET_TIMEOUT', '3600'))
AUTH_REGISTER_RATE = os.getenv('AUTH_REGISTER_RATE', '5/h').strip()
AUTH_LOGIN_RATE = os.getenv('AUTH_LOGIN_RATE', '10/m').strip()
EMAIL_VERIFICATION_RESEND_RATE = os.getenv('EMAIL_VERIFICATION_RESEND_RATE', '5/h').strip()
EMAIL_VERIFICATION_CONFIRM_RATE = os.getenv('EMAIL_VERIFICATION_CONFIRM_RATE', '15/h').strip()
PASSWORD_RESET_REQUEST_RATE = os.getenv('PASSWORD_RESET_REQUEST_RATE', '5/h').strip()
PASSWORD_RESET_CONFIRM_RATE = os.getenv('PASSWORD_RESET_CONFIRM_RATE', '10/h').strip()

# AI providers
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
_default_ai_provider = 'gemini' if DEBUG and GEMINI_API_KEY and not os.getenv('AI_PROVIDER') else 'anthropic'
AI_PROVIDER = os.getenv('AI_PROVIDER', _default_ai_provider).strip().lower()
AI_MAX_TOKENS = int(os.getenv('AI_MAX_TOKENS', '1024'))
AI_PROVIDER_TIMEOUT_SECONDS = int(os.getenv('AI_PROVIDER_TIMEOUT_SECONDS', '45'))
AI_DAILY_LIMIT_ANONYMOUS = 10
AI_DAILY_LIMIT_AUTHENTICATED = 50
AI_BURST_LIMIT_PER_MINUTE = int(os.getenv('AI_BURST_LIMIT_PER_MINUTE', '3'))
AI_MAX_HISTORY_TURNS = int(os.getenv('AI_MAX_HISTORY_TURNS', '6'))
AI_CONTEXT_ANNUAL_PERIODS = int(os.getenv('AI_CONTEXT_ANNUAL_PERIODS', '10'))
AI_CONTEXT_QUARTERLY_PERIODS = int(os.getenv('AI_CONTEXT_QUARTERLY_PERIODS', '8'))
AI_ANON_COOKIE = os.getenv('AI_ANON_COOKIE', 'anon_ai_id')
AI_ANON_COOKIE_MAX_AGE_DAYS = int(os.getenv('AI_ANON_COOKIE_MAX_AGE_DAYS', '30'))

ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '')
ANTHROPIC_MODEL = os.getenv('ANTHROPIC_MODEL', 'claude-haiku-4-5-20251001')
ANTHROPIC_INPUT_COST_PER_MTOK_USD = Decimal(os.getenv('ANTHROPIC_INPUT_COST_PER_MTOK_USD', '0.80'))
ANTHROPIC_OUTPUT_COST_PER_MTOK_USD = Decimal(os.getenv('ANTHROPIC_OUTPUT_COST_PER_MTOK_USD', '4.00'))

GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')
GEMINI_THINKING_BUDGET = int(os.getenv('GEMINI_THINKING_BUDGET', '0'))
GEMINI_INPUT_COST_PER_MTOK_USD = Decimal(os.getenv('GEMINI_INPUT_COST_PER_MTOK_USD', '0.30'))
GEMINI_OUTPUT_COST_PER_MTOK_USD = Decimal(os.getenv('GEMINI_OUTPUT_COST_PER_MTOK_USD', '2.50'))

# SEC EDGAR
SEC_USER_AGENT = 'StockPulse hitesh07082002@gmail.com'
SEC_RATE_LIMIT = 10  # requests per second

validate_runtime_configuration(
    environment=STOCKPULSE_ENV,
    is_production=IS_PRODUCTION,
    debug=DEBUG,
    secret_key=SECRET_KEY,
    database_url=database_url,
    allowed_hosts=ALLOWED_HOSTS,
    cors_allowed_origins=CORS_ALLOWED_ORIGINS,
    frontend_app_origin=FRONTEND_APP_ORIGIN,
    email_backend=EMAIL_BACKEND,
    default_from_email=DEFAULT_FROM_EMAIL,
    email_host=EMAIL_HOST,
    email_use_tls=EMAIL_USE_TLS,
    email_use_ssl=EMAIL_USE_SSL,
    enable_google_oauth_mock=ENABLE_GOOGLE_OAUTH_MOCK,
)
