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
| POST | `/auth/register/`, `/auth/login/`, `/auth/logout/` | Accounts | 400 / 401 | | 3 |
| POST | `/reports/` | Email a county report | 400 / 401 / 429 | | 3 |

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

## Caching (CCD-341, CCD-425)

`/meta/` and `/map/` are cached in Redis (`REDIS_HOST`, `REDIS_PORT` in `.env`). Saving or deleting a projection, sea level row, county or data source invalidates the cache automatically, so nothing has to be cleared after a data load. Redis is optional: if it is down, the API reads straight from the database.

Live docs (when `DEBUG` is on): `/api/docs/` (Swagger), schema at `/api/schema/`.

Every endpoint has tests for success, 404 and 400 where they apply (CCD-93).