# CCD-31 / CCD-36: average one climate file for each county.
# It's a function so tests/test_aggregate.py can check it on a tiny grid.

from clean import clean_values


def county_averages(cells, grid, variable):
    """
    cells:    a table with one row per land cell: row, col, county
    grid:     the values from one climate file (rows x columns)
    variable: "temperature" or "precipitation"

    Returns the average for each county, and the cleaning report.
    """
    # Look up this file's value at every cell, by row and column
    values = cells[["county"]].copy()
    values["value"] = grid[cells["row"], cells["col"]]

    # Remove empty, -9999 and impossible values (CCD-275)
    values, report = clean_values(values, variable)

    averages = values.groupby("county")["value"].mean()
    return averages, report
