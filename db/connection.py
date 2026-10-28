"""Build the app's database connection settings from DB_* environment variables.

The same variables work for every database: point DB_NAME / DB_USER / DB_PASSWORD
at climate_dev or climate_staging and nothing else changes. Django settings can
reuse django_database_config() for DATABASES["default"].
"""

from collections.abc import Mapping
from urllib.parse import quote

REQUIRED_KEYS = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD")


def _read_settings(env: Mapping[str, str]) -> dict[str, str | int]:
    """Return the DB_* values, checked. An empty string counts as missing."""
    missing = [key for key in REQUIRED_KEYS if not env.get(key)]
    if missing:
        raise ValueError(f"Missing database settings: {', '.join(missing)}")

    raw_port = env["DB_PORT"]
    try:
        port = int(raw_port)
    except ValueError:
        port = 0
    if not 1 <= port <= 65535:
        raise ValueError(
            f"DB_PORT must be an integer from 1 to 65535, got {raw_port!r}"
        )

    return {
        "host": env["DB_HOST"],
        "port": port,
        "name": env["DB_NAME"],
        "user": env["DB_USER"],
        "password": env["DB_PASSWORD"],
    }


def build_database_url(env: Mapping[str, str]) -> str:
    """postgresql://user:password@host:port/name, with user, password and name URL-encoded."""
    s = _read_settings(env)
    user = quote(str(s["user"]), safe="")
    password = quote(str(s["password"]), safe="")
    name = quote(str(s["name"]), safe="")
    return f"postgresql://{user}:{password}@{s['host']}:{s['port']}/{name}"


def django_database_config(env: Mapping[str, str]) -> dict[str, str | int]:
    """The DATABASES["default"] dict for Django's PostgreSQL backend."""
    s = _read_settings(env)
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": s["name"],
        "USER": s["user"],
        "PASSWORD": s["password"],
        "HOST": s["host"],
        "PORT": s["port"],
    }
