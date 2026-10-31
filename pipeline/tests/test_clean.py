# CCD-275: tests for clean.py
#
# How a test works:
#   1. Make some sample data
#   2. Run our function on it
#   3. Use "assert" to check the answer.
#      assert means "this MUST be true". If it's false, the test fails
#      and pytest shows you which line was wrong.
#
# Run from the pipeline folder:  python -m pytest tests -v

import numpy as np
import pandas as pd

from clean import clean_values


def test_bad_values_are_removed():
    # 1. Sample data: a table with 4 temperatures
    #      10.5    a good value
    #      np.nan  an empty value
    #      -9999   the "no data" code
    #      365.0   a wrong value (someone typed 365 instead of 36.5)
    values = pd.DataFrame({"value": [10.5, np.nan, -9999, 365.0]})

    # 2. Run our function
    clean, report = clean_values(values, "temperature")

    # 3. Check it found exactly one of each problem...
    assert report["nulls"] == 1
    assert report["fill_values"] == 1
    assert report["out_of_range"] == 1

    # ...and only the good value is left
    assert list(clean["value"]) == [10.5]


def test_good_values_are_kept():
    # 1. Sample data: 3 normal yearly rainfall totals, all good
    values = pd.DataFrame({"value": [900.0, 1200.0, 1500.0]})

    # 2. Run our function
    clean, report = clean_values(values, "precipitation")

    # 3. Check nothing was removed (3 rows went in, 3 came out)
    assert report["rows_out"] == 3