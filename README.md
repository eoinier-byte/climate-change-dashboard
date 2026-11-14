# CCD: Climate Change Dashboard (Ireland Climate Futures Dashboard)

[![CI](https://github.com/eoinier-byte/climate-change-dashboard/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/eoinier-byte/climate-change-dashboard/actions/workflows/ci.yml)

MTU group project 2026. A web app where a user picks an Irish county and sees how its **temperature, rainfall and sea level** are projected to change by 2050 and 2100 under different emissions scenarios (RCP2.6 / RCP4.5 / RCP8.5), using official EPA / Climate Ireland data explained in plain language.

> Academic prototype. We visualise published climate **projections**; we do not produce forecasts. Data from EPA Climate Ireland / Met Éireann TRANSLATE, Met Office UKCP18 and Tailte Éireann, used with attribution.

**Data sources:** see [DATA_SOURCES.md](DATA_SOURCES.md) for every dataset used, its licence and required attribution.

- **Jira:** project `CCD` (backlog, sprints, Planning Poker). Story IDs in this repo (e.g. `CCD-25`) refer to Jira issues.
- **Confluence:** Product Goal, Assumptions, Scope, Stakeholders, Risk Assessment (space `SCRUM`).

## Repository layout

| Folder | What | Owner |
|---|---|---|
| `pipeline/` | Python data processing: raw EPA NetCDF/CSV → county averages → CSV/JSON, then load into PostgreSQL | Data lead (Eoin) |
| `backend/` | Django + Django REST Framework API: counties, projections, sea level, auth, email reports | Backend lead |
| `frontend/` | React + Chart.js dashboard: county selector, charts, scenario comparison, auth pages | Frontend lead |
| `docs/` | Architecture, data model, API guide, sprint documentation | All |
| `.github/` | CI workflow and pull-request template | All |

## Architecture

```
EPA / Climate Ireland raw data ──► pipeline/ (Pandas, Xarray, GeoPandas)
                                        │  county averages
                                        ▼
                                   PostgreSQL
                                        │
                                        ▼
                         backend/ Django REST API  ──►  frontend/ React + Chart.js
```

## Run it locally

Needs Python 3.12+, Node 22+, and Docker (for PostgreSQL).

```bash
# 1. Database
cp .env.example .env            # then fill in values; never commit .env
docker compose up -d db

# 2. Data pipeline (once raw data is downloaded into pipeline/data/raw/)
cd pipeline && pip install -r requirements.txt && python 08_sea_level_json_to_csv.py && python process_climate_data.py   # see pipeline/README.md

# 3. Backend API
cd backend && python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt && python manage.py migrate && python manage.py runserver

# 4. Frontend
cd frontend && npm install && npm run dev
```

Each folder's README has the details. Commands are filled in as each part is built (Sprint 1).

## Tests

```bash
cd pipeline && python -m compileall -q .   # syntax check; pipeline tests are CCD-100
cd backend && python manage.py test
cd frontend && npm test
```

Before pushing frontend changes, also run `npm run lint` (CI runs it before the tests).

## CI/CD

GitHub Actions runs the **CI** workflow ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) on every pull request and every push to `main`. The badge at the top shows whether `main` is passing.

| Job | Checks |
|---|---|
| `lint` | Python lint and formatting (ruff) |
| `pipeline` | Pipeline scripts compile; pipeline tests |
| `backend` | Django tests against a fresh PostgreSQL |
| `frontend` | ESLint, build, Vitest tests |
| `cpp` | C++ flood engine build and tests, Python binding tests |
| `notify` | Posts to the team's Discord channel if any job fails |

A pull request can only be merged into `main` when all five checks are green and one teammate has approved it (branch protection). Deployment on merge (CCD-278) is not set up yet.

**When CI fails:** open the link in the Discord message (or **Details** next to the red ✗ on the PR), click the red job, then the red step, and read the `##[error]` lines at the bottom. Fix it on the same branch and push; CI runs again by itself. Full guide, with common errors and how to re-run a job: [docs/ci-cd.md](docs/ci-cd.md).

## Rules for everyone

- Work on a branch named after the Jira issue, e.g. `feature/CCD-25-process-raw-data`, open a pull request, and get **one review before merging to `main`** (Definition of Done).
- Put the Jira key in commit messages (`CCD-25: add county aggregation`) so commits show up on the Jira issue.
- Never commit `.env`, passwords, API keys or raw data files. Copy `.env.example`.
- Read `docs/data-model.md` before changing models and `docs/api.md` before calling the API.

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Team

| Name | Role |
|---|---|
| Eoin Ryan | Product Owner, climate data pipeline |
| Taras Ivanysenko | [to confirm] |
| Ronel Mombo | [to confirm] |
| Artur Romanov | [to confirm] |

## Data sources

Full details, licences and footer attribution are in [DATA_SOURCES.md](DATA_SOURCES.md). In short:

- **Temperature and rainfall:** Met Éireann TRANSLATE projections (CMIP5; baseline, RCP2.6/4.5/8.5) from the EPA Climate Ireland Data Explorer: https://www.climateireland.ie/data-explorer/
- **Sea level:** Met Office UKCP18 time-mean sea level projections (RCP2.6/4.5/8.5, coastal counties). This replaces IPCC AR6, decided 27 Oct 2026 (CCD-19).
- **County boundaries:** Tailte Éireann, Counties – National Statutory Boundaries – 2019 – Generalised 20m (CC BY 4.0). Replaced the CSO `ie_county_26.json` on 28 Oct 2026

Dataset review: [docs/data-review.md](docs/data-review.md) · Column specification: [docs/variables.md](docs/variables.md) · County rules: [docs/county-rules.md](docs/county-rules.md) · Data flow: [docs/data-flow.md](docs/data-flow.md) · API: [docs/api.md](docs/api.md)

## AI assistance

Parts of this project are written with AI assistants (e.g. Claude, GitHub Copilot). All AI-assisted code and documents are reviewed, tested and approved by the team member who commits them.