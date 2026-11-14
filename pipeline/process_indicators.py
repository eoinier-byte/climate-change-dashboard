import os

import geopandas as gpd
import numpy as np
import pandas as pd
import xarray as xr
from aggregate import county_averages
from filename_info import get_file_details

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INDICATORS_DIR = os.path.join(BASE_DIR, "data", "raw", "indicators")
BOUNDARY_FILE = os.path.join(
    BASE_DIR, "data", "boundaries", "counties_tailte_eireann_2019.geojson"
)
OUTPUT_DIR = os.path.join(BASE_DIR, "data", "processed")

INDICATORS = {
    "fd": ("frost_days", "days"),
    "su": ("summer_days", "days"),
    "hdd": ("heating_degree_days", "degC_days"),
    "gsl": ("growing_season_length", "days"),
}

LAND_MASK_FILE = os.path.join(
    INDICATORS_DIR, "fd", "fd_CMIP5_baseline_1976-2005_ANNUAL.nc"
)

counties = gpd.read_file(BOUNDARY_FILE)
counties["county"] = counties["ENGLISH"].str.title()
counties = counties[["county", "geometry"]]

ds = xr.open_dataset(LAND_MASK_FILE)
grid = ds["fd"].values[0]
lats = ds["lat"].values
lons = ds["lon"].values
ds.close()

rows, cols = np.where(~np.isnan(grid))
cells = gpd.GeoDataFrame(
    {"row": rows, "col": cols},
    geometry=gpd.points_from_xy(lons[cols], lats[rows]),
    crs="EPSG:4326",
)
cells = gpd.sjoin(cells, counties, how="inner", predicate="intersects")
cells = cells[~cells.index.duplicated()]
print(f"{len(cells)} land cells matched to a county")

all_rows = []
for code, (indicator, unit) in INDICATORS.items():
    folder = os.path.join(INDICATORS_DIR, code)
    names = sorted(n for n in os.listdir(folder) if n.endswith(".nc"))
    print(f"{indicator}: {len(names)} files")
    if len(names) != 7:
        print(f"WARNING: expected 7 {code} files - check {folder}")

    for name in names:
        details = get_file_details(name)

        ds = xr.open_dataset(os.path.join(folder, name))
        grid = ds[code].values[0]
        ds.close()

        averages, report = county_averages(cells, grid, indicator)
        print(f"{name}: {report}")

        for county, average in averages.items():
            all_rows.append(
                {
                    "county": county,
                    "indicator": indicator,
                    "scenario": details["scenario"],
                    "period": details["period"],
                    "value": round(float(average), 3),
                    "unit": unit,
                }
            )

os.makedirs(OUTPUT_DIR, exist_ok=True)
table = pd.DataFrame(all_rows).sort_values(
    ["county", "indicator", "scenario", "period"]
)
table.to_csv(os.path.join(OUTPUT_DIR, "impact_indicators.csv"), index=False)
table.to_json(
    os.path.join(OUTPUT_DIR, "impact_indicators.json"), orient="records", indent=2
)

print(f"\nimpact_indicators: {len(table)} rows (expected 728)")
print(table.groupby("indicator").size().to_string())
