# Local database setup (CCD-33)

How to run the project's PostgreSQL database on your own machine. It takes about 5 minutes, and the database runs in Docker, so nothing else needs installing.

## Decision

| | |
|---|---|
| **Database** | PostgreSQL 16 (`postgres:16` image), defined in [`docker-compose.yml`](../docker-compose.yml) |
| **How it runs** | Docker Compose, one service called `db` |
| **Why** | All four of us run exactly the same PostgreSQL version on Windows, macOS and Linux, with no local PostgreSQL install to manage. The data lives in a Docker volume (`pgdata`), so it survives restarts and can be wiped with one command |

Settings come from `.env` (copied from [`.env.example`](../.env.example)). `.env` is in `.gitignore`: **never commit it.**

## Prerequisites

| OS | Install | Check |
|---|---|---|
| Windows 10/11 | [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) with the WSL 2 backend. Start Docker Desktop before running any command | Run in PowerShell: `docker --version` and `docker compose version` |
| macOS | [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/) (Apple silicon or Intel build). Start it from Applications | Run in Terminal: same two commands |
| Linux | [Docker Engine](https://docs.docker.com/engine/install/) + the Compose plugin, or Docker Desktop. On Debian/Ubuntu: `sudo apt install docker.io docker-compose` (Debian 13), or follow the Docker docs for the `docker-ce` packages | Same two commands, plus `docker info` without `sudo` (see Troubleshooting) |

You need Docker **Compose v2** (`docker compose`, with a space). The old `docker-compose` v1 isn't supported.

## Steps

Run every command from the repository root.

**1. Create `.env`** (only if you don't have one yet):

```bash
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
```

**2. Set your own database password.** Open `.env` and replace `change-me` in `POSTGRES_PASSWORD=` with a password of your choice. Do this **before** the first start: PostgreSQL only reads the password when it creates the database (see "Changed the password after the first start" below).

**3. Start the database:**

```bash
docker compose up -d db
```

The first run downloads the `postgres:16` image (about 150 MB). Expected output ends with:

```
 ✔ Volume "climate-change-dashboard_pgdata"    Created
 ✔ Container climate-change-dashboard-db-1     Started
```

**4. Wait until it accepts connections:**

```bash
docker compose exec db pg_isready -U ccd -d ccd
```

Expected: `/var/run/postgresql:5432 - accepting connections`. If it prints `no response`, wait a few seconds and run it again. The first start takes longer while the database is created.

**5. Check the version:**

```bash
docker compose exec db psql -U ccd -d ccd -c "SELECT version();"
```

Expected (the minor version may differ):

```
                                   version
------------------------------------------------------------------------------
 PostgreSQL 16.x (Debian 16.x-1.pgdg120+1) on x86_64-pc-linux-gnu, compiled by gcc ...
(1 row)
```

`-U ccd -d ccd` are the defaults from `.env`. If you changed `POSTGRES_USER` or `POSTGRES_DB`, use your values.

`POSTGRES_*` in `.env` is the container admin. The app connects with the separate `DB_*` values (see "Connecting from Python" below).

## App role and development database

The app doesn't use the admin user `ccd`. [`db/create_dev.sql`](../db/create_dev.sql) creates:

| Object | Settings | Why |
|---|---|---|
| Role `climate_app` | `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE` | Django only needs to log in and manage its own tables |
| Database `climate_dev` | `OWNER climate_app` | Since PostgreSQL 15, only the database owner can create tables in the `public` schema. Owning the database is what lets Django migrations run |
| `CONNECT` on `climate_dev` | revoked from `PUBLIC`, granted to `climate_app` | Other roles can't connect to the app database |
| `CONNECT` on `ccd` | revoked from `PUBLIC` | `climate_app` can't connect to the admin database |

The script is safe to re-run. It never drops anything. On every run, it resets the role's settings and password, the database owner and the `CONNECT` rights.

**1. Choose the app password and keep it in a shell variable.** It is passed to psql as a variable, so it never appears in the SQL file or on screen.

```bash
read -rs -p "climate_app password: " DB_PASSWORD; echo
```

```powershell
# Windows PowerShell
$DB_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host -AsSecureString 'climate_app password')).Password
```

**2. Run the script** with the database running (step 3 above). It goes in through stdin, so `docker-compose.yml` doesn't change:

```bash
docker compose exec -T db psql -U ccd -d postgres -v ON_ERROR_STOP=1 -v app_password="$DB_PASSWORD" < db/create_dev.sql
```

```powershell
# Windows PowerShell
Get-Content db/create_dev.sql | docker compose exec -T db psql -U ccd -d postgres -v ON_ERROR_STOP=1 -v app_password="$DB_PASSWORD"
```

Expected output, first run:

```
CREATE ROLE
ALTER ROLE
CREATE DATABASE
ALTER DATABASE
REVOKE
GRANT
REVOKE
climate_app and climate_dev are ready.
```

On later runs, the `CREATE ROLE` and `CREATE DATABASE` lines are missing, because both already exist. If `app_password` is missing or empty, the script stops with `ERROR: ...` before it changes anything.

**3. Check it.** `climate_app` can create a table in `climate_dev`:

```bash
docker compose exec -e PGPASSWORD="$DB_PASSWORD" db psql -h 127.0.0.1 -U climate_app -d climate_dev -c "CREATE TABLE t(x int); DROP TABLE t;"
```

Expected: `CREATE TABLE` then `DROP TABLE`. The same role can't connect to `ccd`:

```bash
docker compose exec -e PGPASSWORD="$DB_PASSWORD" db psql -h 127.0.0.1 -U climate_app -d ccd -c "SELECT 1;"
```

Expected: `FATAL:  permission denied for database "ccd"` and `DETAIL:  User does not have CONNECT privilege.`

## Staging database


[`db/create_staging.sql`](../db/create_staging.sql) is the same script as `create_dev.sql`, but for `climate_staging` / `climate_staging_app`, and the password comes from the psql variable `staging_password`. It is safe to re-run in the same way.

| Name | User | Location | Purpose | Who uses it |
|---|---|---|---|---|
| `ccd` | `ccd` (superuser) | Docker container `db`, your machine | Admin database, created by the image. Used only to run the setup scripts | Whoever sets up the container |
| `climate_dev` | `climate_app` | Docker container `db`, your machine | Day-to-day development: migrations, loading the CSVs, running the API locally | Each developer, on their own machine |
| `climate_staging` | `climate_staging_app` | Docker container `db`, your machine (hosted later: Epic 8) | A clean copy for testing migrations and full data loads before a demo or merge, without touching dev data | Each developer before a demo or merge; later the deployment pipeline |

Each user can only connect to its own database: `climate_app` can't open `climate_staging`, and `climate_staging_app` can't open `climate_dev` or `ccd`.

**1. Choose the staging password** (different from the dev one):

```bash
read -rs -p "climate_staging_app password: " STAGING_PASSWORD; echo
```

```powershell
# Windows PowerShell
$STAGING_PASSWORD = [System.Net.NetworkCredential]::new('', (Read-Host -AsSecureString 'climate_staging_app password')).Password
```

**2. Run the script:**

```bash
docker compose exec -T db psql -U ccd -d postgres -v ON_ERROR_STOP=1 -v staging_password="$STAGING_PASSWORD" < db/create_staging.sql
```

```powershell
# Windows PowerShell
Get-Content db/create_staging.sql | docker compose exec -T db psql -U ccd -d postgres -v ON_ERROR_STOP=1 -v staging_password="$STAGING_PASSWORD"
```

The expected output is the same as for dev, ending with `climate_staging_app and climate_staging are ready.`

**3. Check that the two are independent.** Both commands must fail:

```bash
docker compose exec -e PGPASSWORD="$DB_PASSWORD" db psql -h 127.0.0.1 -U climate_app -d climate_staging -c "SELECT 1;"
docker compose exec -e PGPASSWORD="$STAGING_PASSWORD" db psql -h 127.0.0.1 -U climate_staging_app -d climate_dev -c "SELECT 1;"
```

Expected: `FATAL:  permission denied for database "climate_staging"` and then `"climate_dev"`, each followed by `DETAIL:  User does not have CONNECT privilege.`

## Connecting from Python

`.env` has two sets of credentials:

| Variables | Who | Used by |
|---|---|---|
| `POSTGRES_*` | Container admin (`ccd`, superuser) | `docker-compose.yml`, CI, and running `db/create_*.sql` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | App user (`climate_app` or `climate_staging_app`) | Django, `db/check_connection.py` |

If your `.env` was created before the `DB_*` block existed, copy that block from `.env.example`. Set `DB_PASSWORD` to the password you gave `create_dev.sql`, and keep `DB_PORT` the same as `POSTGRES_PORT`.

[`db/connection.py`](../db/connection.py) turns the `DB_*` values into a connection URL (`build_database_url`) or Django's `DATABASES["default"]` dict (`django_database_config`). It raises `ValueError` naming every missing or empty variable, and rejects a port that isn't a number from 1 to 65535. Special characters in the password (`@`, `/`, `:`) are URL-encoded.

**1. Install** (in a virtual environment):

```bash
pip install -r db/requirements.txt
```

**2. Check the dev connection:**

```bash
python db/check_connection.py
```

Expected:

```
current_database: climate_dev
current_user:     climate_app
version:          PostgreSQL 16.x (Debian 16.x-1.pgdg120+1) on x86_64-pc-linux-gnu, ...
```

**3. Check staging** by overriding only the environment variables. Values set in the shell win over `.env`:

```bash
DB_NAME=climate_staging DB_USER=climate_staging_app DB_PASSWORD="$STAGING_PASSWORD" python db/check_connection.py
```

```powershell
# Windows PowerShell
$env:DB_NAME="climate_staging"; $env:DB_USER="climate_staging_app"; $env:DB_PASSWORD=$STAGING_PASSWORD
python db/check_connection.py
Remove-Item Env:DB_NAME, Env:DB_USER, Env:DB_PASSWORD
```

Expected: `current_database: climate_staging` and `current_user: climate_staging_app`.

Exit codes: `0` connected, `1` connection failed (server down, wrong password, no `CONNECT` right), `2` missing or invalid `DB_*` settings.

**4. Unit tests** (no database needed):

```bash
pytest db -q
```

## Backups

Each developer's database lives only in the Docker volume on their own machine, so a wrong reload, migration or `docker compose down -v` loses it. A dump taken first gets it back in a minute. Scripts and the exact `pg_dump` command: [db/README.md](../db/README.md#backup-and-restore-ccd-272) (CCD-272).

| | |
|---|---|
| **Where** | `~/ccd-backups/` on your own machine, **outside the repository**: `<database>_<YYYY-MM-DD_HHMMSS>.dump`. Use `BACKUP_DIR` for another folder outside the repo; the script refuses a folder inside it. Never commit a dump or upload it to a shared drive, chat or cloud folder: it contains the `users` table (emails and password hashes). The files are mode 600, readable only by you |
| **Who** | Whoever is about to change the data takes the dump, on the machine where the change happens: the developer running the loader or the migration on their own `climate_dev`, or the person preparing `climate_staging` before a demo or merge. Later, the deployment pipeline does this for the hosted database (Epic 8) |
| **When** | **Before every data reload** (`python manage.py load_data`), before `python manage.py migrate` when a migration changes or removes existing tables, before `docker compose down -v`, and before a demo |
| **Keep** | The last 5 dumps per database. Delete older ones by hand: `ls -t ~/ccd-backups/climate_dev_*.dump \| tail -n +6 \| xargs -r rm` |

**Take a dump** (database running, from the repository root):

```bash
db/backup.sh                    # climate_dev (DB_NAME in .env)
db/backup.sh climate_staging    # another database
```

Expected: `Saved /home/<you>/ccd-backups/climate_dev_2026-11-12_173000.dump (108K, data for 14 tables)`.

**Restore into an empty database** (to check a dump, or to compare an old copy with the current one):

```bash
docker compose exec db createdb -U <DB_USER from .env> climate_restore
db/restore.sh ~/ccd-backups/climate_dev_2026-11-12_173000.dump climate_restore
```

Expected: `Restored 14 tables into climate_restore`. The script refuses a database that already has tables, so it can never overwrite data.

**Restore test (CCD-272), 13 November 2026, Artur Romanov.** `db/backup.sh` dumped `climate_dev` to `~/ccd-backups/climate_dev_2026-11-13_185529.dump` (64K, data for 14 tables, mode 600), and `db/restore.sh` restored it into the empty `climate_restore` ("Restored 14 tables into climate_restore"). Row counts in the two databases:

| Table | climate_dev | climate_restore |
|---|---|---|
| climate_county | 26 | 26 |
| climate_climateprojection | 1,820 | 1,820 |
| climate_sealevelprojection | 405 | 405 |
| climate_datasource | 2 | 2 |
| users_user | 0 | 0 |
| django_migrations | 21 | 21 |

All match. Compare them yourself after a restore with `docker compose exec -T db psql -U <DB_USER> -d <database> -Atc "select count(*) from <table>"`.

**Recover `climate_dev` itself.** Stop the Django server first, then replace the database with an empty one and restore into it. This deletes the current `climate_dev`, so take a dump of it first if it might still be useful:

```bash
docker compose exec db dropdb -U <DB_USER> climate_dev
docker compose exec db createdb -U <DB_USER> climate_dev
db/restore.sh ~/ccd-backups/climate_dev_2026-11-12_173000.dump climate_dev
```

## Stop, restart and reset

| Goal | Command | Data |
|---|---|---|
| Stop the database | `docker compose stop db` | kept |
| Start it again | `docker compose up -d db` | kept |
| Remove the container | `docker compose down` | kept (the `pgdata` volume stays) |
| **Wipe everything** | `docker compose down -v` | **deleted** |

> ⚠️ **`docker compose down -v` deletes the `pgdata` volume, which means every table and row in every database (`ccd`, `climate_dev` and `climate_staging`), plus the roles.** The data can't be recovered. Only use it when you want a clean database, e.g. after changing the password or user. Take a dump first (`db/backup.sh`, see "Backups"), then reload the data with the loader.

The service uses `restart: unless-stopped`, so after `up` it starts again with Docker until you stop it.

## Troubleshooting

**Port 5432 is already in use.** `up` fails with `Bind for 0.0.0.0:5432 failed: port is already allocated` or `address already in use`. Usually a PostgreSQL installed on your machine is already using the port. Set a free port in `.env`:

```
POSTGRES_PORT=5433
```

Then run `docker compose up -d db` again. Django reads the same `POSTGRES_PORT`, so nothing else changes. `docker compose exec` commands are unaffected, because they connect inside the container. To see what is using the port: `ss -ltnp | grep 5432` (Linux), `lsof -i :5432` (macOS), or `netstat -ano | findstr 5432` (Windows).

**`permission denied while trying to connect to the Docker daemon socket`** (Linux). Your user isn't in the `docker` group. Run:

```bash
sudo usermod -aG docker $USER
```

Then **log out and back in** (or run `newgrp docker` in the current terminal). Check with `docker info`. Note that the `docker` group gives root-level access to the machine.

**`Cannot connect to the Docker daemon` / `error during connect`** (Windows, macOS). Docker Desktop isn't running. Start it and wait for "Engine running".

**Changed the password after the first start.** The new password in `.env` is ignored, because the database already exists in the volume. Either change it inside the database:

```bash
docker compose exec db psql -U ccd -d ccd -c "ALTER USER ccd PASSWORD 'your-new-password';"
```

or wipe the volume with `docker compose down -v` (deletes all data, see the warning above) and run `up` again.

**`password authentication failed for user "ccd"`** (from Django or a database client). The password in `.env` doesn't match the one the database was created with. See the previous point.

**Container keeps restarting.** Check the logs with `docker compose logs db`.
