import os
import warnings
from pathlib import Path
from urllib.parse import unquote, urlparse


BASE_DIR = Path(__file__).resolve().parent.parent


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_list(name: str, default: str = "") -> list[str]:
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


def _is_placeholder_database_url(db_url: str) -> bool:
    parsed = urlparse(db_url)
    username = (parsed.username or "").strip().lower()
    password = (parsed.password or "").strip().lower()
    host = (parsed.hostname or "").strip().lower()
    db_name = parsed.path.lstrip("/").strip().lower()

    return (
        username in {"user", "username"}
        and password in {"password", "pass"}
        and host in {"host", "hostname"}
        and db_name in {"dbname", "database", "db"}
    )


def _parse_postgres_database_url(db_url: str) -> dict:
    parsed = urlparse(db_url)
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise ValueError("Unsupported DATABASE_URL scheme")

    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": parsed.path.lstrip("/"),
        "USER": unquote(parsed.username or ""),
        "PASSWORD": unquote(parsed.password or ""),
        "HOST": parsed.hostname or "",
        "PORT": str(parsed.port or 5432),
        "CONN_MAX_AGE": int(os.getenv("DJANGO_DB_CONN_MAX_AGE", "600")),
        "OPTIONS": {
            "sslmode": os.getenv("DJANGO_DB_SSLMODE", "require"),
        },
    }


def _postgres_config_from_pg_vars() -> dict | None:
    host = os.getenv("PGHOST", "").strip()
    port = os.getenv("PGPORT", "").strip()
    user = os.getenv("PGUSER", "").strip()
    password = os.getenv("PGPASSWORD", "").strip()
    database = os.getenv("PGDATABASE", "").strip()

    if not all([host, port, user, password, database]):
        return None

    if (
        host.lower() in {"host", "hostname"}
        or user.lower() in {"user", "username"}
        or password.lower() in {"password", "pass"}
        or database.lower() in {"dbname", "database", "db"}
    ):
        return None

    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": database,
        "USER": user,
        "PASSWORD": password,
        "HOST": host,
        "PORT": port,
        "CONN_MAX_AGE": int(os.getenv("DJANGO_DB_CONN_MAX_AGE", "600")),
        "OPTIONS": {
            "sslmode": os.getenv("DJANGO_DB_SSLMODE", "require"),
        },
    }


def _database_config_from_env() -> dict | None:
    # Railway users often provide either DATABASE_URL or DATABASE_PRIVATE_URL.
    for env_name in (
        "DATABASE_URL",
        "DATABASE_URI",
        "DATABASE_PRIVATE_URL",
        "POSTGRES_URL",
        "POSTGRESQL_URL",
        "DATABASE_PUBLIC_URL",
    ):
        db_url = os.getenv(env_name, "").strip()
        if not db_url or _is_placeholder_database_url(db_url):
            continue
        try:
            return _parse_postgres_database_url(db_url)
        except ValueError:
            continue

    return _postgres_config_from_pg_vars()


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "ecopixel-dev-key-change-in-production-7f4d6a9b2c1e")
DEBUG = _env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = _env_list("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost")
CSRF_TRUSTED_ORIGINS = _env_list("DJANGO_CSRF_TRUSTED_ORIGINS")

# Railway provides a public domain in this variable.
railway_public_domain = os.getenv("RAILWAY_PUBLIC_DOMAIN", "").strip()
if railway_public_domain:
    if railway_public_domain not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append(railway_public_domain)
    railway_origin = f"https://{railway_public_domain}"
    if railway_origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(railway_origin)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "drawings",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "ecopixel.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.template.context_processors.i18n",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "drawings.context_processors.contest_status",
            ],
        },
    },
]

WSGI_APPLICATION = "ecopixel.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

env_database_config = _database_config_from_env()
if env_database_config:
    DATABASES["default"] = env_database_config
elif os.getenv("RAILWAY_PROJECT_ID") and not DEBUG:
    warnings.warn(
        "Running with SQLite on Railway. Configure DATABASE_URL=${{Postgres.DATABASE_URL}} "
        "or PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE so data is persisted.",
        RuntimeWarning,
    )

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "ru"
LANGUAGES = [
    ("ru", "Русский"),
    ("en", "English"),
]
LOCALE_PATHS = [BASE_DIR / "locale"]
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
LANGUAGE_COOKIE_NAME = "ecopixel_language"
LANGUAGE_COOKIE_AGE = 60 * 60 * 24 * 365
LANGUAGE_COOKIE_SAMESITE = "Lax"

STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = "noreply@ecopixel.ru"

LOGIN_URL = "/login/"
LOGIN_REDIRECT_URL = "/profile/"
LOGOUT_REDIRECT_URL = "/"

# Security defaults for production
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "same-origin"

if not DEBUG:
    SECURE_SSL_REDIRECT = _env_bool("DJANGO_SECURE_SSL_REDIRECT", True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.getenv("DJANGO_SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = _env_bool("DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", True)
    SECURE_HSTS_PRELOAD = _env_bool("DJANGO_SECURE_HSTS_PRELOAD", True)
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Contest phases (Europe/Moscow): submission → voting → results on CONTEST_RESULTS_START
CONTEST_TIMEZONE = os.getenv("CONTEST_TIMEZONE", "Europe/Moscow")
CONTEST_SUBMISSION_END = os.getenv("CONTEST_SUBMISSION_END", "2026-09-07")
CONTEST_RESULTS_START = os.getenv("CONTEST_RESULTS_START", "2026-09-15")
