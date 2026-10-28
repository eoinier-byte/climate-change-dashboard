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

Django connects with the `POSTGRES_*` values in `.env` (`POSTGRES_HOST=localhost`, `POSTGRES_PORT=5432`).

## Stop, restart and reset

| Goal | Command | Data |
|---|---|---|
| Stop the database | `docker compose stop db` | kept |
| Start it again | `docker compose up -d db` | kept |
| Remove the container | `docker compose down` | kept (the `pgdata` volume stays) |
| **Wipe everything** | `docker compose down -v` | **deleted** |

> ⚠️ **`docker compose down -v` deletes the `pgdata` volume, which means every table and row in the database.** The data can't be recovered. Only use it when you want a clean database, e.g. after changing the password or user. Then reload the data with the loader.

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
