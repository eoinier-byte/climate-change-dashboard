# API guide

Base URL (local): `http://localhost:8000/api`

The full response shape, change-from-baseline rules and frontend usage are in **[data-flow.md](data-flow.md#stage-4-api-django-rest-framework)**. Keep both files in sync.

| Method | Path | Returns | Errors |
|---|---|---|---|
| GET | `/counties/` | `[{"id": 1, "name": "Carlow", "slug": "carlow", "has_coastline": false}, …]`: 26 counties, alphabetical | – |
| GET | `/counties/{slug}/` | County fields + `summary` for the default scenario, period and season (see below) | 404 unknown county |
| GET | `/counties/{slug}/?variable=&season=&scenario=` | Filtered projections | 400 invalid parameter |
| GET | `/sea-level/` | Sea-level projections from Met Office UKCP18, ordered by county, scenario, year. Coastal counties only; inland counties have no rows, see `docs/variables.md` | – |
| GET | `/sea-level/{id}/` | One sea-level projection | 404 unknown id |
| GET | `/meta/` | Values for the frontend filters, taken from the database (see below) | – |
| POST | `/auth/register/`, `/auth/login/`, `/auth/logout/` | Accounts (Sprint 3) | 400 / 401 |
| POST | `/reports/` | Email a county report (Sprint 3) | 400 / 401 / 429 |

Every endpoint has tests for success, 404 and 400 (CCD-93).

All climate endpoints are read-only: other methods return 405.

## `GET /counties/{slug}/`

`summary` holds the annual RCP4.5 values for 2071–2100, keyed by variable. A variable with no data is left out, so the object is `{}` until projections are loaded.

```json
{
  "id": 4,
  "name": "Cork",
  "slug": "cork",
  "has_coastline": true,
  "summary": {
    "temperature": {"value": 11.28, "units": "degC"},
    "precipitation": {"value": 1474.71, "units": "mm"}
  }
}
```

## `GET /sea-level/`

```json
[{"scenario": "rcp26", "baseline": "1981-2000", "units": "cm", "source": "ukcp18",
  "county": "clare", "year": 2050, "provenance": "UKCP18", "value": "20.725"}, …]
```

## `GET /meta/`

Distinct, sorted values from `ClimateProjection`, plus every data source. Sea-level scenarios are not included.

```json
{
  "scenarios": ["baseline", "rcp26", "rcp45", "rcp85"],
  "periods": ["1976-2005", "2021-2050", "2071-2100"],
  "seasons": ["annual", "autumn", "spring", "summer", "winter"],
  "variables": ["precipitation", "temperature"],
  "sources": [{"code": "translate", "name": "…", "organisation": "…", "licence": "…", "url": "…"}]
}
```
