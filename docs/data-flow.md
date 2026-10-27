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
```

The values are climate-model **projections** (averages over 30-year periods), not forecasts.

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

Folder layout and file names (the pipeline reads the scenario from the folder and the period, season and variable from the file name):

```
data/raw/
  temperature/
    baseline/tmean_CMIP5_baseline_1976-2005_ANNUAL.nc
    rcp45/tmean_CMIP5_rcp45_2071-2100_ensmean_final_DJF.nc
    ...
  precipitation/
    baseline/tot_prec_CMIP5_baseline_1976-2005_JJA.nc
    rcp85/tot_prec_CMIP5_rcp85_2021-2050_ensmean_final_SON.nc
    ...
data/boundaries/ie_county_26.json   # county polygons (27 features incl. Northern Ireland)
```

Raw files are **not committed** to Git (large and re-downloadable). Record where and when you downloaded them in [`DATA_SOURCES.md`](../DATA_SOURCES.md).

---

## Stage 2: Processing and county aggregation

Script: `process_climate_data.py` (moving into `pipeline/` under CCD-25 / CCD-31).

For **each** NetCDF file:

1. Read the scenario, period, season and variable from the path and file name.
2. Open the file with Xarray and take the single time step (`isel(time=0)`). Each file holds one 30-year average.
3. Turn the grid into a table of points (`lat`, `lon`, value) and drop empty cells (sea / outside the model domain).
4. Load the county boundaries **once**. They are treated as Irish Grid (`EPSG:29903`), re-projected to `EPSG:4326` to match the climate grid, and `Northern Ireland` is removed, leaving **26 counties**.
5. **Spatial join:** each grid-cell centre is assigned to the county polygon it falls inside (`geopandas.sjoin`, `intersects`).
6. **County value = simple mean** of all grid cells inside the county, rounded to 3 decimals.

Output: `data/processed/climate_data.csv`, **one row per county × variable × scenario × period × season**.

| Column | Type | Allowed values | Example |
|---|---|---|---|
| `county` | text | 26 county names (`Carlow` … `Wicklow`) | `Cork` |
| `variable` | text | `temperature`, `precipitation` | `temperature` |
| `scenario` | text | `baseline`, `rcp26`, `rcp45`, `rcp85` | `rcp85` |
| `period` | text | `1976-2005`, `2021-2050`, `2071-2100` | `2071-2100` |
| `season` | text | `Annual`, `Winter`, `Spring`, `Summer`, `Autumn` | `Annual` |
| `value` | decimal | °C for temperature, mm for precipitation | `12.522` |

```csv
county,variable,scenario,period,season,value
Cork,temperature,baseline,1976-2005,Annual,9.811
Cork,temperature,rcp85,2071-2100,Annual,12.522
Cork,precipitation,baseline,1976-2005,Annual,1366.159
Cork,precipitation,rcp85,2071-2100,Annual,1474.713
```

**Expected size:** 26 counties × 2 variables × 7 scenario/period combinations × 5 seasons = **1,820 rows**. The CSV stores **absolute values only**. Changes are calculated later (Stage 4), so there is one source of truth.

---

## Stage 3: Loading into PostgreSQL

The CSV is loaded into two tables (full field list in `docs/data-model.md`):

| CSV | Database | Rule |
|---|---|---|
| `county` | `County.name` (+ `slug` = lower case, spaces → `-`) | 26 rows, created if missing |
| `variable` | `ClimateProjection.variable` | stored as-is |
| `scenario` | `ClimateProjection.scenario` | stored as-is |
| `period` | `ClimateProjection.period` | stored as-is |
| `season` | `ClimateProjection.season` | stored **lower case** (`annual`, `winter`, …) |
| `value` | `ClimateProjection.value` | `DecimalField(max_digits=8, decimal_places=3)` |
| (derived) | `ClimateProjection.unit` | `°C` for temperature, `mm` for precipitation |

Rules:

- **Unique together:** (county, variable, scenario, period, season), so a reload can never create duplicates.
- **Loading is repeatable:** a Django management command (planned: `python manage.py load_climate_data data/processed/climate_data.csv`) uses `update_or_create`, so it can be re-run safely after the pipeline changes.
- Baseline rows exist only for `1976-2005`. Scenario rows exist only for `2021-2050` and `2071-2100`.

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

| Method | Path | Returns | Errors |
|---|---|---|---|
| GET | `/api/counties/` | `[{"name": "Cork", "slug": "cork"}, …]` (26, alphabetical) | – |
| GET | `/api/counties/{slug}/` | Full county projections (below) | 404 unknown county |
| GET | `/api/counties/{slug}/?variable=temperature&season=summer` | Filtered version | 400 invalid `variable` / `season` / `scenario` |
| GET | `/api/sea-level/` | National sea-level projections | (source still to be decided, see Risk R12) |

### `GET /api/counties/cork/` (real values from the current CSV, shortened)

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

---

## Stage 5: Frontend (React + Chart.js)

| UI element | Data used |
|---|---|
| County dropdown | `GET /api/counties/` → `name` (label), `slug` (URL) |
| Temperature chart | `temperature.<season>.series`: x-axis = `period_labels`, **one line per scenario** (`values`), tooltip shows `change` + unit |
| Rainfall chart | `rainfall.<season>.series`, same pattern, tooltip shows % change |
| Season switch | change `<season>` key: `annual`, `winter`, `spring`, `summer`, `autumn` |
| Seasonal table | `seasonal_table.rows` (end of century) |
| Commentary | `commentary` array, shown as-is |
| Footer / chart caption | `source` |

Display rules (they protect against misleading the user, Risk R8):

- Always show the **unit, scenario, period and baseline** next to a number.
- Call them **projections**, never forecasts.
- Do not compute or round values in React beyond formatting. Use what the API returns.
- Use the same scenario colours everywhere (e.g. RCP2.6 green, RCP4.5 amber, RCP8.5 red).

### Building the frontend before the API exists

`build_dashboard_json.py` writes `data/processed/dashboard/counties.json` and one `<slug>.json` per county **in exactly the API response shape above**. The frontend team can load these static files during Sprint 1–2. Switching to the real API is then just a change of base URL.

---

## Validation (CCD-239)

Run after every pipeline run and after every database load:

| Check | Expected |
|---|---|
| Counties | exactly 26, no `Northern Ireland`, no `Unknown` |
| Rows | 1,820 in CSV = 1,820 in `ClimateProjection` |
| Completeness | every county has all 70 variable/scenario/period/season combinations |
| No unknowns | no `unknown` scenario/period, no `Unknown` season |
| Plausible ranges | temperature 4–18 °C (current data: 4.3–17.7); precipitation 170–1,900 mm (current: 178–1,890); annual precipitation above any single season |
| Spot check | 3 counties compared with the Climate Ireland map viewer, results noted in the PR |

## Limitations (state these in the report)

- County values are a **simple mean of grid-cell centres** inside each boundary. They are not area-weighted, and small or coastal counties average fewer cells.
- Values are **ensemble means**. The spread between models is not shown.
- Thirty-year averages describe typical climate, not individual years or extreme events.
- Boundary CRS is assumed to be Irish Grid (`EPSG:29903`). Confirm it if boundaries are replaced.

## Re-running everything

```bash
cd pipeline
pip install -r requirements.txt            # pandas, geopandas, xarray, netCDF4
python process_climate_data.py             # → data/processed/climate_data.csv
python build_dashboard_json.py             # → data/processed/dashboard/*.json (frontend prototype)
cd ../backend
python manage.py load_climate_data ../pipeline/data/processed/climate_data.csv
```

## Glossary

| Term | Meaning |
|---|---|
| Baseline | Observed-period model climate, 1976–2005, used as the reference |
| RCP2.6 / 4.5 / 8.5 | Emissions scenarios: low, medium, high |
| Ensemble mean | Average of several climate models' projections |
| DJF / MAM / JJA / SON | Dec–Feb (winter), Mar–May (spring), Jun–Aug (summer), Sep–Nov (autumn) |
| NetCDF (`.nc`) | Standard file format for gridded climate data |
