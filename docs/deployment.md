# Deployment (CCD-257)

How to deploy, redeploy and recover the Ireland Climate Futures site. Everything below comes from the repository (`backend/Dockerfile`, `docker-compose.yml`, `backend/config/settings.py`, `db/`). Values that only exist on the hosting platform are listed in [section 8](#8-host-specific-values) and are not stored in the repo.

**Status (27 Nov 2026):** the hosting choice in [hosting.md](hosting.md) (Render for the frontend and backend, Neon for PostgreSQL) is still marked *proposed*, and there is no deploy workflow yet: `.github/workflows/ci.yml` only tests and builds (auto-deploy is CCD-278).

## 1. What gets deployed

| Component | Built from | What runs | Needs |
|---|---|---|---|
| Backend API | `backend/Dockerfile` (Python 3.12 slim, runs as the non-root user `app`) | On start: `python manage.py collectstatic --noinput`, then `gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3` | PostgreSQL, the backend environment variables (section 2) |
| Static files | inside the backend | WhiteNoise serves `/static/` (admin, Swagger, flood PNGs from `backend/static/flood/`), also with `DEBUG` off | nothing extra on the host |
| Background worker | the same image | `celery -A config worker --loglevel=info` (the `worker` service in `docker-compose.yml`) | Redis. **Required in production:** with `DJANGO_DEBUG=False` account emails are only queued, so without a worker they are never sent |
| Redis | `redis` image | Celery broker and the API cache | optional for the cache (the API falls back to the database), required for emails |
| PostgreSQL | `postgres:16` locally; a hosted PostgreSQL in production | the database | a limited app role, not a superuser ([security.md](security.md) §1) |
| Frontend | `frontend/`: `npm ci && npm run build` (Vite) → static files in `frontend/dist/` | any static host | `VITE_API_URL` at **build** time |

User avatars are saved to `backend/media/` on the server's disk. A host that wipes its disk on deploy or restart loses them (see [hosting.md](hosting.md), "Still open: user avatars").

## 2. Environment variables (names only)

Never commit values. Locally they live in `.env` (copied from [`.env.example`](../.env.example)); in production they are set on the host and in GitHub Secrets.

**Backend and worker** (read in `backend/config/settings.py`):

| Variable | Production value / note |
|---|---|
| `DJANGO_SECRET_KEY` | a long random value, different from every other environment |
| `DJANGO_DEBUG` | `False` |
| `DOMAIN_NAME` | the frontend's public URL; used in the links of account emails |
| `CORS_ALLOWED_ORIGINS` | the frontend's public URL (also used as `CSRF_TRUSTED_ORIGINS`) |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` | the hosted database; `DB_USER` is the limited app role |
| `REDIS_HOST`, `REDIS_PORT` | the Redis service |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` | SMTP. **Required** when `DJANGO_DEBUG=False`: settings.py reads them without a default |
| `ANTHROPIC_API_KEY` | optional; empty turns the AI assistant off |
| `ASSISTANT_MODEL` | optional; default `claude-haiku-5-5` |

**Frontend** (build time): `VITE_API_URL` (the backend's public URL). `VITE_USE_MOCKS` must be unset or `false`, otherwise the site shows mock data.

**GitHub Actions secret:** `DISCORD_WEBHOOK_URL` (CI failure alerts).

## 3. First deployment

1. **Database.** Create the database and two roles: an owner for migrations, and a limited app role for Django ([security.md](security.md) §1, rules 1–2). Allow connections only from the backend (rule 3).
2. **Backend.** Build the image from `backend/` and set the variables in section 2. On start the container collects static files and starts gunicorn on port 8000.
3. **Migrations.** The container does **not** run them. Run once, with the owner role:
   ```bash
   python manage.py migrate
   ```
4. **Data.** The processed CSVs are in `pipeline/data/processed/`, which is **not inside the backend image** (the image is built from `backend/` only, and `load_data` / `compute_analogues` look in `../pipeline/data/processed`). Run the two commands from a checkout of the repository with the `DB_*` variables pointing at the hosted database:
   ```bash
   cd backend
   python manage.py loaddata data_sources worldclim_source   # the DataSource rows (fixtures)
   python manage.py load_data
   python manage.py compute_analogues
   ```
5. **Worker and Redis.** Start Redis and the Celery worker with the same variables as the backend.
6. **Frontend.** `cd frontend && npm ci && VITE_API_URL=<backend URL> npm run build`, then publish `frontend/dist/`.
7. **Check** (section 6).

## 4. How a deployment is triggered

Today every pull request and every push to `main` runs CI (`lint`, `pipeline`, `backend`, `frontend`, `e2e`, `cpp`; see [ci-cd.md](ci-cd.md)). Nothing deploys automatically yet. When auto-deploy is added (CCD-278), the plan in [hosting.md](hosting.md) is that the host deploys `main` only after CI passes.

## 5. Redeploy by hand

1. **Back up the database first** (section 7).
2. Build and start the backend from the new `main`.
3. If the release has new migrations (`python manage.py showmigrations` shows `[ ]`), run `python manage.py migrate` with the owner role.
4. If the processed CSVs changed, run `load_data` and `compute_analogues` again (step 4 of section 3). Both are safe to re-run: `load_data` uses `update_or_create`, and `compute_analogues` replaces each county's rows.
5. Restart the worker so it runs the new code.
6. If anything in `frontend/` changed, rebuild and publish it.
7. Check (section 6).

## 6. After every deployment

| Check | Expected |
|---|---|
| `GET <backend>/api/health/` | `200` |
| `python manage.py check --deploy` with the production variables | only the warnings still listed in [security.md](security.md) §4 (none once those fixes are merged) |
| Open the site, pick a county | charts load from the API, not from mocks |
| Register a test account | the verification email arrives (proves Redis and the worker) |
| Open the flood map for a coastal county | the flood PNGs load (proves static files) |

## 7. Back up and restore the database

The scripts in `db/` work against a hosted database too: with `PG_MODE=local` they use the `pg_dump` / `pg_restore` installed on your machine over TCP to `DB_HOST:DB_PORT`. Your local `pg_dump` must be the server's version or newer. Details: [db/README.md](../db/README.md#backup-and-restore-ccd-272) and [setup.md](setup.md#backups).

```bash
# Back up (DB_* set to the hosted database, owner role)
PG_MODE=local db/backup.sh                                   # → ~/ccd-backups/<database>_<timestamp>.dump

# Restore into a NEW, empty database
PG_MODE=local db/restore.sh ~/ccd-backups/<file>.dump <empty_database>
```

`restore.sh` refuses a database that already has tables, so it can't overwrite live data. To replace production with a backup, restore into a new empty database, check the row counts, then point `DB_NAME` at it and restart the backend and the worker.

A dump contains the users table (emails and password hashes). Keep it outside the repository, never commit it or share it in chat or a cloud folder.

## 8. Host-specific values

These are set on the hosting platform and are not in the repository. Record them here, without secrets, once the platform is set up:

| Item | Value |
|---|---|
| Hosting platform(s) | proposed: Render (frontend, backend, worker) and Neon (PostgreSQL), see hosting.md |
| Public frontend URL | |
| Public backend URL | |
| Where the secrets are kept | |
| Who has access to the host accounts | |
| How to trigger a redeploy on the host | |
| Where Redis runs | |
