# Entities (CCD-38)

Owner: Artur Romanov · CCD-38 · 28 Oct 2026 · input: climate_data.csv, sea_level.csv @ 7fe7a1e

The entities the database stores, built from the two pipeline outputs in `pipeline/data/processed/`. [data-model.md](data-model.md) is the summary of this design; this file has the detail. The load rules follow [data-flow.md](data-flow.md) Stage 3. Sources and licences are in [DATA_SOURCES.md](../DATA_SOURCES.md).

**Why:** the dashboard must always show scenario, baseline, period, season and unit next to a number (data-flow.md, Risk R8). So each one is stored with every projection value, or reached through a single foreign key. Nothing is left to the frontend to work out.

---

## 1. Input profile

Profiled with pandas at `7fe7a1e`.

| | `climate_data.csv` | `sea_level.csv` |
|---|---|---|
| Rows | 1,820 (910 temperature + 910 precipitation) | 405 (15 counties × 3 scenarios × 9 years) |
| Columns | `county, variable, scenario, period, season, value, unit` | `county, scenario, year, rise_cm, source` |
| Nulls | 0 in every column | 0 in every column |
| Duplicate keys | 0 on (county, variable, scenario, period, season) | 0 on (county, scenario, year) |
| `county` | 26 ROI counties | 15 coastal counties, all among the 26 |
| `scenario` | `baseline`, `rcp26`, `rcp45`, `rcp85` | `rcp26`, `rcp45`, `rcp85` |
| `period` / `year` | `1976-2005` (baseline only, 260 rows), `2021-2050`, `2071-2100` | 2020, 2030 … 2100 |
| `season` | `Annual`, `Winter`, `Spring`, `Summer`, `Autumn` | (none) |
| `value` / `rise_cm` | 4.313–17.732 degC, 178.431–1,902.279 mm, 3 dp | 6.413–75.404 cm, 3 dp |
| `unit` | `degC` (temperature), `mm` (precipitation) | (none; always cm) |
| `source` | (none) | `UKCP18`, `UKCP18, estimated from Sligo` (Leitrim), `UKCP18, estimated from Clare` (Limerick) |

## 2. Overview

```
DataSource 1 ──< ClimateProjection >── 1 County 1 ──< SeaLevelProjection >── 1 DataSource
                                                        User (Sprint 3, no links yet)
```

| Entity | Rows | Loaded from |
|---|---|---|
| County | 26 | distinct `climate_data.csv.county` |
| ClimateProjection | 1,820 | `climate_data.csv` |
| SeaLevelProjection | 405 | `sea_level.csv` |
| DataSource | 2 | seeded from DATA_SOURCES.md (lookup) |
| User | 0 | created by the app (planned, Sprint 3) |

Types are PostgreSQL. **NULL allowed** is `never` for every attribute, so a projection can't be stored without its value, unit, scenario, period, season or source. "Not applicable" is handled by a constant or a missing row, never by NULL (e.g. inland counties have no sea level rows).

Source column key: a CSV column name means the value is loaded from that column. **derived at load** means the loader computes it from the row or the file. **lookup** means it is resolved through another table, or seeded once.

---

## 3. County

One row per Republic of Ireland county.

| Attribute | DB type | Unit | NULL allowed | Allowed values | Source |
|---|---|---|---|---|---|
| `id` | `integer` PK (identity) | – | never | – | derived at load |
| `name` | `varchar(50)` UNIQUE | – | never | The 26 names: `Carlow` … `Wicklow` (see §1) | `climate_data.csv.county` |
| `slug` | `varchar(50)` UNIQUE | – | never | lower case, spaces → `-` (e.g. `cork`) | derived at load (from `name`) |
| `has_coastline` | `boolean` | – | never | `true` for the 15 counties in `sea_level.csv`, `false` for the other 11 | derived at load (county appears in `sea_level.csv`) |

`has_coastline` lets the API say "No coastline" without guessing from a missing row (variables.md §5.3).

## 4. ClimateProjection

One row per county × variable × scenario × period × season. Stores absolute values only; the API calculates the change from baseline.

| Attribute | DB type | Unit | NULL allowed | Allowed values | Source |
|---|---|---|---|---|---|
| `id` | `bigint` PK (identity) | – | never | – | derived at load |
| `county_id` | `integer` FK → County | – | never | an existing County | lookup (`County.name` = row's county) |
| `data_source_id` | `integer` FK → DataSource | – | never | `translate` | lookup (every row → TRANSLATE) |
| `variable` | `varchar(20)` | – | never | `temperature`, `precipitation` | `climate_data.csv.variable` |
| `scenario` | `varchar(10)` | – | never | `baseline`, `rcp26`, `rcp45`, `rcp85` | `climate_data.csv.scenario` |
| `period` | `varchar(9)` | – | never | `1976-2005` (only with `baseline`), `2021-2050`, `2071-2100` (only with an RCP) | `climate_data.csv.period` |
| `season` | `varchar(10)` | – | never | `annual`, `winter`, `spring`, `summer`, `autumn` | `climate_data.csv.season` (stored lower case) |
| `value` | `numeric(8,3)` | `unit` of the row | never | temperature 4–18, precipitation 170–1,950 (CCD-239 ranges, upper bound raised; see §12 #7) | `climate_data.csv.value` |
| `unit` | `varchar(10)` | – | never | `degC` with `temperature`, `mm` with `precipitation` | `climate_data.csv.unit` |

Constraints (full list, with the rows each one rejects, in §10):

- UNIQUE (`county_id`, `variable`, `scenario`, `period`, `season`), so the `update_or_create` loader can't create duplicates.
- CHECK (`scenario` = `baseline`) = (`period` = `1976-2005`).
- CHECK (`variable`, `unit`) in {(`temperature`, `degC`), (`precipitation`, `mm`)}.

## 5. SeaLevelProjection

One row per coastal county × scenario × decade. The value is already a change: the rise since the 1981–2000 mean (UKCP18, 50th percentile). The baseline is 0 cm by definition, so it has no row.

| Attribute | DB type | Unit | NULL allowed | Allowed values | Source |
|---|---|---|---|---|---|
| `id` | `bigint` PK (identity) | – | never | – | derived at load |
| `county_id` | `integer` FK → County | – | never | a County with `has_coastline = true` | lookup (`County.name` = `sea_level.csv.county`) |
| `data_source_id` | `integer` FK → DataSource | – | never | `ukcp18` | lookup (every row → UKCP18) |
| `scenario` | `varchar(10)` | – | never | `rcp26`, `rcp45`, `rcp85` | `sea_level.csv.scenario` |
| `year` | `smallint` | year | never | 2020–2100, multiples of 10 | `sea_level.csv.year` |
| `season` | `varchar(10)` | – | never | `annual` | derived at load (constant: UKCP18 is a time-mean, annual only) |
| `value` | `numeric(6,3)` | `unit` of the row | never | 0–150 (variables.md §4) | `sea_level.csv.rise_cm` |
| `unit` | `varchar(10)` | – | never | `cm` | derived at load (constant: from the `_cm` suffix of `rise_cm`) |
| `provenance` | `varchar(50)` | – | never | `UKCP18`, `UKCP18, estimated from Sligo`, `UKCP18, estimated from Clare` | `sea_level.csv.source` |

Constraints (full list, with the rows each one rejects, in §10):

- UNIQUE (`county_id`, `scenario`, `year`).
- CHECK `season` = `annual`, CHECK `unit` = `cm`, CHECK `year` % 10 = 0.

`value` and `unit` use the same names as in ClimateProjection, so the API can format both the same way. `provenance` is kept as-is so the dashboard can flag the two estimated counties.

## 6. DataSource

Lookup table, seeded once from DATA_SOURCES.md. It holds the baseline period for each projection dataset, so a projection's baseline is always one FK away. It is not taken from a CSV.

| Attribute | DB type | Unit | NULL allowed | Allowed values | Source |
|---|---|---|---|---|---|
| `id` | `integer` PK (identity) | – | never | – | lookup |
| `code` | `varchar(20)` UNIQUE | – | never | `translate`, `ukcp18` | lookup |
| `name` | `varchar(200)` | – | never | e.g. `Met Éireann TRANSLATE via EPA Climate Ireland` | lookup (DATA_SOURCES.md §1–2) |
| `organisation` | `varchar(200)` | – | never | e.g. `Met Office (UK)` | lookup |
| `baseline_period` | `varchar(9)` | – | never | `1976-2005` (translate), `1981-2000` (ukcp18) | lookup |
| `licence` | `varchar(200)` | – | never | e.g. `Open Government Licence v3.0`; `Not stated (free to use, "as is")` for TRANSLATE | lookup |
| `attribution` | `text` | – | never | the footer attribution line from DATA_SOURCES.md | lookup |
| `url` | `varchar(500)` | – | never | dataset URL | lookup |
| `accessed_on` | `date` | – | never | `2026-10-27` | lookup |

County boundaries (Tailte Éireann) are not a DataSource row: no projection points to them, and they have no baseline. Their attribution stays in the footer text.

## 7. Users

Django's built-in user model (`AbstractUser`), with one added field. Only what the app needs is stored (data-model.md). No CSV input.

| Attribute | DB type | Unit | NULL allowed | Allowed values | Source |
|---|---|---|---|---|---|
| `id` | `integer` PK (identity) | – | never | – | created by the app |
| `email` | `varchar(254)` UNIQUE | – | never | valid email address | user sign-up |
| `password` | `varchar(128)` | – | never | Django password hash (never plain text) | user sign-up |
| `first_name` | `varchar(150)` | – | never | any; `''` if not given | user sign-up |
| `last_name` | `varchar(150)` | – | never | any; `''` if not given | user sign-up |
| `email_reports` | `boolean` | – | never | `true` / `false`, default `false` | user settings |

Links to County (e.g. saved counties) are out of scope until Sprint 3 stories exist.

---

## 8. CSV → attribute mapping

Every column of both CSVs maps to exactly one attribute (CCD-38 done-when).

| CSV | Column | Entity.attribute | Load rule |
|---|---|---|---|
| `climate_data.csv` | `county` | `County.name` | distinct values create the 26 County rows. Each row then links through `ClimateProjection.county_id` (lookup) |
| `climate_data.csv` | `variable` | `ClimateProjection.variable` | as-is |
| `climate_data.csv` | `scenario` | `ClimateProjection.scenario` | as-is |
| `climate_data.csv` | `period` | `ClimateProjection.period` | as-is |
| `climate_data.csv` | `season` | `ClimateProjection.season` | lower case |
| `climate_data.csv` | `value` | `ClimateProjection.value` | as-is, 3 dp |
| `climate_data.csv` | `unit` | `ClimateProjection.unit` | as-is |
| `sea_level.csv` | `county` | `SeaLevelProjection.county_id` | lookup on `County.name`. Load fails if the name is unknown |
| `sea_level.csv` | `scenario` | `SeaLevelProjection.scenario` | as-is |
| `sea_level.csv` | `year` | `SeaLevelProjection.year` | as-is |
| `sea_level.csv` | `rise_cm` | `SeaLevelProjection.value` | as-is, 3 dp, cm |
| `sea_level.csv` | `source` | `SeaLevelProjection.provenance` | as-is |

## 9. Where the context of every projection lives

| | ClimateProjection | SeaLevelProjection |
|---|---|---|
| **Scenario** | `scenario` (from CSV) | `scenario` (from CSV) |
| **Baseline period** | **via DataSource:** `data_source_id → DataSource.baseline_period` = `1976-2005`. The baseline *values* are the rows with `scenario = baseline` | **via DataSource:** `data_source_id → DataSource.baseline_period` = `1981-2000`. No baseline rows (0 cm by definition) |
| **Period** | `period` (from CSV, 30-year window) | `year` (from CSV, single decade year) |
| **Season** | `season` (from CSV, lower case) | `season` (derived at load, always `annual`) |
| **Unit** | `unit` (from CSV) | `unit` (derived at load, always `cm`) |

The baseline period is the only one of the five that isn't a column on the projection itself. It is a property of the dataset, so storing it on 2,225 rows would only create a chance for them to disagree. It is one join away, and the API returns it with every response.

## 10. Relationships and rules

### Relationships

| Parent | Child | Cardinality | At `7fe7a1e` |
|---|---|---|---|
| County | ClimateProjection | 1–N; each projection has exactly 1 county | 70 rows per county (2 variables × 7 scenario/periods × 5 seasons), 1,820 in total |
| County | SeaLevelProjection | 1–N, where N can be 0; each projection has exactly 1 county | 27 rows per coastal county (3 scenarios × 9 years). **Inland counties have 0 rows** (11 counties) |
| DataSource | ClimateProjection | 1–N; each projection has exactly 1 source | `translate` → 1,820 rows |
| DataSource | SeaLevelProjection | 1–N; each projection has exactly 1 source | `ukcp18` → 405 rows |

User has no relationships yet (§7).

### Sea level: per county, not national

- **Decision:** sea level is stored **per county** (`SeaLevelProjection.county_id`), not as one national series.
- **Reason:** on 27 Oct 2026 (CCD-19), Eoin replaced IPCC AR6, which gives global figures only, with Met Office UKCP18. UKCP18 has location-specific values along the Irish coast, and the pipeline turns them into values for the 15 coastal counties (DATA_SOURCES.md §2, §5).
- **Consequence:** the 11 inland counties have no rows, and `County.has_coastline = false`. The API and dashboard show **"No coastline"** for them, never 0 cm (variables.md §5.3). The draft's national `/api/sea-level/` becomes a per-county field.

### Uniqueness rules

| Rule | Rejects |
|---|---|
| `County` UNIQUE (`name`) | a second `Cork` county row |
| `County` UNIQUE (`slug`) | a second county with slug `cork`, so `/api/counties/cork/` can't match two counties |
| `DataSource` UNIQUE (`code`) | a second `ukcp18` source row |
| `ClimateProjection` UNIQUE (`county_id`, `variable`, `scenario`, `period`, `season`) | a second Cork / temperature / rcp85 / 2071-2100 / annual row |
| `SeaLevelProjection` UNIQUE (`county_id`, `scenario`, `year`) | a second Cork / rcp85 / 2100 row |
| `User` UNIQUE (`email`) | a second account for the same email address |

### CHECK constraints

| Table | CHECK | Rejects |
|---|---|---|
| ClimateProjection | `variable` IN (`temperature`, `precipitation`) | a `sea_level` or `Temperature` row (sea level has its own table) |
| ClimateProjection | `scenario` IN (`baseline`, `rcp26`, `rcp45`, `rcp85`) | a `rcp60` or `unknown` scenario |
| ClimateProjection | `period` IN (`1976-2005`, `2021-2050`, `2071-2100`) | a `2041-2070` row (available from the source but out of scope) |
| ClimateProjection | `season` IN (`annual`, `winter`, `spring`, `summer`, `autumn`) | an `Annual` or `DJF` row the loader forgot to convert |
| ClimateProjection | (`scenario` = `baseline`) = (`period` = `1976-2005`) | a baseline / 2071-2100 row, or an rcp45 / 1976-2005 row |
| ClimateProjection | (`variable`, `unit`) IN ((`temperature`, `degC`), (`precipitation`, `mm`)) | a temperature row in `mm`, or a precipitation row in `degC` |
| SeaLevelProjection | `scenario` IN (`rcp26`, `rcp45`, `rcp85`) | a `baseline` sea level row (the baseline is 0 cm by definition) |
| SeaLevelProjection | `year` BETWEEN 2020 AND 2100 AND `year` % 10 = 0 | a 2045 or 2150 row |
| SeaLevelProjection | `season` = `annual` | a `winter` sea level row |
| SeaLevelProjection | `unit` = `cm` | a row in `m`, e.g. a 0.67 that should be 67 cm |

Not database constraints:

- **Coastal counties only.** "A SeaLevelProjection's county has `has_coastline = true`" spans two tables, so a CHECK can't enforce it. The loader enforces it instead, and rejects e.g. an `Offaly` sea level row.
- **Plausible value ranges** (§4, §5) are validation checks (CCD-239), not CHECKs, so a real extreme value raises a warning rather than blocking the load.

### Delete behaviour

Every foreign key is **RESTRICT / PROTECT** (Django `on_delete=models.PROTECT`): ClimateProjection → County, ClimateProjection → DataSource, SeaLevelProjection → County and SeaLevelProjection → DataSource.

**Why:** a County or DataSource can't be deleted while projections point to it. CASCADE would silently remove 70+ projection rows, or a dataset's attribution, and the dashboard would show gaps with no error. The data only changes when the pipeline re-runs, and the loader's `update_or_create` handles that, so nothing in normal use ever needs to delete a parent. A real removal has to delete the projections first, on purpose.

## 11. Design decisions

1. **Two projection tables, not one.** Climate rows are keyed by `period` + `season`, sea level by `year`. Their baselines and sources also differ. One table would need nullable columns, which this design forbids.
2. **Absolute values only.** The change from baseline is calculated in the API (data-flow.md Stage 4). Sea level is already a change, so `value` is stored as given.
3. **Units stored as the CSV has them** (`degC`, `mm`, `cm`). Then every `unit` value maps 1:1 to the CSV. The API turns `degC` into `°C` for display.
4. **Season stored lower case**, matching the API keys (`annual`, `winter`, …), per data-flow.md Stage 3.
5. **Sea level kept in cm and by decade year**, as the pipeline outputs it. No conversion to metres and no 30-year averaging at load.
6. **No NULLs.** "Not applicable" is a constant (`season = annual`) or a missing row (inland counties), never NULL.
7. **Text with CHECK constraints instead of lookup tables** for `variable`, `scenario`, `period` and `season`. The value sets are small and fixed, and this keeps the loader 1:1 with the CSV. They can be promoted to tables later if labels or colours need storing.

## 12. Contradictions found (resolved here)

| # | Where | Says | Data at `7fe7a1e` / this doc |
|---|---|---|---|
| 1 | data-model.md draft, SeaLevelProjection | `rise_m`, metres, years `2050`, `2100`, no county | `rise_cm` in cm, 9 decades 2020–2100, per county. Followed the data |
| 2 | variables.md §1–3 | `sea_level` is a `variable` row in `climate_data.csv`, with 30-year periods, ≤ 90 rows | Separate `sea_level.csv`, decade years, 405 rows. Separate entity |
| 3 | data-model.md draft, data-flow.md Stage 3 | `unit` is derived at load as `°C` / `mm` | CSV now has a `unit` column with `degC`. Loaded from the CSV as-is (decision 3) |
| 4 | data-flow.md Stage 2 example | CSV has no `unit` column | CSV has 7 columns, including `unit` |
| 5 | DATA_SOURCES.md §3, data-flow.md Stage 1 | Boundaries are CSO `ie_county_26.json` | pipeline/README.md: the Tailte Éireann file is used. DATA_SOURCES.md needs an update (not a DB change) |
| 6 | variables.md §2 | File names use `ensmid` | pipeline/README.md and data-flow.md use `ensmean`. No DB impact; flag to the pipeline owner |
| 7 | data-flow.md Validation | Precipitation 170–1,900 mm | Data max is 1,902.279 mm. The DB range in §4 uses 1,950; the CCD-239 check needs widening |
| 8 | data-flow.md Stage 4 | `/api/sea-level/` is national, "source still to be decided" | Source is UKCP18, per county (DATA_SOURCES.md §2) |
