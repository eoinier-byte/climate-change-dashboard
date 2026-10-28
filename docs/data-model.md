# Data model (CCD-33)

The final database model. This page is the summary. Every attribute's unit, allowed values and CSV source, plus the reasoning behind each choice, are in [entities.md](entities.md). Keep the two files in step: change both in the same pull request.

PostgreSQL. No column allows NULL. All foreign keys are `PROTECT`.

## County
| Field | Type | Null | Notes |
|---|---|---|---|
| id | integer PK | no | |
| name | varchar(50), unique | no | e.g. `Cork`. The 26 ROI counties, from `climate_data.csv.county` |
| slug | varchar(50), unique | no | e.g. `cork`. Lower case, spaces → `-` |
| has_coastline | boolean | no | `true` for the 15 counties in `sea_level.csv` |

## ClimateProjection
| Field | Type | Null | Notes |
|---|---|---|---|
| id | bigint PK | no | |
| county_id | FK → County | no | PROTECT |
| data_source_id | FK → DataSource | no | PROTECT. Always `translate` |
| variable | varchar(20) | no | `temperature`, `precipitation` |
| scenario | varchar(10) | no | `baseline`, `rcp26`, `rcp45`, `rcp85` |
| period | varchar(9) | no | `1976-2005` (baseline only), `2021-2050`, `2071-2100` |
| season | varchar(10) | no | `annual`, `winter`, `spring`, `summer`, `autumn` |
| value | numeric(8,3) | no | Absolute value for the period, in `unit` |
| unit | varchar(10) | no | `degC` (temperature), `mm` (precipitation) |

1,820 rows. Change from baseline is calculated in the API.

## SeaLevelProjection
| Field | Type | Null | Notes |
|---|---|---|---|
| id | bigint PK | no | |
| county_id | FK → County | no | PROTECT. Coastal counties only |
| data_source_id | FK → DataSource | no | PROTECT. Always `ukcp18` |
| scenario | varchar(10) | no | `rcp26`, `rcp45`, `rcp85` |
| year | smallint | no | 2020, 2030 … 2100 |
| season | varchar(10) | no | Always `annual` |
| value | numeric(6,3) | no | Rise since the 1981–2000 mean, from `rise_cm` |
| unit | varchar(10) | no | Always `cm` |
| provenance | varchar(50) | no | `UKCP18`, or `UKCP18, estimated from Sligo` / `… from Clare` |

405 rows (15 coastal counties × 3 scenarios × 9 years). Inland counties have no rows.

## DataSource
| Field | Type | Null | Notes |
|---|---|---|---|
| id | integer PK | no | |
| code | varchar(20), unique | no | `translate`, `ukcp18` |
| name | varchar(200) | no | |
| organisation | varchar(200) | no | |
| baseline_period | varchar(9) | no | `1976-2005` (translate), `1981-2000` (ukcp18) |
| licence | varchar(200) | no | |
| attribution | text | no | Footer line from DATA_SOURCES.md |
| url | varchar(500) | no | |
| accessed_on | date | no | |

2 rows, seeded from [DATA_SOURCES.md](../DATA_SOURCES.md). A projection's baseline period is found through this table.

## Relationships

| Parent | Child | Cardinality |
|---|---|---|
| County | ClimateProjection | 1–N (70 per county) |
| County | SeaLevelProjection | 1–N, where N can be 0 (27 per coastal county, 0 inland) |
| DataSource | ClimateProjection | 1–N |
| DataSource | SeaLevelProjection | 1–N |

Sea level is stored per county because UKCP18 (adopted in CCD-19, 27 Oct 2026) gives values for coastal locations. Inland counties show "No coastline", never 0.

## Constraints

Unique:
- County (`name`), County (`slug`), DataSource (`code`), User (`email`)
- ClimateProjection (`county_id`, `variable`, `scenario`, `period`, `season`)
- SeaLevelProjection (`county_id`, `scenario`, `year`)

Check:
- ClimateProjection: `variable`, `scenario`, `period` and `season` are each in their allowed set (above)
- ClimateProjection: (`scenario` = `baseline`) = (`period` = `1976-2005`)
- ClimateProjection: (`variable`, `unit`) is (`temperature`, `degC`) or (`precipitation`, `mm`)
- SeaLevelProjection: `scenario` in (`rcp26`, `rcp45`, `rcp85`); `year` between 2020 and 2100 and a multiple of 10; `season` = `annual`; `unit` = `cm`

Enforced by the loader, not the database: sea level rows only for counties with `has_coastline = true`. Value ranges are validation checks (CCD-239), not constraints. The bad row each rule rejects is listed in [entities.md §10](entities.md#10-relationships-and-rules).

## Delete rules

Every foreign key is `on_delete=PROTECT` (RESTRICT). A County or DataSource can't be deleted while projections refer to it. Data changes come from re-running the loader (`update_or_create`), never from deleting parents, so a cascade could only cause silent data loss.

## Conventions

- **Season** is stored lower case (`annual`, `winter`, …), matching the API keys. The loader converts the CSV's `Annual`.
- **Unit codes** are stored as the CSV has them: `degC`, `mm`, `cm`. The API shows `degC` as `°C`.
- **Scenario codes**: `baseline`, `rcp26`, `rcp45`, `rcp85`. The API adds the labels (`RCP2.6` …).
- **Absolute values only** for temperature and precipitation. Sea level is already a change from its baseline.
- **No NULLs.** "Not applicable" is a constant or a missing row.

## Planned (Sprint 3): User
Django's built-in user model (`AbstractUser`, hashed passwords). Store only what is needed: email (unique), first and last name, and `email_reports` (boolean, default `false`). No links to other tables yet.

## Changes from the draft
- Sea level is **per county** instead of national (SeaLevelProjection now has `county_id`).
- `rise_m` (metres) → `rise_cm` from the CSV, stored as `value` with `unit` = `cm`.
- Sea level years **2050 / 2100 → every decade from 2020 to 2100** (9 years).
- **DataSource** table added. It holds the baseline period, licence and attribution. The draft's free-text `source` became `provenance`.
- ClimateProjection `unit` is loaded from the CSV as `degC`, not derived as `°C`.
- County gains `has_coastline`. All columns are NOT NULL, and every FK is PROTECT.
