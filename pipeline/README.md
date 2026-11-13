# pipeline/: climate data processing

Turns the raw climate downloads into two county-level files the backend can load:

- `data/processed/climate_data.csv`: temperature and rainfall
- `data/processed/sea_level.csv`: sea level rise every 10 years

Each has a `.json` copy with the same rows.

**Jira:** CCD-25 Process raw data · CCD-31 Aggregate by county

## The steps

Run each one from this `pipeline/` folder. Steps 01–07 only **look** at the data; 08 and `process_climate_data.py` write files.

| Step | Script | What it does | What we found |
|---|---|---|---|
| 01 | `01_inspect_temperature_baseline.py` | Prints each temperature baseline file and its attributes | Variable `tmean`, °C, grid 451 × 351 (about 1 km cells), one time step, sea cells empty |
| 02 | `02_inspect_temperature_rcp.py` | Same, for the 30 temperature RCP files | Same grid and units; time labelled 2035 / 2085 (middle of each period) |
| 03 | `03_inspect_precipitation_baseline.py` | Same, for the rainfall baseline files | Variable `tot_prec`, mm, same grid. A different product ("Seamus Gridded Rainfall") with a wider land mask that includes a strip of sea |
| 04 | `04_inspect_precipitation_rcp.py` | Same, for the 30 rainfall RCP files | Same grid, mm |
| 05 | `05_inspect_county_boundaries.py` | Tests which coordinate system the CSO county file really uses | It says nothing, so Python assumes lat/lon, but it's really **EPSG:29903 (Irish Grid)** |
| 06 | `06_inspect_tailte_eireann_boundaries.py` | Compares the Tailte Éireann county file with the CSO one | Same 26 counties, already in lat/lon, much more detailed coastline: matches 255 more land cells. **We use this file** |
| 07 | `07_inspect_sea_level_json.py` | Prints the UKCP18 sea level file's layout, a sample row, the number of points and the X/Y ranges | 212 sea points (not counties), 3 scenarios × 3 percentiles, rise in cm since 1981–2000. The file says 27700 (British National Grid), but that's only for shapes it doesn't include: **X and Y are lat/lon** |
| 08 | `08_sea_level_json_to_csv.py` | Turns the sea level JSON into a smaller CSV | 842 KB JSON → 230 KB CSV |
| 09 | `process_climate_data.py` | Builds the two outputs | 1,820 + 405 rows (see below) |

`filename_info.py` is a helper: `get_file_details()` reads the variable, scenario, period and season from a file name. It's used by `process_climate_data.py`.

## Run it

```bash
pip install -r requirements.txt
python 08_sea_level_json_to_csv.py
python process_climate_data.py
```

The inspection steps (01–07) are optional; run them to see the data for yourself.

## Raw data (not committed to git)

```
data/
├── raw/
│   ├── temperature/
│   │   ├── baseline/   tmean_CMIP5_baseline_1976-2005_<SEASON>.nc            (5 files)
│   │   ├── rcp26/      tmean_CMIP5_rcp26_<PERIOD>_ensmean_final_<SEASON>.nc  (10 files)
│   │   ├── rcp45/      (10 files)
│   │   └── rcp85/      (10 files)
│   ├── precipitation/  the same layout, tot_prec_... files                    (35 files)
│   └── sea_level/
│       ├── ukcp18_sea_level_ireland.json   downloaded by hand from the Met Office
│       └── ukcp18_sea_level_ireland.csv    made by step 08
├── boundaries/
│   ├── counties_tailte_eireann_2019.geojson   used (Tailte Éireann, CC BY 4.0)
│   └── ie_county_26.json                      old CSO file, kept for steps 05 and 06
└── processed/
    ├── climate_data.csv / .json
    └── sea_level.csv / .json
```

`<SEASON>` is ANNUAL, DJF (winter), MAM (spring), JJA (summer) or SON (autumn). `<PERIOD>` is 2021-2050 or 2071-2100.

Where the data comes from, and the licences, are in [`DATA_SOURCES.md`](../DATA_SOURCES.md).

## Output

**`climate_data.csv`**: 26 counties × 35 files = **910 rows each** for temperature and rainfall (1,820 in total).

| county | variable | scenario | period | season | value | unit |
|---|---|---|---|---|---|---|
| Cork | temperature | baseline | 1976-2005 | Annual | 9.815 | degC |
| Cork | precipitation | rcp85 | 2071-2100 | Winter | 528.778 | mm |

**`sea_level.csv`**: 15 coastal counties × 3 scenarios × 9 decades (2020–2100) = **405 rows**. Inland counties have no rows. `rise_cm` is the rise since the 1981–2000 average, so the baseline is 0 cm (about 1990) and has no row.

| county | scenario | year | rise_cm | source |
|---|---|---|---|---|
| Sligo | rcp85 | 2100 | 67.371 | UKCP18 |
| Leitrim | rcp85 | 2100 | 67.371 | UKCP18, estimated from Sligo |

## How it works

- **Grid cells → counties:** all 70 files share the same grid, so the land cells are matched to counties **once**, using the temperature baseline's land cells. Each file's values are then read for those same cells **by row and column**. This means temperature and rainfall are averaged over exactly the same land, and rainfall's sea strip is ignored.
- **County value:** the plain average of the cells inside the county.
- **Change from baseline** is worked out by the app: projection − baseline for °C, and (projection − baseline) ÷ baseline × 100 for rainfall %.
- **Sea level → counties:** each sea point goes to its **nearest** county within 15 km; points off Northern Ireland, Scotland and Wales are too far and are dropped. We use the 50th percentile (middle estimate). A county's value for each decade is the average of its points.

## Known limitations

- **Leitrim and Limerick** have coastline but no UKCP18 sea point near it. Leitrim uses **Sligo's** sea level values (Donegal Bay) and Limerick uses **Clare's** (Shannon Estuary). These are estimates.
- A small number of coastal land cells fall just outside the county outlines and aren't counted.
- Baselines differ: temperature and rainfall use 1976–2005; sea level uses 1981–2000. Both are centred on about 1990.
## Rebuilding the flood layers (CCD-400)

`flood_precompute.py` turns the local Copernicus DEM into flood layers for the 15 coastal counties.
Contract: [`docs/flood-engine.md`](../docs/flood-engine.md) (§3 input, §7 limits, §9 D3/D5/D6).

**Inputs** (none are committed: the DEM licence forbids it, D2):

- `--dem`: the GLO-90 mosaic, `data/dem/glo90/ireland_glo90.vrt` (how to get it: `DATA_SOURCES.md` §7)
- `--land`: a land polygon for the **whole island incl. Northern Ireland** (D3). Outside it = sea. Lakes inside it stay land.
- `--counties`: `pipeline/data/boundaries/counties_tailte_eireann_2019.geojson` (county name column `ENGLISH`)
- the `flood_engine_py` binding, built as in `docs/flood-engine.md` §10, with `FLOOD_ENGINE_PY_DIR` pointing at it

Run from the repository root (pilot county first, D5):

```bash
cmake -S flood_engine -B flood_engine/build -DFLOOD_ENGINE_BUILD_PYTHON=ON -DPython_EXECUTABLE="$(which python)"
cmake --build flood_engine/build -j
FLOOD_ENGINE_PY_DIR=flood_engine/build/python python pipeline/flood_precompute.py \
    --dem data/dem/glo90/ireland_glo90.vrt --land <land.gpkg> \
    --counties pipeline/data/boundaries/counties_tailte_eireann_2019.geojson \
    --out pipeline/data/processed/flood --county cork
```

Leave out `--county` to build all 15 coastal counties. `--cell-size` (default 90 m) sets the ITM grid.

**Output:** `pipeline/data/processed/flood/<slug>/` with `level_000.png` … `level_200.png` (RGBA, EPSG:3857,
flooded = semi-transparent blue) and `index.json` (slug, bounds `[[south, west], [north, east]]`, `cell_size_m`,
per-level `flooded_cells` / `flooded_area_km2`, attribution, model limits). The script also prints the per-level table.

**How:** the DEM is reprojected once to a national ITM grid (bilinear), NaN/no-data become `-9999.0`, the land polygon
gives the sea mask, and the engine runs once per level `k/10` on the whole island so water is never cut off at a county
edge. Each county then counts only its own flooded cells; areas come from the ITM grid, not the PNG.

Tests use tiny synthetic inputs only: `python -m pytest tests/test_flood_precompute.py -v` (the real-engine test runs
when `FLOOD_ENGINE_PY_DIR` is set).
