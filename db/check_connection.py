"""Connect with the DB_* settings and print which database and user you are on.

Values come from the real environment first, then from .env in the repository root:

    python db/check_connection.py
    DB_NAME=climate_staging DB_USER=climate_staging_app DB_PASSWORD=... python db/check_connection.py
"""

import os
import sys
from pathlib import Path

import psycopg
from connection import build_database_url
from dotenv import load_dotenv


def main() -> int:
    # override=False: variables already set in the shell win over .env.
    load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)

    try:
        url = build_database_url(os.environ)
    except ValueError as error:
        print(f"Configuration error: {error}", file=sys.stderr)
        return 2

    try:
        with psycopg.connect(url, connect_timeout=5) as conn:
            database, user, version = conn.execute(
                "SELECT current_database(), current_user, version()"
            ).fetchone()
    except psycopg.OperationalError as error:
        print(f"Connection failed: {error}", file=sys.stderr)
        return 1

    print(f"current_database: {database}")
    print(f"current_user:     {user}")
    print(f"version:          {version}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
