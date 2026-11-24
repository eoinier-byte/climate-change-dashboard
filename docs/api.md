# API guide

Base URL (local): `http://localhost:8000/api`

The response shapes, change-from-baseline rules and frontend usage are in **[data-flow.md](data-flow.md#stage-4-api-django-rest-framework)**. Keep both files in sync. This is the only API document; the backend links here.

**Decisions (29 Oct 2026, Eoin as PO with Taras):**
- Counties are addressed by **slug** (`cork`), not id.
- Endpoints follow the Jira stories: county list and detail (CCD-61, CCD-62), meta (CCD-63), projections (CCD-84) and sea level (CCD-91) are separate.
- The county summary shows the **baseline (1976–2005), annual** values. The defaults are kept in Django settings.

| Method | Path | Returns | Errors | Jira | Sprint |
|---|---|---|---|---|---|
| GET | `/health/` | `{"status": "ok"}` | – | CCD-60 | 1 |
| GET | `/counties/` | `[{"name": "Cork", "slug": "cork", "has_coastline": true}, …]`: 26 counties, alphabetical | 405 for POST | CCD-61 | 1 |
| GET | `/counties/{slug}/` | One county + summary: present-day (baseline 1976–2005) annual temperature and precipitation, with units and source | 404 unknown county | CCD-62 | 1 |
| GET | `/meta/` | Filter options read from the database: variables, scenarios, periods, seasons, sea level years, sources | – | CCD-63 | 1 |
| GET | `/projections/?county={slug}&variable=&season=&scenario=` | Full chart data for one county: values and change from baseline for every scenario and period, seasonal table, commentary. Only `county` is required | 400 missing `county` or invalid filter; 404 unknown county | CCD-84 | 2 |
| GET | `/sea-level/{slug}/` | Sea level rise, every 10 years 2020–2100, one series per scenario, from Met Office UKCP18. Inland county: `has_coastline: false` and an empty `series` | 404 unknown county | CCD-91 | 2 |
| GET | `/map/?variable=&scenario=&period=&season=` | Choropleth data: one value per county for the given combination, sorted by county name, plus `unit`, `min` and `max` for the legend. All four parameters are required | 400 missing or invalid parameter (lists the allowed values) | CCD-338 | 2 |
| GET, POST | `/auth/...` | Accounts, profile, email links: see [Accounts](#accounts-ccd-294-ccd-427-ccd-441) below | 400 / 403 / 404 / 409 / 410 | CCD-294, CCD-427, CCD-441 | 3 |
| POST | `/reports/` | Email a county report | 400 / 403 / 429 | | 3 |

## `/map/` (CCD-338)

`GET /api/map/?variable=temperature&scenario=rcp45&period=2021-2050&season=annual`

```json
{
  "variable": "temperature",
  "scenario": "rcp45",
  "period": "2021-2050",
  "season": "annual",
  "unit": "degC",
  "min": "0.900",
  "max": "1.600",
  "results": [
    { "county": { "name": "Carlow", "slug": "carlow", "has_coastline": false }, "value": "1.600", "unit": "degC" },
    { "county": { "name": "Cork", "slug": "cork", "has_coastline": true }, "value": "1.200", "unit": "degC" }
  ]
}
```

- Parameters are checked against the values in the database, the same ones `/meta/` returns. A value that exists in the enums but has no data (e.g. `scenario=baseline` with a future period) is a 400, not an empty list.
- A valid combination with no rows returns 200 with `results: []` and `unit`, `min`, `max` as `null`.
- Values are decimal strings, like the rest of the API. Use `slug` to match a county to its map shape.

Error example (`?variable=wind&scenario=rcp45&period=2021-2050`; every bad or missing parameter is listed, a missing one shows as `None`):

```json
{
  "variable": "Invalid variable: wind. Valid variables are: precipitation, temperature",
  "season": "Invalid season: None. Valid seasons are: annual, autumn, spring, summer, winter"
}
```

## Accounts (CCD-294, CCD-427, CCD-441)

**Session auth with CSRF.** There are no tokens. Login sets the `sessionid` cookie, and every request that changes something (POST, PUT, PATCH, DELETE) must send the `X-CSRFToken` header with the value of the `csrftoken` cookie.

- Call `GET /auth/csrf/` once when the app starts: it sets the `csrftoken` cookie.
- Send every API call with credentials (`fetch(..., { credentials: 'include' })`). The React dev server origin must be in `CORS_ALLOWED_ORIGINS` in `.env`.
- A request without a session, or without the CSRF header, gets **403**. The API never answers 401.
- Every message is in `detail`, and field errors come under the field name: `{"email": ["A user with this email already exists."]}`.

| Method | Path | Body | Success | Errors | Jira |
|---|---|---|---|---|---|
| GET | `/auth/csrf/` | – | 200, sets the `csrftoken` cookie | – | CCD-302 |
| POST | `/auth/register/` | `username`, `email`, `password`, `password2` | 201, signs the user in and sends the verification email | 400 | CCD-301, CCD-393 |
| POST | `/auth/login/` | `login` (username or email), `password` | 200, sets the session | 400 `Invalid login or password.` | CCD-302 |
| POST | `/auth/logout/` | – | 200 | 403 | CCD-302 |
| POST | `/auth/recovery/` | `email` | 200, the same answer whether or not the email is registered | 400 invalid email | CCD-430 |
| GET | `/auth/reset/{user_id}/{code}/` | – | 200 if the reset link can be used; the link is not used up | 404 unknown, 410 used or expired | CCD-430 |
| POST | `/auth/reset/{user_id}/{code}/` | `new_password`, `new_password2` | 200, password set, every reset link of the user used up | 400, 404, 410 | CCD-430 |
| POST | `/auth/verify/{user_id}/{code}/` | – | 202, email verified (registration) or new email saved (email change) | 404 unknown, 409 email taken in the meantime, 410 used or expired | CCD-393, CCD-431 |
| GET | `/auth/profile/me/` | – | 200, the signed-in user's profile | 403 | CCD-303 |
| PATCH, PUT | `/auth/profile/me/update/` | `username`, `name` | 200, the profile | 400, 403 | CCD-303 |
| PATCH, PUT | `/auth/profile/me/change-avatar/` | multipart, field `avatar` | 200, `{"avatar": "<url>"}` | 400, 403 | CCD-428 |
| DELETE | `/auth/profile/me/delete-avatar/` | – | 204 | 403 | CCD-445 |
| PATCH, PUT | `/auth/profile/me/change-password/` | `old_password`, `new_password`, `new_password2` | 200, the user stays signed in; other sessions are signed out | 400, 403 | CCD-429 |
| PATCH, PUT | `/auth/profile/me/change-email/` | `email` | 202, `{"email": "<new>", "detail": …}`; the link goes to the new address | 400, 403 | CCD-431 |
| DELETE | `/auth/profile/me/delete/` | – | 204, signs out and deletes the account with its avatar | 403 | CCD-445 |

The profile endpoints work on the signed-in user only. There is no user id in their URLs, and `/auth/profile/` and `/auth/profile/{id}/` do not exist (404).

### Profile

```json
{
  "username": "alice",
  "name": "Alice Smith",
  "email": "alice@example.com",
  "avatar": "http://localhost:8000/media/users/avatar.jpg",
  "is_verified": true,
  "pending_email": null
}
```

`email`, `avatar`, `is_verified` and `pending_email` are read-only in `me/update/`; they change only through their own endpoints.

### Links sent by email

One `EmailVerification` row per email: a one-time UUID `code`, a type, an expiry (1 hour) and a `used` flag. The email links to a **frontend** page, `DOMAIN_NAME` + path + `/{user_id}/{code}`; the page then calls the API:

| Email | Frontend page | API the page calls |
|---|---|---|
| After registration | `/verify-email/{user_id}/{code}` | `POST /auth/verify/{user_id}/{code}/` |
| After a new email is requested (sent to the new address) | `/email-updated/{user_id}/{code}` | `POST /auth/verify/{user_id}/{code}/` |
| Password reset | `/recovery/{user_id}/{code}` | `GET`, then `POST /auth/reset/{user_id}/{code}/` |

- **Email change:** the current email stays until the link is opened. Until then the new one is in `pending_email`. A newer request makes the earlier change links unusable.
- A password-reset code is not accepted by `/auth/verify/`, and a verification code is not accepted by `/auth/reset/`.
- Emails are sent by a Celery worker (CCD-437). With `DJANGO_DEBUG=True` they are sent at once and printed to the `runserver` console, so no mail server or worker is needed locally.

### Passwords

Django's password validators run on registration, reset and change: at least 8 characters, not too common, not only digits, not too similar to the username or email. Mismatched passwords come under `new_password` (`password` on registration); the validator messages come under `non_field_errors`.

### Avatars

- JPG, PNG or HEIC/HEIF (iPhone photos), at least 100×100 px, up to 50 MB.
- Larger images are cropped to 200×200 from the centre; smaller ones are kept as they are. HEIC/HEIF is saved as JPEG, because only Safari can show HEIC.
- Uploading a new avatar or deleting the account removes the old file.
- Files are stored in `backend/media/users/` and served at `/media/` while `DEBUG` is on. Storage in production is still open (CCD-428, see [hosting.md](hosting.md)).

## Caching (CCD-341, CCD-425)

`/meta/` and `/map/` are cached in Redis (`REDIS_HOST`, `REDIS_PORT` in `.env`). Saving or deleting a projection, sea level row, county or data source invalidates the cache automatically, so nothing has to be cleared after a data load. Redis is optional: if it is down, the API reads straight from the database.

Live docs (when `DEBUG` is on): `/api/docs/` (Swagger), schema at `/api/schema/`.

Every endpoint has tests for success, 404 and 400 where they apply (CCD-93).