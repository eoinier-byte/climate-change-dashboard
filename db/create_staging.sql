-- Creates the staging role and database.
-- Same container as development, separate database and separate role.
-- Run as the container admin (POSTGRES_USER, default ccd) against the `postgres` database:
--
--   docker compose exec -T db psql -U ccd -d postgres -v ON_ERROR_STOP=1 \
--     -v staging_password="$STAGING_PASSWORD" < db/create_staging.sql
--
-- Safe to re-run: existing objects are kept, and the role's attributes,
-- password, owner and privileges are reset to the values below.
-- The password comes from the psql variable staging_password. Never write it in this file.

\set ON_ERROR_STOP on

-- Stop if staging_password is missing or empty.
\if :{?staging_password}
\else
  \echo 'ERROR: pass the staging password with -v staging_password=...'
  SELECT 1/0 AS staging_password_missing;
\endif
SELECT :'staging_password' = '' AS staging_password_empty \gset
\if :staging_password_empty
  \echo 'ERROR: staging_password is empty'
  SELECT 1/0 AS staging_password_empty;
\endif

-- 1. Role: can log in, nothing else.
SELECT 'CREATE ROLE climate_staging_app'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'climate_staging_app') \gexec

ALTER ROLE climate_staging_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'staging_password';

-- 2. Database owned by the staging role.
-- Since PostgreSQL 15, PUBLIC can no longer create objects in the `public` schema.
-- The schema is owned by pg_database_owner, i.e. whoever owns the database.
-- Making climate_staging_app the owner therefore lets Django migrations create tables
-- in `public` without granting CREATE to anyone else.
SELECT 'CREATE DATABASE climate_staging OWNER climate_staging_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'climate_staging') \gexec

ALTER DATABASE climate_staging OWNER TO climate_staging_app;

-- 3. Only climate_staging_app (and superusers) may connect to climate_staging.
-- climate_app gets no access here, and create_dev.sql already keeps
-- climate_staging_app out of climate_dev. Neither role may connect to the admin database ccd.
REVOKE CONNECT ON DATABASE climate_staging FROM PUBLIC;
GRANT CONNECT ON DATABASE climate_staging TO climate_staging_app;
REVOKE CONNECT ON DATABASE ccd FROM PUBLIC;

\echo 'climate_staging_app and climate_staging are ready.'
