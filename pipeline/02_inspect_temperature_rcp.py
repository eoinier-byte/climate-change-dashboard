"""
STEP 02 - View the temperature projection (RCP) files.

Opens each file in the rcp26, rcp45 and rcp85 temperature folders and prints:
  - what's inside it (grid size, coordinates, variables)
  - the attributes (labels) attached to the temperature, e.g. units

How to run (from the pipeline folder):
    python 02_inspect_temperature_rcp.py
"""

import os

import xarray as xr

# BASE_DIR: the folder this script is in (the "pipeline" folder)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# TEMPERATURE_DIR: where the temperature folders are
TEMPERATURE_DIR = os.path.join(BASE_DIR, "data", "raw", "temperature")

# SCENARIOS: one folder per scenario
SCENARIOS = ["rcp26", "rcp45", "rcp85"]

for scenario in SCENARIOS:

    # folder: e.g. data/raw/temperature/rcp45
    folder = os.path.join(TEMPERATURE_DIR, scenario)

    # Go through every file in the folder, in alphabetical order
    for filename in sorted(os.listdir(folder)):

        # Skip anything that isn't a NetCDF (.nc) file
        if not filename.endswith(".nc"):
            continue

        print("=" * 60)
        print(filename)
        print("=" * 60)

        # path: the full location of the file
        path = os.path.join(folder, filename)

        # ds: the opened file ("dataset")
        ds = xr.open_dataset(path)

        # Print what's inside: grid size, lat/lon/time, and the variables stored
        print(ds)

        # The temperature is stored under the name "tmean"
        print("\nAttributes of 'tmean':")
        for name, value in ds["tmean"].attrs.items():
            print(f"  {name}: {value}")

        print()
        ds.close()