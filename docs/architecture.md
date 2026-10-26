# Architecture

| Layer | Tech | Responsibility |
|---|---|---|
| Data pipeline | Python, Pandas, Xarray, GeoPandas | Process EPA NetCDF/CSV, aggregate to counties, load PostgreSQL |
| Database | PostgreSQL | County projections, sea level, users |
| API | Django + DRF | REST endpoints, auth (hashed passwords), email reports |
| Frontend | React + Chart.js | Dashboard, charts, scenario comparison |
| CI | GitHub Actions | Tests and build on every pull request |

## Request flow

1. User selects a county in React.
2. React calls `GET /api/counties/<slug>/`.
3. Django queries PostgreSQL and returns JSON (values, units, scenario, period, baseline).
4. React renders the charts and commentary.

The architecture diagram for the interim report goes here (export from draw.io and commit the PNG + source).
