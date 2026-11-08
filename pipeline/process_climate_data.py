"""
STEP 09 - Build the output: county averages for temperature, rainfall and sea level.

Writes two outputs to data/processed/:
  climate_data.csv / .json  temperature and rainfall,
                            one row per county + variable + scenario + period + season
  sea_level.csv / .json     sea level rise, one row per county + scenario + year

How to run (from the pipeline folder, after Step 08):
    python process_climate_data.py
"""

import os

import geopandas as gpd
import numpy as np
import pandas as pd
import xarray as xr
from aggregate import county_averages
from filename_info import get_file_details

# ---------------------------------------------------------------
# Where the files are
# ---------------------------------------------------------------

# BASE_DIR: the folder this script is in (the "pipeline" folder)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# RAW_DIR: the downloaded data
RAW_DIR = os.path.join(BASE_DIR, "data", "raw")

# BOUNDARY_FILE: Tailte Eireann county boundaries (Step 06), CC BY 4.0
BOUNDARY_FILE = os.path.join(
    BASE_DIR, "data", "boundaries", "counties_tailte_eireann_2019.geojson"
)

# LAND_MASK_FILE: the temperature file whose land cells we use for every file
LAND_MASK_FILE = os.path.join(
    RAW_DIR, "temperature", "baseline", "tmean_CMIP5_baseline_1976-2005_ANNUAL.nc"
)

# SEA_LEVEL_FILE: the CSV made by Step 08
SEA_LEVEL_FILE = os.path.join(RAW_DIR, "sea_level", "ukcp18_sea_level_ireland.csv")

# OUTPUT_DIR: where the results are saved
OUTPUT_DIR = os.path.join(BASE_DIR, "data", "processed")

# UNITS: the unit for each variable
UNITS = {"temperature": "degC", "precipitation": "mm"}

# all_rows: every temperature and rainfall row gets added to this list
all_rows = []

# ===============================================================
# 1. Load the 26 counties
# ===============================================================

# counties: one row per county, with its name and outline
counties = gpd.read_file(BOUNDARY_FILE)

# The names are in capitals ("CORK"). .str.title() makes them "Cork".
counties["county"] = counties["ENGLISH"].str.title()
counties = counties[["county", "geometry"]]

# ===============================================================
# 2. Match the land cells to counties (once, for all 70 files)
# ===============================================================
# All 70 files use the same 451 x 351 grid, so a cell in the same
# row and column is the same place in every file.

ds = xr.open_dataset(LAND_MASK_FILE)
grid = ds["tmean"].values[0]  # grid: the temperatures, 451 rows x 351 columns
lats = ds["lat"].values  # lats: the latitude of each row
lons = ds["lon"].values  # lons: the longitude of each column
ds.close()

# rows, cols: the row and column number of every land cell
# (land = has a temperature; sea cells are empty, NaN)
rows, cols = np.where(~np.isnan(grid))

# cells: one row per land cell, as a point on the map
cells = gpd.GeoDataFrame(
    {"row": rows, "col": cols},
    geometry=gpd.points_from_xy(lons[cols], lats[rows]),
    crs="EPSG:4326",
)

# Keep only the cells inside a county, and add the county name
cells = gpd.sjoin(cells, counties, how="inner", predicate="intersects")

# A cell exactly on a border can match two counties: keep only its first match
cells = cells[~cells.index.duplicated()]

print(f"{len(cells)} land cells matched to a county")

# ===============================================================
# 3. Average every climate file per county
# ===============================================================

# files: the full path of every .nc file in the temperature and rainfall folders
files = []
for variable_folder in ["temperature", "precipitation"]:
    for folder, subfolders, names in os.walk(os.path.join(RAW_DIR, variable_folder)):
        for name in sorted(names):
            if name.endswith(".nc"):
                files.append(os.path.join(folder, name))

print(f"{len(files)} climate files found")
if len(files) != 70:
    print("WARNING: expected 70 files - check data/raw for missing or extra files")

for path in files:
    # details: variable, scenario, period and season read from the file name
    details = get_file_details(path)
    print("  " + details["file"])

    ds = xr.open_dataset(path)
    grid = ds[details["nc_variable"]].values[0]
    ds.close()

    # averages: the mean value for each county (see aggregate.py).
    # Cells are looked up by row and column, not by lat/lon (Step 03 showed the
    # rainfall baseline stores lat/lon very slightly differently).
    # Bad values are removed first (CCD-275); report says how many.
    averages, report = county_averages(cells, grid, details["variable"])
    print(f"    {report}")

    for county, average in averages.items():
        all_rows.append(
            {
                "county": county,
                "variable": details["variable"],
                "scenario": details["scenario"],
                "period": details["period"],
                "season": details["season"],
                "value": round(float(average), 3),
                "unit": UNITS[details["variable"]],
            }
        )

# ===============================================================
# 4. Sea level for coastal counties, every 10 years
# ===============================================================

# sea: one row per sea point + scenario + percentile (made by Step 08)
sea = pd.read_csv(SEA_LEVEL_FILE)

# Keep the middle estimate only: rcp26_50, rcp45_50, rcp85_50
sea = sea[sea["rcp_percentile"].str.endswith("_50")].copy()

# scenario: "rcp45_50" -> "rcp45"
sea["scenario"] = sea["rcp_percentile"].str.replace("_50", "")

# sea_points: the sea points on the map, in EPSG:2157 (metres)
sea_points = gpd.GeoDataFrame(
    sea,
    geometry=gpd.points_from_xy(sea["X"], sea["Y"]),
    crs="EPSG:4326",
).to_crs("EPSG:2157")

# nearest: each sea point with its nearest county, if within 15 km.
# Points off Northern Ireland, Scotland or Wales are too far and are dropped.
nearest = gpd.sjoin_nearest(
    sea_points,
    counties.to_crs("EPSG:2157"),
    how="inner",
    max_distance=15000,  # metres
)
nearest = nearest[~nearest.index.duplicated()]

# coastal_counties: the counties that got at least one sea point
coastal_counties = sorted(nearest["county"].unique())

# BORROW_FROM: counties with coast but no sea point of their own.
# They use the neighbour on the same water (an ESTIMATE):
#   Leitrim's 4 km of coast is closer to Sligo's points (Donegal Bay)
#   Limerick's only coast is the Shannon Estuary, which has no points
BORROW_FROM = {"Leitrim": "Sligo", "Limerick": "Clare"}

# sea_counties: every county that gets sea level rows,
# and which county's sea points to use for it
sea_counties = {}
for county in coastal_counties:
    sea_counties[county] = county
for county, neighbour in BORROW_FROM.items():
    if county not in coastal_counties:
        sea_counties[county] = neighbour

# YEARS: the decades we keep. The rise is measured from the 1981-2000
# average, so there's no baseline row: it's 0 cm in about 1990.
YEARS = [2020, 2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100]

# sea_rows: every row of the sea level output gets added to this list
sea_rows = []

for county, source_county in sea_counties.items():
    # points: the sea points that belong to the source county
    points = nearest[nearest["county"] == source_county]

    # source: where the numbers come from, so estimates are clearly marked
    if county == source_county:
        source = "UKCP18"
    else:
        source = f"UKCP18, estimated from {source_county}"

    for scenario in ["rcp26", "rcp45", "rcp85"]:
        # scenario_points: this county's points for this scenario only
        scenario_points = points[points["scenario"] == scenario]

        for year in YEARS:
            # rise: the average rise in cm over this county's points
            rise = scenario_points[f"seaLevelAnom_{year}"].mean()

            sea_rows.append(
                {
                    "county": county,
                    "scenario": scenario,
                    "year": year,
                    "rise_cm": round(float(rise), 3),
                    "source": source,
                }
            )

print(
    f"Sea level for {len(sea_counties)} counties "
    f"(Leitrim uses Sligo's values, Limerick uses Clare's)"
)

# ===============================================================
# 5. Save the two outputs
# ===============================================================

os.makedirs(OUTPUT_DIR, exist_ok=True)

# climate: temperature and rainfall rows, sorted
climate = pd.DataFrame(all_rows)
climate = climate.sort_values(["county", "variable", "scenario", "period", "season"])
print(f"Empty values in the output: {climate['value'].isna().sum()}")
climate.to_csv(os.path.join(OUTPUT_DIR, "climate_data.csv"), index=False)
climate.to_json(
    os.path.join(OUTPUT_DIR, "climate_data.json"), orient="records", indent=2
)

# sea_level: sea level rows, sorted
sea_level = pd.DataFrame(sea_rows)
sea_level = sea_level.sort_values(["county", "scenario", "year"])
sea_level.to_csv(os.path.join(OUTPUT_DIR, "sea_level.csv"), index=False)
sea_level.to_json(
    os.path.join(OUTPUT_DIR, "sea_level.json"), orient="records", indent=2
)

print(f"\nclimate_data: {len(climate)} rows")
print(climate.groupby("variable").size().to_string())
print(f"\nsea_level: {len(sea_level)} rows")
