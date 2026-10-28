"""
STEP 05 - Which coordinate system does the CSO county file really use?

The climate files use latitude/longitude (EPSG:4326).
The CSO file (ie_county_26.json) doesn't say what it uses, so Python
assumes lat/lon - but its numbers are far too big to be lat/lon.

We try the two Irish coordinate systems and see which one puts
Ireland in the right place (about lon -10.7 to -5.4, lat 51.4 to 55.4).

How to run (from the pipeline folder):
    python 05_inspect_county_boundaries.py
"""

import os

import geopandas as gpd

# BASE_DIR: the folder this script is in (the "pipeline" folder)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# BOUNDARY_FILE: the CSO county boundaries
BOUNDARY_FILE = os.path.join(BASE_DIR, "data", "boundaries", "ie_county_26.json")

# counties: the file opened as a table, one row per county
counties = gpd.read_file(BOUNDARY_FILE)

# total_bounds: the edges of the whole map as [west, south, east, north]
west, south, east, north = counties.total_bounds

print(f"Python assumed: {counties.crs}")
print(f"Raw numbers:    x {west:.0f} to {east:.0f}, y {south:.0f} to {north:.0f}")
print("Lat/lon would be about -10 to -5 and 51 to 55, so these are NOT lat/lon.\n")

# Try each Irish coordinate system
for crs in ["EPSG:2157", "EPSG:29903"]:

    # test: a fresh copy of the file, told "your numbers are really in <crs>"
    # and then converted to lat/lon
    test = gpd.read_file(BOUNDARY_FILE)
    test = test.set_crs(crs, allow_override=True)
    test = test.to_crs("EPSG:4326")

    west, south, east, north = test.total_bounds
    print(f"If it's {crs}: lon {west:.2f} to {east:.2f}, lat {south:.2f} to {north:.2f}")

print("\nThe one that matches Ireland is the file's real coordinate system.")