# Deployment (CCD-257)

How to deploy, redeploy and recover the Ireland Climate Futures site. The setup lives in the repository (`docker-compose.prod.yml`, `deploy/`, `frontend/Dockerfile`, `backend/Dockerfile`, `.github/workflows/deploy.yml`, `db/`). Values that only exist on the server or in GitHub are listed in [section 8](#8-host-specific-values) and are not stored in the repo.

**Status (27 Nov 2026):** live at **https://ccd-ireland.duckdns.org**, on one Google Cloud virtual machine running Docker Compose (decision in [hosting.md](hosting.md)). Every merge to `main` deploys automatically after CI passes (CCD-278 Add auto-deploy on merge to main, section 4).

## 1. What gets deployed

Everything runs on one server with `docker compose -f docker-compose.prod.yml`. Local development still uses `docker-compose.yml`.

| Service | Built from | What runs | Notes |
|---|---|---|---|
| `web` | `frontend/Dockerfile` (Node builds the React site, then `caddy:2`) | Caddy: gets the HTTPS certificate for the domain, serves the React site, sends `/api/*`, `/admin*` and `/static/*` to the backend, serves `/media/` (avatars) | The **only** service with public ports (80 and 443). `VITE_API_URL=/api` is set at build time, so the site and the API share one domain |
| `backend` | `backend/Dockerfile` (Python 3.12 slim, non-root user `app`) | On start: `collectstatic`, then `gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3` | WhiteNoise serves `/static/` (admin, Swagger, flood PNGs). Connects to the database as the **limited app user** |
| `worker` | the same image as `backend` | `celery -A config worker --loglevel=info` | **Required:** with `DJANGO_DEBUG=False` account emails are only queued, so without the worker they are never sent |
| `redis` | `redis:8.6.3` | Celery queue and the API cache | No public port |
| `db` | `postgres:16` | The database, data kept in the `pgdata` volume | No public port. On its **first** start, `deploy/postgres-init/01-app-role.sh` creates the limited app user ([security.md](security.md) §1) |

Volumes: `pgdata` (database), `redis-data`, `media` (user avatars, kept across deploys), `caddy-data` (HTTPS certificates), `caddy-config`.

## 2. Environment variables (names only)

Never commit values. On the server they live in `~/climate-change-dashboard/.env`, copied from [`.env.production.example`](../.env.production.example). Locally, `.env` is copied from [`.env.example`](../.env.example).

**Server `.env`:**

| Variable | Production value / note |
|---|---|
| `DOMAIN` | `ccd-ireland.duckdns.org` (no `https://`). Caddy uses it for the certificate |
| `DB_NAME` | `climate` |
| `DB_OWNER`, `DB_OWNER_PASSWORD` | owns the tables. Used **only** for migrations and data loading (section 3) |
| `APP_DB_USER`, `APP_DB_PASSWORD` | the limited user Django connects as (read and write rows only) |
| `DJANGO_SECRET_KEY` | long random value (`openssl rand -hex 32`), different from every other environment |
| `DJANGO_DEBUG` | `False` |
| `CORS_ALLOWED_ORIGINS` | `https://ccd-ireland.duckdns.org` (also used as `CSRF_TRUSTED_ORIGINS`) |
| `DOMAIN_NAME` | `https://ccd-ireland.duckdns.org`, used in the links of account emails |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` | SMTP. The lines must exist when `DJANGO_DEBUG=False`. **Login not set yet**, so account emails are not sent |
| `ANTHROPIC_API_KEY` | optional; empty turns the AI assistant off (empty at the moment) |
| `ASSISTANT_MODEL` | optional; default `claude-haiku-5-5` |

`docker-compose.prod.yml` sets the rest itself: `DB_HOST=db`, `DB_PORT=5432`, `DB_USER`/`DB_PASSWORD` = the app user, `REDIS_HOST=redis`, `REDIS_PORT=6379`.

**GitHub Actions secrets:** `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY` (deploy), `DISCORD_WEBHOOK_URL` (CI failure alerts).

## 3. First deployment

Done on 27 Nov 2026. Repeat these steps only to build a new server.

1. **Server.** Ubuntu 24.04 VM with ports 22, 80 and 443 open, and a static IP. Point the DuckDNS domain at that IP.
2. **Docker.** `curl -fsSL https://get.docker.com | sudo sh`, then `sudo usermod -aG docker $USER` and log in again.
3. **Code.** `git clone https://github.com/eoinier-byte/climate-change-dashboard.git` and `cd climate-change-dashboard`.
4. **Secrets.** `cp .env.production.example .env`, `chmod 600 .env`, fill in the values (section 2). If the file was edited on Windows, remove the Windows line endings: `sed -i 's/\r$//' .env`.
5. **Start.**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   docker compose -f docker-compose.prod.yml ps      # all 5 services "Up", db "healthy"
   ```
6. **Migrations.** The containers do **not** run them. Run them as the **owner**:
   ```bash
   set -a; . ./.env; set +a     # load the .env values into this shell
   docker compose -f docker-compose.prod.yml run --rm -e DB_USER="$DB_OWNER" -e DB_PASSWORD="$DB_OWNER_PASSWORD" backend python manage.py migrate
   ```
7. **Data.** Data loading also runs as the **owner**: `loaddata` resets the ID sequences, which the limited app user is not allowed to do. The processed CSVs are not inside the image, but the server is a repo checkout and `docker-compose.prod.yml` mounts `./pipeline/data` into the container at `/pipeline/data`, which is where `load_data` and `compute_analogues` look (`BASE_DIR.parent / 'pipeline'`).
   ```bash
   docker compose -f docker-compose.prod.yml run --rm -e DB_USER="$DB_OWNER" -e DB_PASSWORD="$DB_OWNER_PASSWORD" backend python manage.py loaddata data_sources worldclim_source
   docker compose -f docker-compose.prod.yml run --rm -e DB_USER="$DB_OWNER" -e DB_PASSWORD="$DB_OWNER_PASSWORD" backend python manage.py load_data
   docker compose -f docker-compose.prod.yml run --rm -e DB_USER="$DB_OWNER" -e DB_PASSWORD="$DB_OWNER_PASSWORD" backend python manage.py compute_analogues
   ```
   First load: `loaddata` installed 3 objects; `load_data` inserted 2,953 rows (1,820 climate, 405 sea level, 728 impact indicators). `compute_analogues` needs the WorldClim CSVs from CCD-355 (#98).
8. **Check** (section 6).

## 4. How a deployment is triggered

1. A pull request is merged into `main`.
2. The **CI** workflow runs on `main` (see [ci-cd.md](ci-cd.md)).
3. When CI succeeds, the **Deploy** workflow ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)) starts. It connects to the server over SSH with the deploy key and runs:
   - `git pull origin main`
   - `docker compose -f docker-compose.prod.yml up -d --build` (rebuilds only what changed and restarts it)
   - `migrate --noinput` as the owner
   - `docker image prune -f` (removes old images so the disk doesn't fill)
4. If CI fails, Deploy does not run, and the live site stays on the last good version.

Deploy by hand without a merge: GitHub → **Actions** → **Deploy** → **Run workflow**.

## 5. Redeploy by hand (on the server)

Only needed if GitHub Actions can't reach the server.

1. **Back up the database first** (section 7).
2. `ssh` in and `cd ~/climate-change-dashboard`.
3. `git pull origin main`
4. `docker compose -f docker-compose.prod.yml up -d --build`
5. If the release has new migrations, run `migrate` as the owner (section 3, step 6).
6. If the processed CSVs changed, run `load_data` and `compute_analogues` again as the owner (section 3, step 7). Both are safe to re-run: `load_data` uses `update_or_create`, and `compute_analogues` replaces each county's rows.
7. Check (section 6).

## 6. After every deployment

| Check | Expected |
|---|---|
| `docker compose -f docker-compose.prod.yml ps` | 5 services `Up`, db `healthy` |
| `GET https://ccd-ireland.duckdns.org/api/health/` | `200` |
| Open the site, pick a county | charts load from the API, not from mocks |
| Open the flood map for a coastal county | the flood PNGs load (proves static files) |
| Register a test account | the verification email arrives (proves Redis and the worker; needs the SMTP login) |
| `python manage.py check --deploy` with the production variables | only the warnings still listed in [security.md](security.md) §4 |

## 7. Back up and restore the database

The scripts in `db/` work on the server. They look for the `db` container in `docker-compose.yml` by default, so point them at the production file and use the owner:

```bash
cd ~/climate-change-dashboard
# Back up → ~/ccd-backups/<database>_<timestamp>.dump
COMPOSE_FILE=docker-compose.prod.yml PG_MODE=docker DB_USER=climate_owner db/backup.sh

# Restore into a NEW, empty database
COMPOSE_FILE=docker-compose.prod.yml PG_MODE=docker DB_USER=climate_owner db/restore.sh ~/ccd-backups/<file>.dump <empty_database>
```

`restore.sh` refuses a database that already has tables, so it can't overwrite live data. To replace production with a backup, restore into a new empty database, check the row counts, then set `DB_NAME` in `.env` to it and run `docker compose -f docker-compose.prod.yml up -d`. Details: [db/README.md](../db/README.md#backup-and-restore-ccd-272).

A dump contains the users table (emails and password hashes). Keep it outside the repository, never commit it or share it in chat or a cloud folder.

## 8. Host-specific values

No secrets are written here.

| Item | Value |
|---|---|
| Hosting platform | Google Cloud Compute Engine, project "My First Project": one VM `ccd-server`, e2-medium (2 vCPU, 4 GB), europe-west2 (London), Ubuntu 24.04, 30 GB disk. Free trial credit ($300), ends about **25 Feb 2027** |
| Public frontend URL | https://ccd-ireland.duckdns.org |
| Public backend URL | Same domain: https://ccd-ireland.duckdns.org/api/ (admin at `/admin/`) |
| Server IP | `34.142.55.196`, a reserved static IP (`ccd-ip`), so it stays the same after a restart |
| Domain / DNS | DuckDNS subdomain `ccd-ireland`, pointed at the server IP. Caddy renews the HTTPS certificate by itself |
| Where the secrets are kept | 1. `~/climate-change-dashboard/.env` on the server (chmod 600, never in git). 2. GitHub → Settings → Secrets and variables → Actions: `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`, `DISCORD_WEBHOOK_URL`. 3. DuckDNS account token, kept by Eoin |
| Who has access | **Eoin**: Google Cloud account, DuckDNS account, SSH to the server (user `eoin`, key kept on his PC only), GitHub repo admin (Secrets). **GitHub Actions**: its own deploy key, used only by the Deploy workflow. Teammates can be given SSH access by adding their **public** key to `~/.ssh/authorized_keys` on the server |
| How to redeploy | Merge to `main` (automatic after CI, section 4), or GitHub → Actions → Deploy → **Run workflow**, or by hand on the server (section 5) |
| Where Redis runs | `redis` container on the same VM, no public port |
| Where PostgreSQL runs | `db` container on the same VM, data in the `pgdata` volume, no public port |

## 9. Troubleshooting

Problems hit during the first deploy, and the fix:

| What you see | Cause | Fix |
|---|---|---|
| `: command not found` when loading `.env`, or the database gets the wrong name | `.env` was edited on Windows and has CRLF line endings | `sed -i 's/\r$//' .env`. Also save `.sh` files with **LF** line endings in PyCharm |
| db container fails at once; log says `ls: cannot open directory '/docker-entrypoint-initdb.d/': Permission denied` | `deploy/postgres-init` copied without read permission for other users | `chmod 755 deploy deploy/postgres-init deploy/postgres-init/01-app-role.sh` |
| The init script didn't run after fixing the above | It only runs when the `pgdata` volume is new | `docker compose -f docker-compose.prod.yml down -v`, then `up -d`. **Only while the database is empty**: `-v` deletes all volumes |
| `permission denied for sequence …` during `loaddata` | Ran as the limited app user | Run it as the owner (section 3, step 7) |
| Browser: `ERR_CONNECTION_TIMED_OUT` | DuckDNS still points at an old IP | `nslookup ccd-ireland.duckdns.org` must show the server IP; fix it on duckdns.org |
| `docker compose logs backend` shows `gunicorn: not found` | gunicorn missing from `requirements.txt` | Fixed in CCD-246 (#101) |