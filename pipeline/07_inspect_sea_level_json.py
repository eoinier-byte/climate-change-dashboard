"""
STEP 07 - View the UKCP18 sea level file.

We downloaded this JSON file by hand from the Met Office UKCP18 map service.
This script shows:
  1. how the file is laid out
  2. one sample row
  3. how many sea points it covers

How to run (from the pipeline folder):
    python 07_inspect_sea_level_json.py
"""

import json
import os

import pandas as pd

# BASE_DIR: the folder this script is in (the "pipeline" folder)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# JSON_FILE: the sea level file we downloaded
JSON_FILE = os.path.join(BASE_DIR, "data", "raw", "sea_level", "ukcp18_sea_level_ireland.json")

# ---------------------------------------------------------------
# Part 1: how is the file laid out?
# ---------------------------------------------------------------

# data: the whole file read into Python (dictionaries and lists)
with open(JSON_FILE, encoding="utf-8") as f:
    data = json.load(f)

print(f"Main sections: {list(data.keys())}")

# features: the list of rows. Each row holds its values in "attributes".
features = data["features"]
print(f"Rows: {len(features)}")

# ---------------------------------------------------------------
# Part 2: one sample row
# ---------------------------------------------------------------

print("\nFirst row:")
for name, value in features[0]["attributes"].items():
    print(f"  {name}: {value}")

# ---------------------------------------------------------------
# Part 3: how many sea points?
# ---------------------------------------------------------------

# rows: just the "attributes" of every row
rows = []
for feature in features:
    rows.append(feature["attributes"])

# table: the rows as a table, so we can count them easily
table = pd.DataFrame(rows)

# Each sea point appears once per scenario + percentile,
# so count the DIFFERENT X (longitude) / Y (latitude) pairs
points = table[["X", "Y"]].drop_duplicates()

print(f"\nDifferent sea points: {len(points)}")
print(f"Scenario + percentile codes: {sorted(table['rcp_percentile'].unique())}")

# ---------------------------------------------------------------
# Part 4: what coordinate system are X and Y in?
# ---------------------------------------------------------------

# The file says 27700 (British National Grid, metres), but that is for
# shapes, and this download has none. X and Y are ordinary columns.
print(f"\nFile says: {data['spatialReference']}")

# If X and Y were metres they'd be huge numbers. Lat/lon for Ireland
# is about -11 to -5 and 51 to 56.
print(f"X (longitude): {table['X'].min()} to {table['X'].max()}")
print(f"Y (latitude):  {table['Y'].min()} to {table['Y'].max()}")