"""
STEP 08 - Turn the UKCP18 sea level JSON into a simple CSV.

Step 07 showed the JSON is big and nested: the values are inside
"features" -> "attributes", mixed in with map details we don't need.

This script keeps only the columns we need:
    X, Y, rcp_percentile, seaLevelAnom_2010 ... seaLevelAnom_2100
and saves them as a CSV, one row per sea point + scenario + percentile.

All percentiles are kept (5th, 50th, 95th) because this is still RAW data.
process_climate_data.py picks the 50th percentile later.

This script WRITES a file:
    data/raw/sea_level/ukcp18_sea_level_ireland.csv

How to run (from the pipeline folder):
    python 08_sea_level_json_to_csv.py
"""

import json
import os

import pandas as pd

# ---------------------------------------------------------------
# Where the files are
# ---------------------------------------------------------------

# BASE_DIR: the folder this script is in (the "pipeline" folder)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# SEA_LEVEL_DIR: the folder holding the sea level files
SEA_LEVEL_DIR = os.path.join(BASE_DIR, "data", "raw", "sea_level")

# JSON_FILE: the file we downloaded (read)
JSON_FILE = os.path.join(SEA_LEVEL_DIR, "ukcp18_sea_level_ireland.json")

# CSV_FILE: the file this script makes (written)
CSV_FILE = os.path.join(SEA_LEVEL_DIR, "ukcp18_sea_level_ireland.csv")

# COLUMNS_TO_KEEP: the columns we keep (Step 07 showed what each one means)
COLUMNS_TO_KEEP = [
    "X",  # longitude of the sea point
    "Y",  # latitude of the sea point
    "rcp_percentile",  # e.g. "rcp45_50"
    "seaLevelAnom_2010",  # sea level rise in cm for each decade
    "seaLevelAnom_2020",
    "seaLevelAnom_2030",
    "seaLevelAnom_2040",
    "seaLevelAnom_2050",
    "seaLevelAnom_2060",
    "seaLevelAnom_2070",
    "seaLevelAnom_2080",
    "seaLevelAnom_2090",
    "seaLevelAnom_2100",
]

# ---------------------------------------------------------------
# Read the JSON and make a table
# ---------------------------------------------------------------

# data: the whole JSON file read into Python
with open(JSON_FILE, encoding="utf-8") as f:
    data = json.load(f)

# rows: the "attributes" taken out of every row (same as Step 07)
rows = []
for feature in data["features"]:
    rows.append(feature["attributes"])

# table: the rows as a table
table = pd.DataFrame(rows)

# ---------------------------------------------------------------
# Keep only the columns we need, in a tidy order
# ---------------------------------------------------------------

table = table[COLUMNS_TO_KEEP]

# Sort so each sea point's 9 rows sit together
table = table.sort_values(["X", "Y", "rcp_percentile"])

# ---------------------------------------------------------------
# Save as CSV
# ---------------------------------------------------------------

# index=False stops pandas adding an extra row-number column
table.to_csv(CSV_FILE, index=False)

# json_kb, csv_kb: the size of each file in KB, to show how much smaller the CSV is
json_kb = os.path.getsize(JSON_FILE) / 1024
csv_kb = os.path.getsize(CSV_FILE) / 1024

print(f"Read:  {JSON_FILE}")
print(f"       {json_kb:.0f} KB, {len(table)} rows")
print(f"Wrote: {CSV_FILE}")
print(f"       {csv_kb:.0f} KB, {len(table)} rows x {len(table.columns)} columns")
print(f"\nColumns: {', '.join(table.columns)}")
print("\nFirst 3 rows:")
print(table.head(3).to_string(index=False))
