# API guide

Base URL (local): `http://localhost:8000/api`

The full response shape, change-from-baseline rules and frontend usage are in **[data-flow.md](data-flow.md#stage-4-api-django-rest-framework)**. Keep both files in sync.

| Method | Path | Returns | Errors |
|---|---|---|---|
| GET | `/counties/` | `[{"name": "Cork", "slug": "cork"}, …]`: 26 counties, alphabetical | – |
| GET | `/counties/{slug}/` | County projections: temperature + rainfall, all seasons, scenarios, periods, seasonal table, commentary, source | 404 unknown county |
| GET | `/counties/{slug}/?variable=&season=&scenario=` | Filtered projections | 400 invalid parameter |
| GET | `/sea-level/` | Sea-level projections from Met Office UKCP18 (coastal counties only; inland counties have no value, see `docs/variables.md`) | – |
| POST | `/auth/register/`, `/auth/login/`, `/auth/logout/` | Accounts (Sprint 3) | 400 / 401 |
| POST | `/reports/` | Email a county report (Sprint 3) | 400 / 401 / 429 |

Every endpoint has tests for success, 404 and 400 (CCD-93).
