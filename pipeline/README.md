# pipeline/: climate data processing

Turns raw EPA / Climate Ireland projections into county-level values the backend can serve.

**Jira:** CCD-16 Research datasets · CCD-25 Process raw data · CCD-31 Aggregate by county · CCD-40 Automated pipeline · CCD-67 Populate database · CCD-239 Data validation

## What it produces

For every county, variable (temperature, precipitation), season (annual, winter, spring, summer, autumn), scenario (baseline, RCP2.6, RCP4.5, RCP8.5) and period (1976–2005, 2021–2050, 2071–2100):

| county | variable | season | scenario | period | value | unit |
|---|---|---|---|---|---|---|

- Temperature change is shown in °C; rainfall change as % of the 1976–2005 baseline.
- Sea-level rise is national (2050, 2100), not per county.

## Layout (to be filled in during Sprint 1)

```
pipeline/
  data/raw/         # downloaded source files - NOT committed (see .gitignore)
  data/processed/   # climate_data.csv and dashboard JSON outputs
  process.py        # raw -> tidy CSV
  aggregate.py      # grid cells -> county averages
  load_db.py        # processed CSV -> PostgreSQL
  tests/
  requirements.txt  # pandas, numpy, xarray, geopandas, netCDF4
```

## Getting the raw data

Download from the Climate Ireland Data Explorer into `data/raw/`. The URL pattern and file list are in `docs/data-review.md`. Sea level comes from Met Office UKCP18 (`data/raw/sea_level/`). Record the exact file names, download date and licence/attribution in [`DATA_SOURCES.md`](../DATA_SOURCES.md).

## Method notes

Document how grid cells are assigned to counties (cell centre inside boundary vs. area-weighted) and any limitations. This is checked in CCD-239.
