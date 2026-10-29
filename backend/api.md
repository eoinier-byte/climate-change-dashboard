# TERA Project (Ireland climate futures dashboard) - API

## Basics

| | |
|---|---|
| Base URL (local) | `http://localhost:8000/api/` |
| Format | JSON only |
| Methods | `GET` only. `POST`, `PUT`, `DELETE` return `405 Method Not Allowed` |
| Auth | None (public read-only data) |
| Live docs | `/api/docs/`, schema at `/api/schema/` |

### Provenance fields

Every climate value in any response carries the same fields, so the UI can always label it:

| Field | Meaning |
|---|---|
| `scenario` | Emission scenario the value belongs to |
| `period` | Future period the projection is for |
| `baseline` | Reference period the change is measured against |
| `units` | Unit of the value, exactly as stored |
| `source` | Where the number comes from (EPA dataset) |

### Errors

| Status | When | Body |
|---|---|---|
| `400` | Invalid filter value | `{"detail": "..."}` |
| `404` | Unknown id | `{"detail": "Not found."}` |
| `405` | Any non-GET request | `{"detail": "Method \"POST\" not allowed."}` |

---

## Overview

| Method | Path | Purpose | Sprint |
|---|---|---|---|
| GET | `/api/health/` | Backend is up | 1 |
| GET | `/api/meta/` | Options for filters (scenarios, periods, …) | 1 |
| GET | `/api/counties/` | List of counties | 1 |
| GET | `/api/counties/{id}/` | One county + short summary | 1 |
| GET | `/api/projections/` | Temperature / precipitation data with filters | 2 |
| GET | `/api/sea-level/` | National sea-level rise | 2 |
| GET | `/api/counties/{id}/commentary/` | AI text about the county | 3 |
| GET | `/api/lookup/?eircode=` | Data for an Eircode (stretch goal) | 3 |

---

## Sprint 1

### `GET /api/health/`

Check that the backend is running.

```json
{ "status": "ok" }
```

### `GET /api/meta/`

Everything the filters may offer. Read from the database, so it only lists options that actually have data.
Use it to fill the dropdowns and the sources in the footer.

```json
{
  "scenarios": ["PLACEHOLDER", "PLACEHOLDER"],
  "periods": ["PLACEHOLDER", "PLACEHOLDER"],
  "seasons": ["PLACEHOLDER", "PLACEHOLDER"],
  "variables": ["PLACEHOLDER", "PLACEHOLDER"],
  "sources": ["PLACEHOLDER"]
}
```

### `GET /api/counties/`

All counties, sorted alphabetically. Use it for the county selector.

```json
[
  { "id": 1, "name": "Carlow" },
  { "id": 2, "name": "Cavan" }
]
```

### `GET /api/counties/{id}/`

One county with a short summary for the default scenario and period (chosen by the team, set in the backend).
Unknown `id` → `404`.

```json
{
  "id": 4,
  "name": "Cork",
  "summary": [
    {
      "variable": "PLACEHOLDER",
      "season": "PLACEHOLDER",
      "value": "PLACEHOLDER",
      "scenario": "PLACEHOLDER",
      "period": "PLACEHOLDER",
      "baseline": "PLACEHOLDER",
      "units": "PLACEHOLDER",
      "source": "PLACEHOLDER"
    }
  ]
}
```

---

## Sprint 2

### `GET /api/projections/`

Temperature and precipitation data for the charts. All filters are optional and can be combined.
Unknown filter value → `400`.

| Param | Example | Notes |
|---|---|---|
| `county` | `4` | County id |
| `variable` | `PLACEHOLDER` | Values from `/api/meta/` |
| `scenario` | `PLACEHOLDER` | Omit to get all scenarios (for comparison charts) |
| `period` | `PLACEHOLDER` | |
| `season` | `PLACEHOLDER` | |

Example: `/api/projections/?county=4&variable=PLACEHOLDER&period=PLACEHOLDER`

```json
[
  {
    "county": 4,
    "variable": "PLACEHOLDER",
    "season": "PLACEHOLDER",
    "baseline_value": "PLACEHOLDER",
    "projected_value": "PLACEHOLDER",
    "change": "PLACEHOLDER",
    "scenario": "PLACEHOLDER",
    "period": "PLACEHOLDER",
    "baseline": "PLACEHOLDER",
    "units": "PLACEHOLDER",
    "source": "PLACEHOLDER"
  }
]
```

Scenario comparison: request without `scenario` (or with several) and compare the rows on the frontend.

### `GET /api/sea-level/`

National sea-level rise for 2050 and 2100. Not county-specific, label it "National projection (not county-specific)".

| Param | Example | Notes |
|---|---|---|
| `scenario` | `PLACEHOLDER` | Optional. Unknown value → `400` |

```json
[
  {
    "scope": "national",
    "year": 2050,
    "value": "PLACEHOLDER",
    "scenario": "PLACEHOLDER",
    "baseline": "PLACEHOLDER",
    "units": "PLACEHOLDER",
    "source": "PLACEHOLDER"
  }
]
```

---

## Sprint 3

### `GET /api/counties/{id}/commentary/`

Plain-language AI text about the county, generated only from its stored values.
Show it labelled "AI-generated". 

### `GET /api/lookup/?eircode=...` (stretch goal)

Projections for the nearest climate grid point to an Eircode. Invalid format → `400`;
location outside the grid → "outside coverage".
