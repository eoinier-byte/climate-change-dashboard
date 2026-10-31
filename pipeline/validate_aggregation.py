"""
CCD-36 - Check the county averages in climate_data.csv are right.

Check 1: For Cork and Dublin, work out the average temperature and
         rainfall AGAIN, a different way, and compare with the pipeline.
         The pipeline uses gpd.sjoin() to find which cells are in a county.
         This script goes through every cell one by one instead, and asks
         "is this point inside the county outline?"

Check 2: Every county's value must be between the lowest and the highest
         value in the file. (An average can't be bigger than every cell.)

Both checks use the baseline annual files.

Run from the pipeline folder, after process_climate_data.py:
    python validate_aggregation.py      (takes about a minute)
Then write the results into docs/validation-log.md.
"""

import geopandas as gpd
import numpy as np
import pandas as pd
import xarray as xr
from shapely.geometry import Point   # Point = one spot on the map (longitude, latitude)

from clean import clean_values

# ---------------------------------------------------------------
# Settings
# ---------------------------------------------------------------

COUNTIES_TO_CHECK = ["Cork", "Dublin"]

# The two files we check
TEMPERATURE_FILE = "data/raw/temperature/baseline/tmean_CMIP5_baseline_1976-2005_ANNUAL.nc"
RAINFALL_FILE = "data/raw/precipitation/baseline/tot_prec_CMIP5_baseline_1976-2005_ANNUAL.nc"

# The pipeline rounds to 3 decimal places, so a difference this small is just rounding
TOLERANCE = 0.0005

# ---------------------------------------------------------------
# Load everything
# ---------------------------------------------------------------

# climate: the pipeline's results, which we're checking
climate = pd.read_csv("data/processed/climate_data.csv")

# counties: the county outlines (same file the pipeline uses)
counties = gpd.read_file("data/boundaries/counties_tailte_eireann_2019.geojson")
counties["county"] = counties["ENGLISH"].str.title()   # "CORK" -> "Cork"

# The temperature file: a grid of temperatures, plus the lat/lon of each row and column
ds = xr.open_dataset(TEMPERATURE_FILE)
temperature = ds["tmean"].values[0]
lats = ds["lat"].values    # the latitude of each row
lons = ds["lon"].values    # the longitude of each column
ds.close()

# The rainfall file: same grid
ds = xr.open_dataset(RAINFALL_FILE)
rainfall = ds["tot_prec"].values[0]
ds.close()


def get_pipeline_value(county, variable):
    """Find the baseline annual value the pipeline saved for this county."""
    row = climate[
        (climate["county"] == county)
        & (climate["variable"] == variable)
        & (climate["scenario"] == "baseline")
        & (climate["season"] == "Annual")
    ]
    return row["value"].iloc[0]


# ---------------------------------------------------------------
# Check 1: recompute Cork and Dublin
# ---------------------------------------------------------------

print("Check 1: recompute Cork and Dublin")
check_1_problems = 0

for county in COUNTIES_TO_CHECK:

    # outline: this county's shape on the map
    outline = counties[counties["county"] == county].geometry.iloc[0]

    # The values of every cell inside this county get added to these lists
    temperature_values = []
    rainfall_values = []

    # Go through every cell in the grid, one row and one column at a time
    for row in range(len(lats)):
        for col in range(len(lons)):

            # Skip sea cells (the pipeline only uses cells that have a temperature)
            if np.isnan(temperature[row, col]):
                continue

            # Is the middle of this cell inside the county?
            if outline.contains(Point(lons[col], lats[row])):
                temperature_values.append(temperature[row, col])
                rainfall_values.append(rainfall[row, col])

    # Clean the values the same way the pipeline does, then average them
    for variable, cell_values in [("temperature", temperature_values),
                                  ("precipitation", rainfall_values)]:

        table = pd.DataFrame({"value": cell_values})
        table, report = clean_values(table, variable)
        my_value = table["value"].mean()

        pipeline_value = get_pipeline_value(county, variable)
        difference = abs(my_value - pipeline_value)

        print(f"  {county} {variable}: mine = {my_value:.3f}, "
              f"pipeline = {pipeline_value:.3f}, difference = {difference:.4f}")

        if difference > TOLERANCE:
            check_1_problems = check_1_problems + 1
            print("    ^ DIFFERENT - explain this or log a Jira bug")

# ---------------------------------------------------------------
# Check 2: every county value is between the file's lowest and highest value
# ---------------------------------------------------------------

print("\nCheck 2: every county is inside the file's range")
check_2_problems = 0

for variable, grid in [("temperature", temperature), ("precipitation", rainfall)]:

    # nanmin / nanmax: the lowest and highest value, ignoring empty cells
    lowest = np.nanmin(grid)
    highest = np.nanmax(grid)
    print(f"  {variable}: file goes from {lowest:.3f} to {highest:.3f}")

    for county in counties["county"]:
        value = get_pipeline_value(county, variable)
        if value < lowest or value > highest:
            check_2_problems = check_2_problems + 1
            print(f"    OUT OF RANGE: {county} = {value}")

# ---------------------------------------------------------------
# Result
# ---------------------------------------------------------------

print(f"\nCheck 1: {check_1_problems} differences")
print(f"Check 2: {check_2_problems} problems")