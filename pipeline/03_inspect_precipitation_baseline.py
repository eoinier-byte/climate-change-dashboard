"""
STEP 03 - View the rainfall (precipitation) baseline files (1976-2005).

Opens each file in data/raw/precipitation/baseline and prints:
  - what's inside it (grid size, coordinates, variables)
  - the attributes (labels) attached to the rainfall, e.g. units

How to run (from the pipeline folder):
    python 03_inspect_precipitation_baseline.py
"""

import os

import xarray as xr

# BASE_DIR: the folder this script is in (the "pipeline" folder)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# FOLDER: where the rainfall baseline files are
FOLDER = os.path.join(BASE_DIR, "data", "raw", "precipitation", "baseline")

# Go through every file in the folder, in alphabetical order
for filename in sorted(os.listdir(FOLDER)):

    # Skip anything that isn't a NetCDF (.nc) file
    if not filename.endswith(".nc"):
        continue

    print("=" * 60)
    print(filename)
    print("=" * 60)

    # path: the full location of the file
    path = os.path.join(FOLDER, filename)

    # ds: the opened file ("dataset")
    ds = xr.open_dataset(path)

    # Print what's inside: grid size, lat/lon/time, and the variables stored
    print(ds)

    # The rainfall is stored under the name "tot_prec" (total precipitation)
    print("\nAttributes of 'tot_prec':")
    for name, value in ds["tot_prec"].attrs.items():
        print(f"  {name}: {value}")

    print()
    ds.close()