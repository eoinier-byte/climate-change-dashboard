# CCD-275: remove bad values before we work out the county averages.
#
# A value is BAD if it is:
#   - empty (NaN, "not a number")
#   - the "no data" code -9999
#   - outside the allowed range in cleaning_ranges.py (e.g. 365 instead of 36.5)
#
# Bad values are removed. We never replace them with a made-up number.

import numpy as np

from cleaning_ranges import FILL_VALUE, RANGES


def clean_values(values, variable):
    """
    Remove the bad values from a table.

    values:   a table with a column called "value"
    variable: "temperature" or "precipitation"

    Gives back two things:
      clean:  the table with the bad rows removed
      report: how many of each kind of bad value were found
    """

    # The lowest and highest value allowed for this variable
    lowest, highest = RANGES[variable]

    # Counters: how many of each problem we find
    nulls = 0
    fill_values = 0
    out_of_range = 0

    # keep: one True/False for each row. True = keep the row, False = remove it
    keep = []

    # Look at every value, once
    for value in values["value"]:

        if np.isnan(value):
            # Empty value
            nulls = nulls + 1
            keep.append(False)

        elif value == FILL_VALUE:
            # The "no data" code
            fill_values = fill_values + 1
            keep.append(False)

        elif value < lowest or value > highest:
            # Too low or too high to be real
            out_of_range = out_of_range + 1
            keep.append(False)

        else:
            # A good value
            keep.append(True)

    # clean: only the rows where keep is True
    clean = values[keep]

    # report: the counts, so we can print what was removed
    report = {
        "rows_in": len(values),
        "nulls": nulls,
        "fill_values": fill_values,
        "out_of_range": out_of_range,
        "rows_out": len(clean),
    }

    return clean, report