# backend/: Django REST API

Serves county climate projections from PostgreSQL to the frontend, plus user accounts and emailed reports.

**Jira:** CCD-33 DB design · CCD-43 PostgreSQL · CCD-65 Django models · CCD-60 County endpoints · CCD-84 Projection endpoints · CCD-91 Sea-level endpoint · CCD-93 API testing · CCD-294 Auth API · CCD-295 Email service

## Stack

Python 3.12 · Django · Django REST Framework · PostgreSQL (psycopg) · django-cors-headers

## Planned endpoints (see `docs/api.md`)

| Method | Path | Returns |
|---|---|---|
| GET | `/api/counties/` | List of counties |
| GET | `/api/counties/<slug>/` | County projections: temperature + rainfall, all seasons, scenarios, periods |
| GET | `/api/sea-level/` | National sea-level projections |
| POST | `/api/auth/register/`, `/api/auth/login/`, `/api/auth/logout/` | Accounts (Sprint 3) |
| POST | `/api/reports/` | Email a county report (Sprint 3) |

Every endpoint gets tests for success, 404 and 400 (CCD-93).

## Set-up (filled in by CCD-43 / CCD-65)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

## Backup and restore (CCD-272)

Policy (where dumps go, who takes them, when): [docs/setup.md, "Backups"](../docs/setup.md#backups).

| Script | What it does |
|---|---|
| `db/backup.sh [database]` | Dumps `DB_NAME` (or the database given) to `~/ccd-backups/<database>_<YYYY-MM-DD_HHMMSS>.dump`, outside the repository. Set `BACKUP_DIR` to use another folder outside the repo |
| `db/restore.sh <dump-file> <target-database>` | Restores a dump into an **existing, empty** database. Refuses a database that already has tables |

Both read `DB_*` from `.env` (shell variables win). Run them from Git Bash or WSL on Windows.

### The pg_dump command

`backup.sh` runs `pg_dump` in **custom format** (compressed, restored with `pg_restore`). When the compose `db` container is running, it uses the tools inside the container, so their version always matches the server:

```bash
docker compose exec -T db pg_dump -U "$DB_USER" --dbname="$DB_NAME" --format=custom > ~/ccd-backups/climate_dev_2026-11-12_173000.dump
```

Without Docker it uses the locally installed tools over TCP, with the password from `DB_PASSWORD`:

```bash
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" --dbname="$DB_NAME" --format=custom > ~/ccd-backups/climate_dev_2026-11-12_173000.dump
```

The script then checks the dump with `pg_restore --list` and only keeps it if it reads back completely. The file is written as `.partial` first and gets mode 600 (readable only by you), because it contains the `users` table.

`restore.sh` runs:

```bash
pg_restore -U "$DB_USER" --dbname=<target> --no-owner --no-privileges --single-transaction --exit-on-error < <dump-file>
```

- `--no-owner --no-privileges`: the restored tables belong to the user running the restore, so a dev dump can go into another database (e.g. `climate_staging`).
- `--single-transaction --exit-on-error`: all or nothing. If one statement fails, the target stays empty.

**Client version.** The local tools must have the same **major** version as the server (16). `pg_restore` 17 can't restore into a 16 server (`unrecognized configuration parameter "transaction_timeout"`), and `pg_restore` 16 can't read a dump written by `pg_dump` 17. Both scripts check this and stop with an error. Force a mode with `PG_MODE=docker` or `PG_MODE=local`.

### Create an empty target database

```bash
docker compose exec db createdb -U <DB_USER from .env> climate_restore
```

With the current `docker-compose.yml`, `DB_USER` is the container's admin user, so it can create databases.
