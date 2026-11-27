# Data processing pipeline (CCD-258)

How the raw climate downloads become the county-level CSV files the backend loads, and how to rebuild them. This page is the overview. The details are in the pages it links to:

- [DATA_SOURCES.md](../DATA_SOURCES.md): where every dataset comes from, its licence and citation
- [cleaning-rules.md](cleaning-rules.md): which values are removed and why (CCD-275)
- [validation-log.md](validation-log.md): the results of every validation check (CCD-36, CCD-271, CCD-239)
- [pipeline/README.md](../pipeline/README.md): what each inspection step found, and the flood-layer build (CCD-400)
- [data-review.md](data-review.md): the TRANSLATE file names and how they were downloaded

## 1. What it produces

All outputs are written to `pipeline/data/processed/` and are committed, so the backend can be loaded without re-running the pipeline.

| Output | Rows | Written by | Loaded into the database by |
|---|---|---|---|
| `climate_data.csv` / `.json` | 1,820 (26 counties × 2 variables × 35 files) | `process_climate_data.py` | `manage.py load_data` → ClimateProjection |
| `sea_level.csv` / `.json` | 405 (15 coastal counties × 3 scenarios × 9 decades) | `process_climate_data.py` | `manage.py load_data` → SeaLevelProjection |
| `impact_indicators.csv` / `.json` | 728 (26 counties × 4 indicators × 7 files) | `process_indicators.py` | `manage.py load_data` → ImpactIndicator |
| `worldclim_cities.csv` | 49 cities | `worldclim_baseline.py` | `manage.py compute_analogues` → CityClimate |
| `worldclim_counties.csv` | 26 counties | `worldclim_baseline.py` | `manage.py compute_analogues` → CountyAnalogue (input) |

The column contract for each file is in [data-flow.md](data-flow.md) (climate, sea level) and the docstring of `backend/climate/management/commands/load_data.py` (impact indicators, CCD-366).

## 2. Data sources

| Dataset | Used for | How it gets to `data/raw/` | Details |
|---|---|---|---|
| TRANSLATE `tmean`, `tot_prec` (Met Éireann / EPA Climate Ireland) | Temperature, rainfall | Downloaded by hand from `https://www.climateservices.ie/TRANSLATE/` (70 zips: 2 variables × 5 seasons × baseline + 3 RCPs × 2 periods), the `.nc` taken out of each | DATA_SOURCES §1, data-review.md |
| TRANSLATE `fd`, `su`, `hdd`, `gsl` | Impact indicators | Script: `python -m fetch.climate_service_api` (28 annual files, skips files already there) | DATA_SOURCES §1 |
| UKCP18 sea level (Met Office) | Sea level | Downloaded by hand as JSON from the ArcGIS feature service (layer 1, attributes only). A query with `where=X >= -10.59 AND X <= -4.91 AND Y >= 51.38 AND Y <= 55.84`, `outFields=*`, `returnGeometry=false`, `f=json` gives 2,070 rows: 18 more points than the 212 in the original export, all more than 15 km from any county, so the county rule drops them and rebuilds `sea_level.csv` exactly | DATA_SOURCES §2, data-review.md |
| Tailte Éireann county boundaries 2019 | Every county average | Committed: `data/boundaries/counties_tailte_eireann_2019.geojson` | DATA_SOURCES §3 |
| WorldClim 2.1 (1970–2000) | Climate analogues | Downloaded by `worldclim_baseline.py` if missing | DATA_SOURCES §9 |
| Natural Earth populated places | Analogue city locations | Downloaded by `worldclim_baseline.py` if missing | DATA_SOURCES §10 |

`data/raw/` is in `.gitignore`: the files are large, and they can be downloaded again.

## 3. Folder structure

```
pipeline/
├── 01_ … 07_inspect_*.py        look at the raw data, write nothing (optional)
├── 08_sea_level_json_to_csv.py  UKCP18 JSON → CSV
├── process_climate_data.py      temperature, rainfall, sea level → county CSVs
├── process_indicators.py        impact indicators → county CSV
├── worldclim_baseline.py        WorldClim → cities and counties CSVs
├── aggregate.py                 county_averages(): one file's grid → one value per county
├── clean.py, cleaning_ranges.py remove bad values (CCD-275)
├── filename_info.py             variable, scenario, period, season from a file name
├── fetch/climate_service_api.py downloads the indicator files
├── validate_aggregation.py      CCD-36 check, writes nothing
├── spot_check.py                CCD-239 independent recomputation, writes nothing
├── build_land_polygon.py, flood_precompute.py   flood layers (separate, see pipeline/README.md)
├── tests/                       pytest, runs in CI
└── data/
    ├── raw/                     downloads, not committed
    ├── boundaries/              county outlines, island land polygon (committed)
    ├── analogue_cities.csv      the 49 analogue cities (committed)
    └── processed/               the outputs above
```

## 4. The steps

Run every step from the `pipeline/` folder.

| # | Stage | Script | Reads | Writes |
|---|---|---|---|---|
| 0 | Fetch | by hand (TRANSLATE `tmean`/`tot_prec`, UKCP18) and `python -m fetch.climate_service_api` (indicators) | climateservices.ie, ArcGIS | `data/raw/temperature/`, `precipitation/`, `sea_level/`, `indicators/` |
| 1–7 | Inspect (optional) | `01_` … `07_inspect_*.py` | `data/raw/`, `data/boundaries/` | nothing, prints only |
| 8 | Convert | `08_sea_level_json_to_csv.py` | `sea_level/ukcp18_sea_level_ireland.json` | `sea_level/ukcp18_sea_level_ireland.csv` |
| 9 | Load, clean, aggregate, export | `process_climate_data.py` | 70 `.nc` files, the sea level CSV, the boundaries | `climate_data.*`, `sea_level.*` |
| 10 | Same, for the indicators | `process_indicators.py` | 28 `.nc` files in `data/raw/indicators/`, the boundaries | `impact_indicators.*` |
| 11 | Analogue baseline | `worldclim_baseline.py` | WorldClim, Natural Earth, `analogue_cities.csv`, the boundaries | `worldclim_cities.csv`, `worldclim_counties.csv` |

Steps 9 and 10 do the same four things:

1. **Load.** Read each NetCDF file with `xarray`. The variable, scenario, period and season come from the file name (`filename_info.get_file_details`).
2. **Match cells to counties, once.** Every file in a step is on the same grid (451 × 351 cells, about 1 km, for temperature and rainfall). The land cells of one reference file (the temperature baseline for step 9, the frost-days baseline for step 10) are matched to a county with `gpd.sjoin`. Every later file is read at those same rows and columns, so temperature and rainfall are averaged over exactly the same land.
3. **Clean** (`clean.py`). Remove empty values, the `-9999` no-data code, and values outside the allowed range. Bad values are dropped, never replaced. Each file prints how many of each kind it removed.
4. **Aggregate and export** (`aggregate.py`). The county value is the plain mean of its clean cells, rounded to 3 decimals and written to CSV and JSON.

Sea level is not a grid. Each UKCP18 point goes to its nearest county within 15 km (`gpd.sjoin_nearest`), the 50th percentile is used, and a county's value per decade is the mean of its points. Leitrim and Limerick have no point within 15 km, so they use Sligo's and Clare's values. This is marked in the `source` column.

## 5. Cleaning rules

The allowed ranges are in `cleaning_ranges.py`. The reasons for each one are in [cleaning-rules.md](cleaning-rules.md).

| Variable | Allowed range | Unit |
|---|---|---|
| temperature | −2 to 22 | °C (30-year seasonal mean) |
| precipitation | 50 to 5,000 | mm (seasonal or annual total) |
| frost_days, summer_days, growing_season_length | 0 to 366 | days |
| heating_degree_days | 0 to 6,000 | °C·days |

Also removed in every variable: empty (NaN) cells and the fill value `-9999`.

## 6. Validation checks

| Check | How to run it | What it proves | Result |
|---|---|---|---|
| Unit tests (CCD-100, CCD-275, CCD-36, CCD-239, CCD-355, CCD-420) | `python -m pytest tests -v` (also in CI, the `pipeline` job) | Raw files open; cleaning, aggregation, spot-check, WorldClim and land-polygon logic on tiny made-up grids | 43 passed, 2 skipped, 27 Nov 2026. The skips: the real-engine flood test (needs the compiled `flood_engine_py`) and the real raw-file check (needs `data/raw/`); both run when those are present |
| Aggregation recomputed (CCD-36) | `python validate_aggregation.py` | Cork and Dublin recomputed point-in-polygon instead of `sjoin`; every county value lies between the file's min and max | validation-log.md, PASSED |
| Independent spot-checks (CCD-239) | `python spot_check.py climate …` / `spot_check.py sea …` | Values recomputed with different code (`shapely.contains_xy`, distance to each county) | validation-log.md, PASSED |
| Import verified (CCD-271) | backend tests and the CCD-271 log | Row counts, keys and sample values in PostgreSQL match the CSVs | validation-log.md, PASSED |
| Load contract (CCD-270, CCD-366) | `manage.py load_data` | Bad rows are skipped and reported; a file that breaks the contract rolls the whole load back | load_data docstring |

## 7. Rebuild the data

**One command**, from the repository root, once the raw files are in `pipeline/data/raw/` (section 2):

```bash
cd pipeline && pip install -r requirements.txt && python -m fetch.climate_service_api && python 08_sea_level_json_to_csv.py && python process_climate_data.py && python process_indicators.py && python worldclim_baseline.py && python -m pytest tests -q
```

Then load the database (needs the backend `.env` and PostgreSQL running):

```bash
cd ../backend && python manage.py load_data && python manage.py compute_analogues
```

Every step overwrites its outputs, and `load_data` uses `update_or_create`, so the whole chain is safe to run again. To check a rebuild, run `git diff --stat pipeline/data/processed/`: with unchanged raw files the outputs should match the committed ones (checked on 27 Nov 2026, see below).

**How long it takes**

| Step | Time |
|---|---|
| `08_sea_level_json_to_csv.py` | 0.3 s |
| `process_climate_data.py` (70 files + sea level) | 6.0 s |
| `process_indicators.py` (28 files) | 3.9 s |
| `worldclim_baseline.py` (WorldClim already downloaded) | 2.1 s |
| `pytest tests` | under 1 s |
| **Processing in total** | **about 12 s** |
| Downloads, first time only: 70 TRANSLATE `tmean`/`tot_prec` zips (about 5–10 MB each) | 48 s |
| Downloads: 28 indicator files (`fetch.climate_service_api`) | 20 s |
| Downloads: UKCP18 JSON | 2 s |

Measured on 27 Nov 2026 on a laptop, with a fresh download of every raw file. All eight outputs (`climate_data`, `sea_level`, `impact_indicators` as CSV and JSON, and both `worldclim_*.csv`) were **byte-identical** to the committed files, so the pipeline is reproducible.

## 8. Known gaps

- `pipeline/data/processed/worldclim_cities.csv` and `worldclim_counties.csv` are **not committed on `main`**, but `compute_analogues` reads them from there by default. On a fresh clone, run `python worldclim_baseline.py` first (it downloads WorldClim and Natural Earth), or commit the two files.
- The "Re-running everything" section of [data-flow.md](data-flow.md) is from Sprint 1: it names `10_validate_county_averages.py` and `load_climate_data`, which were replaced by `validate_aggregation.py` and `load_data`. This page has the current commands.
- The flood layers (`build_land_polygon.py`, `flood_precompute.py`) are not part of the rebuild above. They need the Copernicus DEM, which can't be committed. See [pipeline/README.md](../pipeline/README.md#rebuilding-the-flood-layers-ccd-400) and [flood-engine.md](flood-engine.md).
