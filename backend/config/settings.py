import os
from pathlib import Path
from datetime import timedelta
from decimal import Decimal
import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


def split_csv_env(name, default):
    return [value.strip() for value in os.getenv(name, default).split(',') if value.strip()]

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-dev-key-change-in-production')
DEBUG = os.getenv('DEBUG', 'True').lower() in ('true', '1', 'yes')
ALLOWED_HOSTS = split_csv_env('ALLOWED_HOSTS', 'localhost,127.0.0.1')

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
database_url = os.getenv('DATABASE_URL') or f"sqlite:///{BASE_DIR / 'db.sqlite3'}"
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
    'http://localhost:5173,http://127.0.0.1:5173',
)
CORS_ALLOW_CREDENTIALS = True

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
ACCOUNT_EMAIL_VERIFICATION = 'none'
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
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

GOOGLE_OAUTH_CLIENT_ID = os.getenv('GOOGLE_OAUTH_CLIENT_ID', '')
GOOGLE_OAUTH_CLIENT_SECRET = os.getenv('GOOGLE_OAUTH_CLIENT_SECRET', '')
GOOGLE_OAUTH_REDIRECT_URI = os.getenv('GOOGLE_OAUTH_REDIRECT_URI', '')
GOOGLE_OAUTH_MOCK_EMAIL = os.getenv('GOOGLE_OAUTH_MOCK_EMAIL', 'demo.user@stockpulse.dev')

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
