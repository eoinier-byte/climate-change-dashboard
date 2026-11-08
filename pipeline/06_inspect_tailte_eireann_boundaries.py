"""
STEP 06 - Is the Tailte Eireann county file better than the CSO one?

Tailte Eireann (formerly Ordnance Survey Ireland) publishes more detailed
county boundaries:
    Counties - National Statutory Boundaries - 2019 - Generalised 20m
    Licence: CC BY 4.0 (credit: Tailte Eireann)

This script:
  1. lists the county names in the new file
  2. counts how many climate land cells each file matches to a county
     (more cells matched = less coastline lost)

How to run (from the pipeline folder):
    python 06_inspect_tailte_eireann_boundaries.py
"""

import os

import geopandas as gpd
import xarray as xr

# BASE_DIR: the folder this script is in (the "pipeline" folder)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# NEW_FILE: the Tailte Eireann county boundaries
NEW_FILE = os.path.join(
    BASE_DIR, "data", "boundaries", "counties_tailte_eireann_2019.geojson"
)

# CSO_FILE: the old CSO county boundaries
CSO_FILE = os.path.join(BASE_DIR, "data", "boundaries", "ie_county_26.json")

# TEMPERATURE_FILE: one climate file, to get the land cells from
TEMPERATURE_FILE = os.path.join(
    BASE_DIR,
    "data",
    "raw",
    "temperature",
    "baseline",
    "tmean_CMIP5_baseline_1976-2005_ANNUAL.nc",
)

# ---------------------------------------------------------------
# Part 1: the county names in the new file
# ---------------------------------------------------------------

# new_counties: the Tailte Eireann file. It's already in lat/lon.
new_counties = gpd.read_file(NEW_FILE)

print(f"Tailte Eireann file: {len(new_counties)} counties")
print(f"Columns: {list(new_counties.columns)}\n")

# The county names are in the "ENGLISH" column, in capitals
for name in sorted(new_counties["ENGLISH"]):
    print("  " + name)

# ---------------------------------------------------------------
# Part 2: how many land cells does each file match?
# ---------------------------------------------------------------

# cso_counties: the CSO file, fixed to its real coordinate system (Step 05),
# converted to lat/lon, without Northern Ireland
cso_counties = gpd.read_file(CSO_FILE)
cso_counties = cso_counties.set_crs("EPSG:29903", allow_override=True)
cso_counties = cso_counties.to_crs("EPSG:4326")
cso_counties = cso_counties[cso_counties["AREA_NAME"] != "Northern Ireland"]

# cells: every land cell in the temperature file as a row with lat, lon, tmean
ds = xr.open_dataset(TEMPERATURE_FILE)
cells = ds["tmean"].isel(time=0).to_dataframe().reset_index()
ds.close()

# Drop the empty (sea) cells
cells = cells.dropna()

# points: each land cell as a point on the map
points = gpd.GeoDataFrame(
    cells,
    geometry=gpd.points_from_xy(cells["lon"], cells["lat"]),
    crs="EPSG:4326",
)

# sjoin keeps only the points that fall inside a county
cso_matched = gpd.sjoin(points, cso_counties, how="inner", predicate="intersects")
new_matched = gpd.sjoin(points, new_counties, how="inner", predicate="intersects")

print("\nLand cells matched to a county:")
print(f"  CSO file:            {len(cso_matched)}")
print(f"  Tailte Eireann file: {len(new_matched)}")
print(f"  Difference:          {len(new_matched) - len(cso_matched):+}")
