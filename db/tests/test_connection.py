"""Unit tests for db/connection.py. No database needed."""

import pytest

from db.connection import REQUIRED_KEYS, build_database_url, django_database_config

DEV = {
    "DB_HOST": "localhost",
    "DB_PORT": "5432",
    "DB_NAME": "climate_dev",
    "DB_USER": "climate_app",
    "DB_PASSWORD": "dev-secret",
}
STAGING = {
    **DEV,
    "DB_NAME": "climate_staging",
    "DB_USER": "climate_staging_app",
    "DB_PASSWORD": "staging-secret",
}


def test_builds_url():
    assert (
        build_database_url(DEV)
        == "postgresql://climate_app:dev-secret@localhost:5432/climate_dev"
    )


def test_builds_django_config():
    assert django_database_config(DEV) == {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "climate_dev",
        "USER": "climate_app",
        "PASSWORD": "dev-secret",
        "HOST": "localhost",
        "PORT": 5432,
    }


def test_ignores_unrelated_variables():
    env = {**DEV, "POSTGRES_PASSWORD": "admin", "PATH": "/usr/bin"}
    assert build_database_url(env) == build_database_url(DEV)


@pytest.mark.parametrize("key", REQUIRED_KEYS)
@pytest.mark.parametrize("build", [build_database_url, django_database_config])
def test_missing_variable(build, key):
    env = {k: v for k, v in DEV.items() if k != key}
    with pytest.raises(ValueError, match=key):
        build(env)


@pytest.mark.parametrize("key", REQUIRED_KEYS)
def test_empty_string_counts_as_missing(key):
    with pytest.raises(ValueError, match=key):
        build_database_url({**DEV, key: ""})


def test_error_names_all_missing_keys():
    with pytest.raises(ValueError) as error:
        build_database_url({"DB_HOST": "localhost", "DB_PASSWORD": ""})
    for key in ("DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"):
        assert key in str(error.value)
    assert "DB_HOST" not in str(error.value)


def test_password_special_characters_are_escaped():
    url = build_database_url({**DEV, "DB_PASSWORD": "p@ss/wo:rd"})
    assert url == "postgresql://climate_app:p%40ss%2Fwo%3Ard@localhost:5432/climate_dev"


def test_django_config_keeps_raw_password():
    assert (
        django_database_config({**DEV, "DB_PASSWORD": "p@ss/wo:rd"})["PASSWORD"]
        == "p@ss/wo:rd"
    )


@pytest.mark.parametrize("port", ["abc", "5432x", "54.32", "0", "-1", "65536", " "])
@pytest.mark.parametrize("build", [build_database_url, django_database_config])
def test_bad_port_rejected(build, port):
    with pytest.raises(ValueError, match="DB_PORT"):
        build({**DEV, "DB_PORT": port})


def test_dev_and_staging_urls_differ():
    dev, staging = build_database_url(DEV), build_database_url(STAGING)
    assert dev != staging
    assert dev.endswith("/climate_dev")
    assert staging.endswith("/climate_staging")
    assert "climate_staging_app:staging-secret@" in staging
