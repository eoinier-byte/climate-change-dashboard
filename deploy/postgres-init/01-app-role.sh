#!/bin/sh
# Runs ONCE, when the production database is first created (docker-compose.prod.yml).
# Makes the limited user Django connects as (docs/security.md row 8, CCD-311):
# it can log in and read/write rows, but cannot create, change or drop tables.
# Tables are created by migrations, which run as the owner (POSTGRES_USER).
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
  CREATE ROLE "$APP_DB_USER" LOGIN PASSWORD '$APP_DB_PASSWORD';
  GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO "$APP_DB_USER";
  GRANT USAGE ON SCHEMA public TO "$APP_DB_USER";

  -- Every table and id counter the owner creates later (through migrations) is shared with the app user
  ALTER DEFAULT PRIVILEGES FOR ROLE "$POSTGRES_USER" IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "$APP_DB_USER";
  ALTER DEFAULT PRIVILEGES FOR ROLE "$POSTGRES_USER" IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO "$APP_DB_USER";
EOSQL