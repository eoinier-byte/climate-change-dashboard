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
| GET | `/flood/` | Coastal counties that have a flood map, sorted by name (same shape as `/counties/`) | 405 for POST | CCD-360, CCD-362 | 3 |
| GET | `/flood/{slug}/` | Flood map of one county: bounds and one PNG layer per sea level, 0–2 m; see [Flood maps](#flood-maps-ccd-360) | 404 no flood map for this county | CCD-360, CCD-362 | 3 |
| GET, POST | `/auth/...` | Accounts, profile, email links: see [Accounts](#accounts-ccd-294-ccd-427-ccd-441) below | 400 / 403 / 404 / 409 / 410 | CCD-294, CCD-427, CCD-441 | 3 |
| POST | `/reports/` | Email a county report | 400 / 403 / 429 | | 3 |
| POST | `/agent/chat/` | AI assistant (Boreas): answers a question about the data, streamed as NDJSON events; see [AI assistant](#ai-assistant-ccd-347) | 400 invalid history or context; 429 over the limit | CCD-347, CCD-349, CCD-351 | 3 |

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

## Flood maps (CCD-360)

The flood layers come from the C++ flood engine ([flood-engine.md](flood-engine.md)): 15 coastal counties, each with 21 transparent PNG layers for sea levels 0–2 m in 0.1 m steps. They live in `backend/static/flood/<slug>/` (`level_000.png` … `level_200.png` and `index.json`) and are served as static files; Python reads only `index.json`.

`GET /api/flood/cork/`

```json
{
  "slug": "cork",
  "bounds": [[51.4097, -10.2768], [52.3908, -7.8400]],
  "cell_size_m": 90.0,
  "levels": [
    { "level_m": 0.0, "url": "http://localhost:8000/static/flood/cork/level_000.png", "flooded_cells": 3145, "flooded_area_km2": 25.4745 },
    { "level_m": 0.1, "url": "http://localhost:8000/static/flood/cork/level_010.png", "flooded_cells": 3332, "flooded_area_km2": 26.9892 }
  ],
  "attribution": "produced using Copernicus WorldDEM-90 …",
  "model_limits": "Indicative only: still-water 'bathtub' model …"
}
```

- `bounds` are `[[south, west], [north, east]]` in WGS84, the corners of each PNG: pass them to Leaflet's `ImageOverlay` as they are. The PNGs are in Web Mercator.
- `level_m` is the rise above **today's** sea level. The sea level projections (`/sea-level/`) are in cm above the 1981–2000 average, so the frontend has to pick the layer that matches a projection.
- `flooded_area_km2` counts only land inside the county.
- `attribution` and `model_limits` should be shown with the map.
- The `0 m` layer already shows some flooded land (about 380 km² over the 15 counties), most likely low ground below 0 m in the elevation data and its error. Show the change from it, or label it, rather than presenting it as flooding today.
- The slug is not case-sensitive. A county with no flood map (inland, or unknown) is a 404.
- To rebuild the layers, see [flood-engine.md](flood-engine.md) §11 (`--out backend/static/flood`). On the live site, `/static/` must be served by WhiteNoise or the host, because Django does not serve static files when `DEBUG` is off.

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

## AI assistant (CCD-347)

`POST /api/agent/chat/` answers questions about the projections in plain words. Claude (model in `ASSISTANT_MODEL` in `.env`, default `claude-haiku-5-5`) answers only from our data: it calls three read-only tools over the database and never quotes numbers from its own knowledge.

### Request

```json
{
  "messages": [
    { "role": "user", "content": "How much warmer will Cork get?" },
    { "role": "assistant", "content": "About 0.8 °C around mid-century..." },
    { "role": "user", "content": "And under high emissions?" }
  ],
  "context": { "county": "galway", "variable": "precipitation" }
}
```

- **`messages`**: the whole conversation. The server keeps no history, so the frontend sends every earlier message each time. Roles are `user` and `assistant` only; at most 20 messages, each at most 500 characters; the last one must be from the user.
- **`context`** (optional): what the person is looking at on the dashboard. `county` is a slug from `/counties/`, `variable` is `temperature` or `precipitation`. It is passed to Claude as a short note, so "here" or "this county" refer to that county.
- Anonymous users need no CSRF header. A signed-in user sends `X-CSRFToken`, like every other POST.

### Response

`200`, `Content-Type: application/x-ndjson`: one JSON event per line, sent while Claude writes. Read it with `fetch` and `response.body.getReader()` (`EventSource` cannot POST).

```
{"type": "tool", "name": "get_projections", "input": {"county": "cork", "variable": "temperature"}}
{"type": "text", "text": "From up where the north wind flies, "}
{"type": "text", "text": "Cork looks a little warmer..."}
{"type": "done", "sources": [{"name": "TRANSLATE climate projections", "url": "https://www.climateireland.ie/data-explorer/"}], "map_action": {"variable": "temperature", "season": "annual", "scenario": "rcp45", "period": "2021-2050"}}
```

| Event | Fields | Meaning |
|---|---|---|
| `tool` | `name`, `input` | Claude is looking up data; can be shown as a status line ("Checking Cork…") |
| `text` | `text` | The next piece of the answer; append it to the message |
| `done` | `sources`, `map_action` | The answer is complete. `sources` lists the data sources of the tools used (`[]` when no data was needed). `map_action` is the map view the answer is about (`variable`, `season`, `scenario`, `period`, the same parameters as `/map/`) for a "Show on map" button, or `null` |
| `error` | `text` | The answer could not be finished (API error, timeout, refusal, cut off). `text` is a friendly message to show; no `done` follows |

The answer itself has no source line: the frontend shows `sources` under it.

### Tools

| Tool | Arguments | Data |
|---|---|---|
| `get_projections` | `county`, `variable`, `season` (default `annual`) | Every scenario and period for one county, with change from baseline, units and source |
| `get_sea_level` | `county` | Sea level rise for every scenario, 2020–2100, in cm |
| `rank_counties` | `variable`, `season`, `scenario`, `period`, `limit`, `asc` | Counties ordered by change from baseline |
| `show_on_map` | `variable`, `season`, `scenario`, `period` | No data: Claude calls it for temperature and rainfall answers, and its arguments become `map_action` in `done`. It is not sent as a `tool` event |

County names are matched without regard to case. An unknown county, period or other invalid argument comes back to Claude as a readable error (for example with the list of valid counties), so it can correct the call.

### For the chat panel (CCD-371)

The backend does not know which page the person is on and keeps no conversation. The chat panel has to send both with every question:

1. **History.** Keep every user and assistant message in the panel's state (or `localStorage`, to survive a reload) and send the whole list each time, with the new question last. Store the assistant message as the joined `text` events.
2. **Page context.** On a county page (`/county/:slug`), send `context: {"county": slug, "variable": <the variable on screen>}`; leave `context` out on other pages. The panel lives in `Layout`, not in the page, so the county page should put its current slug and variable in a shared React context (or store) that the panel reads when it sends a question. Without it, "here" or "this county" mean nothing to the assistant and it asks which county.
3. **Reading the stream.** `fetch` with `credentials: 'include'`, then read `response.body.getReader()` line by line and parse each line as JSON. Show `tool` as a status line, append `text` to the answer, and on `done` show `sources` as links under it. On `error`, show its `text`.
4. **Show on map.** If `done.map_action` is not `null`, show a "Show on map" button that opens the map with those four values (`variable`, `season`, `scenario`, `period`, the same as `/map/`). The home map keeps its filters in component state today, so it needs a way to receive them, for example query parameters on `/` or the same shared context.
5. **Limits.** A signed-out person gets 429 after 3 questions an hour, with `detail` starting "Sign in to keep chatting with Boreas."; show a sign-in link there. Signed-in users send `X-CSRFToken`, like every POST.

### Behaviour and cost

- The system prompt (`ai_agent/agent.py`) gives the assistant the Boreas persona, keeps it to Irish climate projections, declines off-topic questions and weather forecasts, and answers for one default case (medium emissions, mid-century, whole year) unless the person asks for another.
- At most 6 model turns per question, 4,000 output tokens per turn, low effort, 30 s timeout. The system prompt and tools are cached between calls (`cache_control`).
- Every question writes one log line to the `ai_agent.agent` logger: outcome, time, tools used and token counts, including cached tokens. The text of the conversation is not logged.

## Rate limits (CCD-351)

Over a limit the API returns **429** with the wait time in `detail`. The limits are in `THROTTLE_RATES` in Django settings and are stored in the Redis cache (if Redis is down, they are not enforced). Tests run with every limit off.

| Scope | Endpoints | Limit | Counted by |
|---|---|---|---|
| `burst` | every endpoint without its own limit | 120 / minute | user, or IP when signed out |
| `chat_anon` | `/agent/chat/`, signed out | 3 / hour | IP; the 429 says `Sign in to keep chatting with Boreas.` |
| `chat_user` | `/agent/chat/`, signed in | 20 / hour | user |
| `login` | `/auth/login/` | 5 / minute | IP |
| `register` | `/auth/register/` | 5 / hour | IP |
| `email` | `/auth/recovery/`, `/auth/profile/me/change-email/` | 3 / hour | IP or user |
| `password` | `/auth/profile/me/change-password/` | 5 / hour | user |

## Caching (CCD-341, CCD-425)

`/meta/` and `/map/` are cached in Redis (`REDIS_HOST`, `REDIS_PORT` in `.env`). Saving or deleting a projection, sea level row, county or data source invalidates the cache automatically, so nothing has to be cleared after a data load. Redis is optional: if it is down, the API reads straight from the database.

Live docs (when `DEBUG` is on): `/api/docs/` (Swagger), schema at `/api/schema/`.

Every endpoint has tests for success, 404 and 400 where they apply (CCD-93).