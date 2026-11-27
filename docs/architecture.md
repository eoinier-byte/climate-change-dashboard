# Architecture

| Layer | Tech | Responsibility |
|---|---|---|
| Data pipeline | Python, Pandas, Xarray, GeoPandas | Process EPA NetCDF/CSV, aggregate to counties, load PostgreSQL |
| Database | PostgreSQL | County projections, sea level, users, email links |
| API | Django + DRF | REST endpoints, session auth with CSRF, profile and avatars, email links ([api.md](api.md#accounts-ccd-294-ccd-427-ccd-441)) |
| AI assistant | Anthropic API (Claude Haiku 5.5), `anthropic` SDK tool runner | `/api/agent/chat/`: answers questions from the database through three read-only tools and streams the answer ([api.md](api.md#ai-assistant-ccd-347)) |
| Background jobs | Celery worker + Redis | Sends account and report emails outside the request (`worker` service in `docker-compose.yml`) |
| Cache | Redis | `/meta/` and `/map/` responses and rate-limit counters ([api.md](api.md#rate-limits-ccd-351)); optional |
| Frontend | React + Chart.js | Dashboard, charts, scenario comparison |
| CI | GitHub Actions | Tests and build on every pull request |

## Request flow

1. User selects a county in React.
2. React calls `GET /api/counties/<slug>/`.
3. Django queries PostgreSQL and returns JSON (values, units, scenario, period, baseline).
4. React renders the charts and commentary.

The architecture diagram for the interim report goes here (export from draw.io and commit the PNG + source).
