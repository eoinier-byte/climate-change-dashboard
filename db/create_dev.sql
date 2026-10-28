-- Creates the app role and development database (CCD-43).
-- Run as the container admin (POSTGRES_USER, default ccd) against the `postgres` database:
--
--   docker compose exec -T db psql -U ccd -d postgres -v ON_ERROR_STOP=1 \
--     -v app_password="$DB_PASSWORD" < db/create_dev.sql
--
-- Safe to re-run: existing objects are kept, and the role's attributes,
-- password, owner and privileges are reset to the values below.
-- The password comes from the psql variable app_password. Never write it in this file.

\set ON_ERROR_STOP on

-- Stop if app_password is missing or empty.
\if :{?app_password}
\else
  \echo 'ERROR: pass the app password with -v app_password=...'
  SELECT 1/0 AS app_password_missing;
\endif
SELECT :'app_password' = '' AS app_password_empty \gset
\if :app_password_empty
  \echo 'ERROR: app_password is empty'
  SELECT 1/0 AS app_password_empty;
\endif

-- 1. Role: can log in, nothing else.
SELECT 'CREATE ROLE climate_app'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'climate_app') \gexec

ALTER ROLE climate_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'app_password';

-- 2. Database owned by the app role.
-- Since PostgreSQL 15, PUBLIC can no longer create objects in the `public` schema.
-- The schema is owned by pg_database_owner, i.e. whoever owns the database.
-- Making climate_app the owner therefore lets Django migrations create tables
-- in `public` without granting CREATE to anyone else.
SELECT 'CREATE DATABASE climate_dev OWNER climate_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'climate_dev') \gexec

ALTER DATABASE climate_dev OWNER TO climate_app;

-- 3. Only climate_app (and superusers) may connect to climate_dev,
-- and climate_app may not connect to the admin database ccd.
REVOKE CONNECT ON DATABASE climate_dev FROM PUBLIC;
GRANT CONNECT ON DATABASE climate_dev TO climate_app;
REVOKE CONNECT ON DATABASE ccd FROM PUBLIC;

\echo 'climate_app and climate_dev are ready.'
