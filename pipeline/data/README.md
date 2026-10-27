# pipeline/data/

| Folder | What | In git? |
|---|---|---|
| `raw/` | Downloaded source files | **No** (too large). Only `raw/MANIFEST.md` is committed |
| `boundaries/` | CSO county boundaries, `ie_county_26.json` | Yes |
| `processed/` | `climate_data.csv` and `cleaning_report.csv`, made by `python -m process` | Yes, once agreed |

## Raw data layout (CCD-97)

One folder per **variable**, then one per **scenario**. File names are kept exactly as downloaded.

```
raw/
├── MANIFEST.md                     # every file, its source URL and date (scripts/make_manifest.py)
├── temperature/
│   ├── baseline/   tmean_CMIP5_baseline_1976-2005_ANNUAL.nc   (+ DJF, MAM, JJA, SON)
│   ├── rcp26/      tmean_CMIP5_rcp26_2021-2050_ensmean_final_ANNUAL.nc   (+ seasons, + 2071-2100)
│   ├── rcp45/      tmean_CMIP5_rcp45_2071-2100_ensmean_final_JJA.nc   ...
│   └── rcp85/      tmean_CMIP5_rcp85_2021-2050_ensmean_final_DJF.nc   ...
├── precipitation/
│   ├── baseline/   tot_prec_CMIP5_baseline_1976-2005_ANNUAL.nc   ...
│   ├── rcp26/      tot_prec_CMIP5_rcp26_2021-2050_ensmean_final_MAM.nc   ...
│   ├── rcp45/      tot_prec_CMIP5_rcp45_2071-2100_ensmean_final_SON.nc   ...
│   └── rcp85/      tot_prec_CMIP5_rcp85_2071-2100_ensmean_final_JJA.nc   ...
└── sea_level/
    └── ukcp18_sea_level_ireland.csv     (scripts/download_ukcp18.py)
```

Expected: 35 temperature files, 35 precipitation files (5 baseline + 3 scenarios × 2 periods × 5 seasons each), and 1 sea level CSV.

The pipeline finds files **by name**, not by folder (`filenames.py`), so a file in the wrong sub-folder still works. The test `test_no_unrecognised_nc_files_in_raw` fails if a file's name isn't recognised.

## Getting the files on a new computer

1. **Climate Ireland (70 files):** ask Eoin for the shared copy, or download each `.zip` from the URLs in `raw/MANIFEST.md` and unzip the `.nc` into the folder shown.
2. **Sea level:** `python scripts/download_ukcp18.py`
3. Check: `python -m pytest`, which opens every raw file (CCD-100).

Note: the Climate Ireland download is named `..._ensmid_final_...zip`, but the NetCDF file inside is `..._ensmean_final_....nc`. Both names are recognised.
