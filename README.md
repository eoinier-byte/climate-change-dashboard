# CCD: Climate Change Dashboard (Ireland Climate Futures Dashboard)

MTU group project 2026. A web app where a user picks an Irish county and sees how its **temperature, rainfall and sea level** are projected to change by 2050 and 2100 under different emissions scenarios (RCP2.6 / RCP4.5 / RCP8.5), using official EPA / Climate Ireland data explained in plain language.

> Academic prototype. We visualise published climate **projections**; we do not produce forecasts. Data © EPA / Climate Ireland, used with attribution.

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
cd pipeline && pip install -r requirements.txt && python -m process   # see pipeline/README.md

# 3. Backend API
cd backend && python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt && python manage.py migrate && python manage.py runserver

# 4. Frontend
cd frontend && npm install && npm run dev
```

Each folder's README has the details. Commands are filled in as each part is built (Sprint 1).

## Tests

```bash
cd pipeline && pytest -q
cd backend && python manage.py test
cd frontend && npm test
```

GitHub Actions runs these on every pull request (`.github/workflows/ci.yml`). A job only runs once its folder has code in it.

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

- EPA Climate Ireland Data Explorer: https://www.climateireland.ie/data-explorer/
- EPA Research 471, Updated High-resolution Climate Projections for Ireland: https://www.epa.ie/publications/research/climate-change/research-471-updated-high-resolution-climate-projections-for-ireland.php
- Sea-level rise: EPA / Climate Ireland or IPCC AR6 (source to be confirmed in Sprint 1)

## AI assistance

Parts of this project are written with AI assistants (e.g. Claude, GitHub Copilot). All AI-assisted code and documents are reviewed, tested and approved by the team member who commits them.
