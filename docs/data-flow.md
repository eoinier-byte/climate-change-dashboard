# Climate data flow: from raw files to the dashboard

**Read this before you touch the data, the database models, the API or the charts.** It is the contract between the pipeline, the backend and the frontend. If you change a column name, a unit or a JSON field, update this document in the same pull request.

| You are working on… | Read |
|---|---|
| Data pipeline (CCD-16, 25, 31, 40, 239) | Stages 1–2, Validation |
| Database / Django models (CCD-33, 43, 65, 67) | Stages 2–3 |
| REST API (CCD-60, 84, 93) | Stages 3–4 |
| React dashboard / charts (CCD-126, 140, 148, 155, 162) | Stages 4–5 |
| Interim / final report | Overview, Limitations |

## Overview

```
 Stage 1                 Stage 2                    Stage 3              Stage 4                 Stage 5
 Raw NetCDF  ──────►  process_climate_data.py ──►  PostgreSQL   ──────►  Django REST API  ─────►  React + Chart.js
 (EPA / Climate        grid cells → county          County,               computes "change       county dashboard
  Ireland, 70 files)   averages → climate_data.csv  ClimateProjection     from baseline"         and charts
                       (1,820 rows)                 (1,820 rows)          returns JSON
 + UKCP18 sea level    sea points → coastal county  SeaLevelProjection
   (JSON, by hand)     → sea_level.csv (405 rows)   (405 rows)
```

The values are climate-model **projections** (averages over 30-year periods; sea level every 10 years), not forecasts.

---

## Stage 1: Source data

**Source:** EPA Climate Ireland Data Explorer, Met Éireann TRANSLATE high-resolution CMIP5 projections (O'Brien & Nolan, 2023). **Ensemble mean** files, meaning the average of several climate models. Sea level comes separately from Met Office UKCP18. See [DATA_SOURCES.md](../DATA_SOURCES.md).

| | |
|---|---|
| Variables | `tmean` = mean air temperature (°C) · `tot_prec` = total precipitation (mm, total for the season or year) |
| Scenarios | `baseline` (historical), `rcp26`, `rcp45`, `rcp85` (low, medium, high emissions) |
| Periods | `1976-2005` (baseline only), `2021-2050`, `2071-2100` (scenarios only) |
| Seasons | `ANNUAL`, `DJF` winter, `MAM` spring, `JJA` summer, `SON` autumn |
| Files | 2 variables × (1 baseline + 3 scenarios × 2 periods) × 5 seasons = **70 NetCDF files** |

Folder layout and file names (the pipeline reads the variable, scenario, period and season from the file name, using `pipeline/filename_info.py`):

```
pipeline/data/raw/
  temperature/
    baseline/tmean_CMIP5_baseline_1976-2005_ANNUAL.nc
    rcp45/tmean_CMIP5_rcp45_2071-2100_ensmean_final_DJF.nc
    ...
  precipitation/
    baseline/tot_prec_CMIP5_baseline_1976-2005_JJA.nc
    rcp85/tot_prec_CMIP5_rcp85_2021-2050_ensmean_final_SON.nc
    ...
  sea_level/
    ukcp18_sea_level_ireland.json   # UKCP18, downloaded by hand
    ukcp18_sea_level_ireland.csv    # made by pipeline step 08
pipeline/data/boundaries/counties_tailte_eireann_2019.geojson   # 26 county polygons, Tailte Éireann (used)
pipeline/data/boundaries/ie_county_26.json                      # old CSO file, kept for steps 05-06 only
```

Raw files are **not committed** to Git (large and re-downloadable). Record where and when you downloaded them in [`DATA_SOURCES.md`](../DATA_SOURCES.md).

---

## Stage 2: Processing and county aggregation

Script: `pipeline/process_climate_data.py` (CCD-25 / CCD-31). How each step was decided is in `pipeline/README.md`; the county rules are in [county-rules.md](county-rules.md).

For **each** NetCDF file:

1. Read the scenario, period, season and variable from the path and file name.
2. Open the file with Xarray and take the single time step (`isel(time=0)`). Each file holds one 30-year average.
3. Read the value of every **land cell**. The land cells come from the temperature baseline file and are used for all 70 files, matched by row and column (the rainfall baseline has a wider mask that includes a strip of sea; see data-review §4). Empty cells are dropped.
4. Load the county boundaries **once**: Tailte Éireann 2019, already in `EPSG:4326` like the climate grid, **26 counties**. Cells in Northern Ireland fall in no county and are left out.
5. **Spatial join (done once for all files):** each land-cell centre is assigned to the county polygon it falls inside (`geopandas.sjoin`, `intersects`). A cell on a border keeps its first match. 63,611 of 77,226 land cells are matched.
6. **County value = simple mean** of all grid cells inside the county, rounded to 3 decimals.

Output: `pipeline/data/processed/climate_data.csv` (and `.json`), **one row per county × variable × scenario × period × season**.

| Column | Type | Allowed values | Example |
|---|---|---|---|
| `county` | text | 26 county names (`Carlow` … `Wicklow`) | `Cork` |
| `variable` | text | `temperature`, `precipitation` | `temperature` |
| `scenario` | text | `baseline`, `rcp26`, `rcp45`, `rcp85` | `rcp85` |
| `period` | text | `1976-2005`, `2021-2050`, `2071-2100` | `2071-2100` |
| `season` | text | `Annual`, `Winter`, `Spring`, `Summer`, `Autumn` | `Annual` |
| `value` | decimal | °C for temperature, mm for precipitation | `12.522` |
| `unit` | text | `degC`, `mm` | `degC` |

```csv
county,variable,scenario,period,season,value,unit
Cork,temperature,baseline,1976-2005,Annual,9.815,degC
```

(The Cork numbers in the examples below come from the earlier CSO-boundary run, so they differ slightly from the current CSV. The shape is what matters.)

**Expected size:** 26 counties × 2 variables × 7 scenario/period combinations × 5 seasons = **1,820 rows**. The CSV stores **absolute values only**. Changes are calculated later (Stage 4), so there is one source of truth.


### Sea level (UKCP18)

Same script, section 4. Input: `pipeline/data/raw/sea_level/ukcp18_sea_level_ireland.csv` (made by step 08 from the hand-downloaded JSON).

1. Keep the 50th percentile only (`rcp26_50`, `rcp45_50`, `rcp85_50`).
2. Each sea point goes to its **nearest county within 15 km** (distance measured in `EPSG:2157`, metres). Points off Northern Ireland, Scotland and Wales are dropped. That gives 13 coastal counties.
3. **Leitrim** uses Sligo's points and **Limerick** uses Clare's (estimates, marked in `source`), making **15 coastal counties**.
4. County value = mean of its points, for every decade 2020–2100.

Output: `pipeline/data/processed/sea_level.csv` (and `.json`), **one row per coastal county × scenario × year**: 15 × 3 × 9 = **405 rows**.

| Column | Type | Allowed values | Example |
|---|---|---|---|
| `county` | text | 15 coastal counties | `Cork` |
| `scenario` | text | `rcp26`, `rcp45`, `rcp85` (no baseline: it is 0 cm by definition) | `rcp85` |
| `year` | integer | `2020`, `2030` … `2100` | `2100` |
| `rise_cm` | decimal | cm since the 1981–2000 average | `75.404` |
| `source` | text | `UKCP18`, or `UKCP18, estimated from Sligo` / `… from Clare` | `UKCP18` |

Validation of the county averages: `pipeline/10_validate_county_averages.py` → [validation-log.md](validation-log.md) (CCD-36).

---

## Stage 3: Loading into PostgreSQL

The two CSVs are loaded into the tables below. The full field list, constraints and the `DataSource` table are in [data-model.md](data-model.md) (CCD-33).

**`climate_data.csv` → `County` + `ClimateProjection`**

| CSV | Database | Rule |
|---|---|---|
| `county` | `County.name` (+ `slug` = lower case, spaces → `-`) | 26 rows, created if missing |
| `variable` | `ClimateProjection.variable` | stored as-is |
| `scenario` | `ClimateProjection.scenario` | stored as-is |
| `period` | `ClimateProjection.period` | stored as-is |
| `season` | `ClimateProjection.season` | stored **lower case** (`annual`, `winter`, …) |
| `value` | `ClimateProjection.value` | `DecimalField(max_digits=8, decimal_places=3)` |
| `unit` | `ClimateProjection.unit` | stored as-is (`degC`, `mm`); the API shows `°C` |

Rules:

- **Unique together:** (county, variable, scenario, period, season), so a reload can never create duplicates.
- **Loading is repeatable:** a Django management command (planned: `python manage.py load_climate_data data/processed/climate_data.csv`) uses `update_or_create`, so it can be re-run safely after the pipeline changes.
- Baseline rows exist only for `1976-2005`. Scenario rows exist only for `2021-2050` and `2071-2100`.

**`sea_level.csv` → `SeaLevelProjection`**

| CSV | Database | Rule |
|---|---|---|
| `county` | `SeaLevelProjection.county` (FK) | also sets `County.has_coastline = true` for these 15 |
| `scenario` | `SeaLevelProjection.scenario` | stored as-is |
| `year` | `SeaLevelProjection.year` | `2020`–`2100`, every 10 |
| `rise_cm` | `SeaLevelProjection.value` | `unit` = `cm`, `season` = `annual` |
| `source` | `SeaLevelProjection.provenance` | stored as-is |

Unique together: (county, scenario, year). 405 rows.

---

## Stage 4: API (Django REST Framework)

The API reads absolute values from the database and **calculates the change from baseline**. The frontend never recalculates it.

### Change rules

| Variable | Change | Unit | Rounding |
|---|---|---|---|
| Temperature | `future − baseline` | °C | 2 decimals |
| Precipitation | `(future − baseline) ÷ baseline × 100` | % | 1 decimal |

The baseline is always the **same county, same season, 1976–2005**.

### Endpoints

Agreed 29 Oct 2026 (Eoin, Taras): counties are addressed by **slug**, and the endpoints follow the Jira stories.

| Method | Path | Returns | Errors | Jira |
|---|---|---|---|---|
| GET | `/api/health/` | `{"status": "ok"}` | – | CCD-60 |
| GET | `/api/counties/` | `[{"name": "Cork", "slug": "cork", "has_coastline": true}, …]` (26, alphabetical) | 405 for POST | CCD-61 |
| GET | `/api/counties/{slug}/` | One county + a short **summary**: present-day (baseline) annual values (below) | 404 unknown county | CCD-62 |
| GET | `/api/meta/` | The filter options, read from the database (below) | – | CCD-63 |
| GET | `/api/projections/?county={slug}&variable=&season=&scenario=` | Full chart data for one county: values and change for every scenario and period (below) | 400 missing `county` or invalid filter; 404 unknown county | CCD-84 (Sprint 2) |
| GET | `/api/sea-level/?county={slug}` | Sea level rise for one county, every 10 years (below) | 400 missing `county`; 404 unknown county | CCD-91 (Sprint 2) |
| GET | `/api/map/?variable=&scenario=&period=&season=` | One value per county for the home page choropleth; shape in [api.md](api.md#map-ccd-338) | 400 missing or invalid parameter | CCD-338 (Sprint 2) |

Only `county` is required for `/projections/`. Leaving out `variable`, `season` or `scenario` returns all of them.

### `GET /api/counties/cork/` (CCD-62)

The summary shows the county's **present-day climate**: the **baseline (1976–2005), annual** values. These defaults live in Django settings, not in the view (`SUMMARY_SCENARIO = "baseline"`, `SUMMARY_PERIOD = "1976-2005"`, `SUMMARY_SEASON = "annual"`).

```json
{
  "name": "Cork",
  "slug": "cork",
  "has_coastline": true,
  "summary": {
    "scenario": "baseline",
    "period": "1976-2005",
    "season": "annual",
    "temperature": { "value": 9.82, "unit": "°C" },
    "precipitation": { "value": 1368.8, "unit": "mm" }
  },
  "source": "Met Éireann TRANSLATE via EPA Climate Ireland, CMIP5 ensemble mean, county-averaged grid cells"
}
```

### `GET /api/meta/` (CCD-63)

Every list is read from the database (distinct values), never hard-coded.

```json
{
  "variables": ["precipitation", "temperature"],
  "scenarios": ["baseline", "rcp26", "rcp45", "rcp85"],
  "periods": ["1976-2005", "2021-2050", "2071-2100"],
  "seasons": ["annual", "autumn", "spring", "summer", "winter"],
  "sea_level_years": [2020, 2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100],
  "sources": [
    { "code": "translate", "name": "Met Éireann TRANSLATE", "baseline_period": "1976-2005" },
    { "code": "ukcp18", "name": "Met Office UKCP18 sea level", "baseline_period": "1981-2000" }
  ]
}
```

The frontend puts labels on these codes (e.g. `rcp45` → "RCP4.5, mid action", `winter` → "Winter").

### `GET /api/projections/?county=cork` (CCD-84, real values from an earlier CSV run, shortened)

```json
{
  "county": "Cork",
  "slug": "cork",
  "periods": ["1976-2005", "2021-2050", "2071-2100"],
  "period_labels": ["Baseline (1976–2005)", "Mid-century (2021–2050)", "End-century (2071–2100)"],
  "units": {
    "temperature":   { "unit": "°C", "change_unit": "°C" },
    "precipitation": { "unit": "mm", "change_unit": "%" }
  },
  "temperature": {
    "annual": {
      "baseline": 9.81,
      "series": {
        "rcp26": { "label": "RCP2.6", "values": [9.81, 10.52, 10.54], "change": [0, 0.71, 0.73] },
        "rcp45": { "label": "RCP4.5", "values": [9.81, 10.62, 11.28], "change": [0, 0.80, 1.47] },
        "rcp85": { "label": "RCP8.5", "values": [9.81, 10.71, 12.52], "change": [0, 0.90, 2.71] }
      }
    },
    "winter": { "...": "same shape" },
    "spring": { "...": "" }, "summer": { "...": "" }, "autumn": { "...": "" }
  },
  "rainfall": {
    "annual": {
      "baseline": 1366.16,
      "series": {
        "rcp85": { "label": "RCP8.5", "values": [1366.16, 1402.49, 1474.71], "change": [0, 2.7, 7.9] }
      }
    }
  },
  "seasonal_table": { "period": "2071-2100", "rows": [
    { "season": "Winter", "scenarios": {
        "rcp26": { "temperature_change": 0.71, "rainfall_change_pct": 10.5 },
        "rcp45": { "temperature_change": 1.47, "rainfall_change_pct": 13.3 },
        "rcp85": { "temperature_change": 2.63, "rainfall_change_pct": 22.0 } } }
  ]},
  "commentary": ["By 2071–2100, Cork's average annual temperature is projected to rise by 0.7°C under RCP2.6 and 2.7°C under RCP8.5, compared with 1976–2005."],
  "source": "Met Éireann TRANSLATE via EPA Climate Ireland, CMIP5 ensemble mean, county-averaged grid cells"
}
```

Each `values` / `change` array has **three points in `periods` order**. Every scenario line starts at the shared baseline, so the chart lines join up.

Because the data never changes between pipeline runs, responses can be cached.

### `GET /api/sea-level/?county=cork` (real values from `sea_level.csv`, shortened)

```json
{
  "county": "Cork",
  "slug": "cork",
  "has_coastline": true,
  "unit": "cm",
  "baseline_period": "1981-2000",
  "years": [2020, 2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100],
  "series": {
    "rcp26": { "label": "RCP2.6", "values": [9.61, 14.01, 18.45, 22.83, 27.07, 31.2, 35.15, 39.0, 42.7] },
    "rcp45": { "label": "RCP4.5", "values": ["..."] },
    "rcp85": { "label": "RCP8.5", "values": [10.34, 15.52, 21.62, 28.63, 36.53, 45.36, 54.81, 64.86, 75.4] }
  },
  "provenance": "UKCP18",
  "source": "Met Office UKCP18 time-mean sea level, 50th percentile, nearest coastal points"
}
```

For an inland county (e.g. `?county=offaly`): `"has_coastline": false` and `"series": {}`. The frontend shows "No coastline", never 0. For Leitrim and Limerick, `provenance` says the values are estimated from Sligo or Clare, and the frontend should show that.

---

## Stage 5: Frontend (React + Chart.js)

| UI element | Data used |
|---|---|
| County dropdown | `GET /api/counties/` → `name` (label), `slug` (URL) |
| County summary card | `GET /api/counties/{slug}/` → `summary` (present-day values) |
| Filter options | `GET /api/meta/` |
| Temperature chart | `/api/projections/` → `temperature.<season>.series`: x-axis = `period_labels`, **one line per scenario** (`values`), tooltip shows `change` + unit |
| Rainfall chart | `/api/projections/` → `rainfall.<season>.series`, same pattern, tooltip shows % change |
| Season switch | change `<season>` key: `annual`, `winter`, `spring`, `summer`, `autumn` |
| Seasonal table | `/api/projections/` → `seasonal_table.rows` (end of century) |
| Commentary | `/api/projections/` → `commentary` array, shown as-is |
| Sea level chart (coastal counties) | `GET /api/sea-level/?county=`: x-axis = `years`, one line per scenario, unit cm; "No coastline" when `has_coastline` is false; show `provenance` for Leitrim and Limerick |
| Footer / chart caption | `source` |

Display rules (they protect against misleading the user, Risk R8):

- Always show the **unit, scenario, period and baseline** next to a number.
- Call them **projections**, never forecasts.
- Do not compute or round values in React beyond formatting. Use what the API returns.
- Use the same scenario colours everywhere (e.g. RCP2.6 green, RCP4.5 amber, RCP8.5 red).

### Building the frontend before the API exists

`build_dashboard_json.py` (planned, not written yet) would write `data/processed/dashboard/counties.json` and one `<slug>.json` per county **in exactly the API response shape above**. The frontend team can load these static files during Sprint 1–2. Switching to the real API is then just a change of base URL.

---

## Validation (CCD-239)

Run after every pipeline run and after every database load:

| Check | Expected |
|---|---|
| Counties | exactly 26, no `Northern Ireland`, no `Unknown` |
| Rows | 1,820 in `climate_data.csv` = 1,820 in `ClimateProjection`; 405 in `sea_level.csv` = 405 in `SeaLevelProjection` |
| Completeness | every county has all 70 variable/scenario/period/season combinations |
| No unknowns | no `unknown` scenario/period, no `Unknown` season |
| Plausible ranges | temperature 4–18 °C (current data: 4.3–17.7); precipitation 170–1,900 mm (current: 178–1,890); annual precipitation above any single season |
| Spot check | 3 counties compared with the Climate Ireland map viewer, results noted in the PR |
| Recalculation | `pipeline/10_validate_county_averages.py` recalculates Cork and Dublin another way and checks every value is inside its file's range ([validation-log.md](validation-log.md)) |

## Limitations (state these in the report)

- County values are a **simple mean of grid-cell centres** inside each boundary. They are not area-weighted, and small or coastal counties average fewer cells.
- Values are **ensemble means**. The spread between models is not shown.
- Thirty-year averages describe typical climate, not individual years or extreme events.
- Boundaries are Tailte Éireann 2019 (Generalised 20m), in `EPSG:4326`. A few coastal land cells fall just outside the outlines and aren't counted.
- Sea level for **Leitrim and Limerick is estimated** from Sligo and Clare. Its baseline (1981–2000) differs from temperature and rainfall (1976–2005).

## Re-running everything

```bash
cd pipeline
pip install -r requirements.txt            # pandas, geopandas, xarray, netCDF4
python 08_sea_level_json_to_csv.py         # UKCP18 JSON → CSV
python process_climate_data.py             # → data/processed/climate_data.csv and sea_level.csv
python 10_validate_county_averages.py      # → docs/validation-log.md
cd ../backend
python manage.py load_climate_data ../pipeline/data/processed/   # planned (CCD-67)
```

## Glossary

| Term | Meaning |
|---|---|
| Baseline | Observed-period model climate, 1976–2005, used as the reference (sea level: the 1981–2000 average) |
| RCP2.6 / 4.5 / 8.5 | Emissions scenarios: low, medium, high |
| Ensemble mean | Average of several climate models' projections |
| DJF / MAM / JJA / SON | Dec–Feb (winter), Mar–May (spring), Jun–Aug (summer), Sep–Nov (autumn) |
| NetCDF (`.nc`) | Standard file format for gridded climate data |