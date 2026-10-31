# CCD-36: check the county averages are worked out correctly.
#
# The real files have 451 x 351 cells, far too many to check by hand.
# So this test makes a small pretend file of 2 rows x 3 columns, with two
# pretend counties, "A" and "B". We already know the right averages,
# so we can check county_averages() gets the same answer.
#
#   The pretend grid:
#
#                col 0   col 1   col 2
#      row 0      10      12       5
#      row 1      14     empty     7
#
#   County A owns the 4 cells in columns 0 and 1.
#   One of them is empty, so it gets removed, leaving 10, 12 and 14.
#       right answer: (10 + 12 + 14) / 3 = 12
#
#   County B owns the 2 cells in column 2: 5 and 7.
#       right answer: (5 + 7) / 2 = 6
#
# Run from the pipeline folder:  python -m pytest tests -v

import numpy as np
import pandas as pd

from aggregate import county_averages


def test_county_averages_on_a_tiny_grid():

    # The pretend climate file (np.nan = an empty cell)
    grid = np.array([
        [10.0, 12.0, 5.0],      # row 0
        [14.0, np.nan, 7.0],    # row 1
    ])

    # Which county each cell belongs to. Read it down the columns:
    # the first cell is row 0, col 0, in county A, and so on.
    cells = pd.DataFrame({
        "row":    [0, 0, 1, 1, 0, 1],
        "col":    [0, 1, 0, 1, 2, 2],
        "county": ["A", "A", "A", "A", "B", "B"],
    })

    # Run our function
    averages, report = county_averages(cells, grid, "temperature")

    # assert = "this must be true, or the test fails"
    assert averages["A"] == 12     # the answer we worked out by hand
    assert averages["B"] == 6
    assert report["nulls"] == 1    # the one empty cell was found and removed