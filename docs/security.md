# User database security (CCD-296)

Covers CCD-311 (database access), CCD-312 (personal data and privacy) and CCD-313 (deployment checks and tests). Findings are from `main` on 27 Nov 2026, updated the same evening after #90 (favourite counties, Swagger fixes), and on 28 Nov after the production deployment (#101, CCD-246). The fixes in [Changes needed in shared files](#4-changes-needed-in-shared-files) are for their owners to apply; section 4 shows which are done.

## 1. Database access rules (CCD-311)

**Rules**

1. The Django app connects with a **limited role**, never a PostgreSQL superuser. The role can `CONNECT` to the app database and `SELECT`, `INSERT`, `UPDATE`, `DELETE` on the app's tables and use their sequences. It cannot create roles or databases, and it does not own the schema.
2. **Migrations run as the schema owner** (a separate role), as a deploy step, not as the running app.
3. **The database is not reachable from the internet.** Only the backend service can connect: the host's private network or an IP allow-list, and TLS (`sslmode=require`) when it is a hosted database.
4. **Credentials only come from environment variables** (`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, read in `backend/config/settings.py`). They are never committed: `.env` is ignored, `.env.example` holds placeholders, and production values are kept in the host's secret store and GitHub Secrets ([hosting.md](hosting.md)).
5. Each environment has its own database and password. Production credentials are never used locally or in CI.

**Current state**

| Environment | DB user | Finding |
|---|---|---|
| Local (docker-compose) | `DB_USER` (`climate_admin` in `.env.example`) | `docker-compose.yml` passes `DB_USER` as `POSTGRES_USER`. The postgres image makes that user a **superuser**, and Django connects with it. Breaks rule 1. |
| Local (docker-compose) | — | Postgres is published as `"${DB_PORT:-5432}:5432"` and Redis as `"${REDIS_PORT:-6379}:6379"`. Both bind to **every interface** of the laptop, and Redis has no password. Breaks rule 3 on a shared network. |
| CI (`.github/workflows/ci.yml`) | `ccd`, the container's `POSTGRES_USER` | A superuser in a throwaway test container that only exists for the job. Acceptable for CI. |
| Production (`docker-compose.prod.yml`, since 28 Nov) | `APP_DB_USER` (`climate_app` in `.env.production.example`) | Django and the worker connect as the limited role, created on the database's first start by `deploy/postgres-init/01-app-role.sh` (`SELECT`, `INSERT`, `UPDATE`, `DELETE` on tables, `USAGE`, `SELECT` on sequences). Migrations and data loading run as the owner `DB_OWNER` (`deploy.yml`, [deployment.md](deployment.md) §3). Meets rules 1 and 2. |
| Production | — | `db` and `redis` publish no ports: only containers on the server's private Docker network reach them, and only Caddy publishes 80 and 443. Checked from outside on 28 Nov: 443 open; 5432, 6379 and 8000 closed. The database is on the same server as the backend, so there is no network hop that needs TLS. Meets rule 3. |

## 2. Privacy note (CCD-312)

**What we store and why**

| Data | Where | Why |
|---|---|---|
| Username | `users_user.username` | Sign-in and display |
| Email address | `users_user.email` (unique, lower case) | Sign-in, account emails (verify, reset password) |
| New email while it is being confirmed | `users_user.pending_email` | Moved into `email` only after the link sent to it is opened, then cleared |
| Display name (optional) | `users_user.name` | Shown in the app and in emails |
| Profile picture (optional) | File in `media/users/`, path in `users_user.avatar` | Shown on the profile, resized to 200×200 |
| Password | `users_user.password` | **Only a one-way hash** (Django's default PBKDF2). The plain password is never stored. |
| Account status | `is_verified`, `is_active`, `is_staff`, `is_superuser`, `last_login`, `date_joined` | Built into Django, needed for sign-in and the admin |
| Email links | `users_emailverification` (user, random UUID code, type, expiry, used) | One-time links that expire after an hour |
| Login session | `django_session` | Keeps the user signed in (session cookie) |
| Favourite counties | `users_user_counties` (`user_id`, `county_id`), the `User.counties` many-to-many field | The user's saved counties on the dashboard (CCD-442). Only county ids, no free text |
| Background email tasks | `django_celery_results_taskresult` | Celery records each email task. Its arguments are the user's **id** and the email type, not the address. |

We do **not** store first or last names (removed from Django's default user), phone numbers, postal addresses or location. The app asks for nothing beyond the fields above.

**What the API returns**

- Register and login return only a message, for example `{"detail": "You have signed in."}`.
- The profile (`GET /api/auth/profile/me/`) returns only the signed-in user's own `username`, `name`, `email`, `avatar`, `is_verified` and `pending_email`. Favourites (`/api/auth/favourites/`) need a login and only read or change the signed-in user's own list (`request.user.counties`). No endpoint lists users or returns another user's data.
- Every password field in the serializers is `write_only`, so no response contains a password or its hash. `backend/users/tests/test_no_password_in_responses.py` proves this (section 3).

**How a user deletes their account**

Signed in, the user sends `DELETE /api/auth/profile/me/delete/`. The app signs them out and deletes the user row. Their email links and favourite counties are deleted with it (`CASCADE`), and the profile picture file is deleted from disk (`users/signals.py`). Two things stay: Celery task records (user id and email type only) and Django admin log entries, if staff edited the account. Section 4 has the change that expires the task records.

## 3. Deployment check and tests (CCD-313)

**`python manage.py check --deploy`**, run with production-like environment variables (`DJANGO_DEBUG=False`, a random 50-character `DJANGO_SECRET_KEY`, SMTP settings set). First run, 27 Nov 2026: **10 issues**. Re-run after #90, same evening: **2 issues** (`security.W004`, `security.W008`). The 8 `drf_spectacular` warnings were fixed by Taras in `0ab9a12`.

| Warning | Meaning |
|---|---|
| `security.W004` | `SECURE_HSTS_SECONDS` is not set: browsers are not told to use HTTPS only |
| `security.W008` | `SECURE_SSL_REDIRECT` is not `True`: plain-HTTP requests are not redirected |
| ~~`drf_spectacular.W001` ×2~~ | Fixed in `0ab9a12`. Was: `CountyDetailSerializer.get_summary` had no type hint; two serializers were both named `County` |
| ~~`drf_spectacular.W002` ×6~~ | Fixed in `0ab9a12`. Was: no serializer found for `HealthView`, `MetaView`, `CsrfView`, `EmailVerificationView`, `ProfileViewSet`, `logout_view` |

Already fine: `SESSION_COOKIE_SECURE` and `CSRF_COOKIE_SECURE` are `not DEBUG`. `DEBUG` and `SECRET_KEY` come from the environment.

The check does not flag these, but they matter in production: `ALLOWED_HOSTS = ['*']`, and `debug_toolbar` is in `INSTALLED_APPS` and `MIDDLEWARE` even when `DEBUG` is off. Its URLs are only mounted when `DEBUG` is on (`config/urls.py`), so the toolbar cannot be opened in production, but the app and middleware still load. (Corrected 27 Nov: the first version said the URLs were mounted too.)

**Tests.** `backend/users/tests/test_no_password_in_responses.py` (9 tests) calls register, login, profile, change-email and change-password, on success and with a bad input. It checks that no response contains:
- a submitted password,
- any stored password hash, or a hash prefix such as `pbkdf2_sha256$`,
- a JSON key named like a password (success responses), or
- the other test user's email or username.

**CI.** The backend job runs `python manage.py test`, which includes the new tests. `check --deploy` is not in CI yet (section 4).

## 4. Changes needed in shared files

None of these are applied by this document. Each is a change to a file its owner is working on. Status checked on `main` on 28 Nov 2026.

| # | Problem | Setting or change that fixes it | File | Owner |
|---|---|---|---|---|
| 1 | `security.W004` | `SECURE_HSTS_SECONDS = 0 if DEBUG else 3600` (raise to 31536000 once HTTPS is confirmed stable), `SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG` | `backend/config/settings.py` | Taras |
| 2 | `security.W008` | `SECURE_SSL_REDIRECT = not DEBUG` and, behind the host's HTTPS proxy, `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')`. **Half done:** `SECURE_PROXY_SSL_HEADER` added in #101 (Eoin). `SECURE_SSL_REDIRECT` is still missing, so the warning stays. Caddy already redirects HTTP to HTTPS on the live site | `backend/config/settings.py` | Taras |
| 3 | ~~`drf_spectacular.W001` / `W002`~~ **Done** (`0ab9a12`, Taras) | Return type hint or `@extend_schema_field` on `get_summary`; rename one `CountySerializer` (or set `ref_name`); `serializer_class` or `@extend_schema` on the six views | `climate/serializers.py`, `climate/views.py`, `users/views.py` | Taras |
| 4 | `ALLOWED_HOSTS = ['*']` | `ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost', '127.0.0.1'])`, plus `ALLOWED_HOSTS` in `.env.example` | `backend/config/settings.py`, `.env.example` | Taras |
| 5 | Debug toolbar app and middleware load in production | Add `debug_toolbar` to `INSTALLED_APPS`/`MIDDLEWARE` only when `DEBUG` is on (the URLs already are) | `backend/config/settings.py` | Taras |
| 6 | Celery task records kept after account deletion | `CELERY_RESULT_EXPIRES = timedelta(days=1)` (with celery beat running the cleanup), or `CELERY_RESULT_EXTENDED = False` so arguments are not stored | `backend/config/settings.py` | Taras |
| 7 | `check --deploy` not in CI | Backend job step: `python manage.py check --deploy --fail-level WARNING`, after #1–#5 are merged so it passes | `.github/workflows/ci.yml` | Eoin |
| 8 | App connects as superuser (local) | Create a limited app role in an init script (`docker-entrypoint-initdb.d`); Django uses it, migrations use the owner | `docker-compose.yml`, `.env.example` | Eoin |
| 9 | ~~App database role in production~~ **Done** (#101, Eoin) | `deploy/postgres-init/01-app-role.sh` creates the limited role; `docker-compose.prod.yml` sets `DB_USER` to it; `deploy.yml` runs migrations as the owner | `docker-compose.prod.yml`, `deploy/`, `.github/workflows/deploy.yml` | Eoin |
| 10 | Postgres and Redis on every interface (local) | Publish as `"127.0.0.1:${DB_PORT:-5432}:5432"` and `"127.0.0.1:${REDIS_PORT:-6379}:6379"` | `docker-compose.yml` | Eoin |
| 11 | ~~Production database reachable only by the backend~~ **Done** (#101, Eoin) | `db` and `redis` publish no ports and sit on the private Docker network with the backend. `sslmode=require` is not needed: the database is on the same server, so traffic never leaves it | `docker-compose.prod.yml` | Eoin |

Rows 9 and 11 are based on the committed production files and the outside port check on 28 Nov. The server runs the committed `docker-compose.prod.yml`: a nested `services:` key that broke validation was fixed in #105, and the Deploy workflow has passed since.

Rows 8 and 10 are still open because #101 changed only the production compose file, not the local `docker-compose.yml`. When #1, #2, #4 and #5 are merged, run `check --deploy` again with the same variables. The expected result is `System check identified no issues`.
