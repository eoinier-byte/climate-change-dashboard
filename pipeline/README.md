# pipeline/: climate data processing

Turns raw EPA / Climate Ireland projections and UKCP18 sea level data into county-level values the backend can serve.

**Jira:** CCD-16 Research datasets · CCD-25 Process raw data · CCD-31 Aggregate by county · CCD-40 Automated pipeline · CCD-67 Populate database · CCD-239 Data validation

## What it produces

`data/processed/climate_data.csv`, one row per county × variable × scenario × period × season. The full column spec is in [`docs/variables.md`](../docs/variables.md).

| county | variable | scenario | period | season | value | unit |
|---|---|---|---|---|---|---|
| Cork | temperature | rcp45 | 2071-2100 | Annual | 11.6 | degC |
| Cork | precipitation | baseline | 1976-2005 | Winter | 487.2 | mm |
| Cork | sea_level | rcp85 | 2071-2100 | Annual | 66.0 | cm |

- Temperature and precipitation: all 26 counties, 910 rows each.
- Sea level: coastal counties only, up to 90 rows. Inland counties have no row and the dashboard shows "No coastline".
- Change from baseline is calculated by the app: °C for temperature, % for rainfall.

## Layout

```
pipeline/
  config.py            # paths, variable names, ranges - edit here, not in the code
  filenames.py         # reads variable/scenario/period/season from a file name
  clean.py             # flags null, fill and out-of-range values (CCD-275)
  sea_level.py         # UKCP18 cells -> coastal county averages
  process.py           # main: raw files -> data/processed/climate_data.csv
  scripts/
    download_ukcp18.py # fetch UKCP18 sea level -> data/raw/sea_level/
    make_manifest.py   # list raw files -> data/raw/MANIFEST.md (CCD-96)
    inspect_datasets.py# variables, dims, units, absolute vs anomaly -> docs/dataset-inspection.md (CCD-98, CCD-99)
  tests/               # pytest (CCD-100, CCD-275); tests/data/ holds one sample .nc
  data/
    raw/               # downloaded files - NOT committed (layout: data/README.md)
    boundaries/        # ie_county_26.json (CSO)
    processed/         # outputs
  requirements.txt
```

## Run it

From the `pipeline/` folder, with the virtual environment active:

```bash
pip install -r requirements.txt

python scripts/download_ukcp18.py     # once: sea level data
python scripts/make_manifest.py       # list raw files (CCD-96)
python scripts/inspect_datasets.py    # inspection report (CCD-98, CCD-99)
python -m pytest                      # integrity + cleaning tests (CCD-100, CCD-275)
python -m process                     # build climate_data.csv
```

`python -m process` stops with an error if row counts, county counts or nulls don't match `docs/variables.md`.

## Getting the raw data

See [`data/README.md`](data/README.md). Climate Ireland URLs are listed in `data/raw/MANIFEST.md`; licences are in [`DATA_SOURCES.md`](../DATA_SOURCES.md).

## Method notes

- **County boundaries:** the CSO file claims EPSG:4326 but is really EPSG:29903 (Irish Grid); `process.py` overrides it before reprojecting.
- **Temperature/precipitation:** a grid cell (1.5 km) belongs to a county if its centre is inside or on the boundary. The county value is the plain mean of those cells. Area-weighting is a CCD-239 question.
- **Sea level:** UKCP18 cells (~12 km) sit over the sea, so each is assigned to the nearest county within 15 km. Cells nearest Northern Ireland, and Scottish/Welsh cells, are dropped. Values are the 50th percentile, averaged over 2030/2040/2050 and 2080/2090/2100.
- **Cleaning:** see [`docs/cleaning-rules.md`](../docs/cleaning-rules.md).
