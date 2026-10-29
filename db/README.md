# backend/: Django REST API

Serves county climate projections from PostgreSQL to the frontend, plus user accounts and emailed reports.

**Jira:** CCD-33 DB design · CCD-43 PostgreSQL · CCD-65 Django models · CCD-60 County endpoints · CCD-84 Projection endpoints · CCD-91 Sea-level endpoint · CCD-93 API testing · CCD-294 Auth API · CCD-295 Email service

## Stack

Python 3.12 · Django · Django REST Framework · PostgreSQL (psycopg) · django-cors-headers

## Planned endpoints (see `docs/api.md`)

| Method | Path | Returns |
|---|---|---|
| GET | `/api/counties/` | List of counties |
| GET | `/api/counties/<slug>/` | County projections: temperature + rainfall, all seasons, scenarios, periods |
| GET | `/api/sea-level/` | National sea-level projections |
| POST | `/api/auth/register/`, `/api/auth/login/`, `/api/auth/logout/` | Accounts (Sprint 3) |
| POST | `/api/reports/` | Email a county report (Sprint 3) |

Every endpoint gets tests for success, 404 and 400 (CCD-93).

## Set-up (filled in by CCD-43 / CCD-65)

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```
