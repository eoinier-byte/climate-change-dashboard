# CCD-239: tests for spot_check.py on tiny made-up inputs (never the real files).
#
# Climate: a 3 x 4 grid. The county is the square from lon 0.5 to 2.5, lat 0.5 to 1.5,
# so it holds the cells at row 1, columns 1 and 2. Row 0 is sea (NaN in the land grid).
#
#               col 0   col 1   col 2   col 3      (lon 0, 1, 2, 3)
#      row 0    sea     sea     sea     sea        (lat 0)
#      row 1     1       8      10       1         (lat 1)
#      row 2     1       1       1       1         (lat 2)
#
#   right answer: (8 + 10) / 2 = 9
#
# Run from the pipeline folder:  python -m pytest tests -v

import numpy as np
import pytest
from shapely.geometry import Point, box
from spot_check import (
    county_cells,
    county_mean,
    file_range,
    nearest_county,
    sea_level_mean,
)

LATS = np.array([0.0, 1.0, 2.0])
LONS = np.array([0.0, 1.0, 2.0, 3.0])
LAND = np.array(
    [
        [np.nan, np.nan, np.nan, np.nan],
        [1.0, 8.0, 10.0, 1.0],
        [1.0, 1.0, 1.0, 1.0],
    ]
)
COUNTY = box(0.5, 0.5, 2.5, 1.5)


def test_county_cells_finds_only_land_cells_inside_the_outline():
    rows, cols = county_cells(COUNTY, LAND, LATS, LONS)
    assert sorted(zip(rows.tolist(), cols.tolist())) == [(1, 1), (1, 2)]


def test_sea_cells_are_skipped_even_inside_the_outline():
    # The outline now also covers row 0, which is sea in the land grid.
    rows, _ = county_cells(box(0.5, -0.5, 2.5, 1.5), LAND, LATS, LONS)
    assert 0 not in rows.tolist()


def test_county_mean_on_the_tiny_grid():
    rows, cols = county_cells(COUNTY, LAND, LATS, LONS)
    assert county_mean(LAND, rows, cols, "temperature") == pytest.approx(9.0)


def test_county_mean_drops_fill_and_out_of_range_values_like_the_pipeline():
    grid = LAND.copy()
    grid[1, 2] = -9999  # fill value: removed, so only 8 is left
    rows, cols = county_cells(COUNTY, LAND, LATS, LONS)
    assert county_mean(grid, rows, cols, "temperature") == pytest.approx(8.0)
    grid[1, 1] = 365  # out of the temperature range: removed too, nothing left
    with pytest.raises(ValueError, match="no valid cells"):
        county_mean(grid, rows, cols, "temperature")


def test_file_range_ignores_empty_cells():
    assert file_range(LAND) == (1.0, 10.0)


# Sea level: two square "counties" 10 km apart, in metres (like EPSG:2157).
#   A = 0..1000 m, B = 11000..12000 m. Distance limit 1500 m.
OUTLINES = {"A": box(0, 0, 1000, 1000), "B": box(11000, 0, 12000, 1000)}


def test_nearest_county_assigns_by_distance_and_drops_far_points():
    points = [Point(1500, 500), Point(10000, 500), Point(6000, 500), Point(500, 500)]
    # 500 m from A; 1000 m from B; 5000 m from both (too far); inside A
    assert nearest_county(points, OUTLINES, 1500) == ["A", "B", None, "A"]


def test_sea_level_mean_uses_only_that_county_and_scenario():
    features = [
        {"OBJECTID": 1, "rcp_percentile": "rcp45_50", "seaLevelAnom_2050": 10.0},
        {"OBJECTID": 2, "rcp_percentile": "rcp45_50", "seaLevelAnom_2050": 20.0},
        {
            "OBJECTID": 3,
            "rcp_percentile": "rcp85_50",
            "seaLevelAnom_2050": 99.0,
        },  # other scenario
        {
            "OBJECTID": 4,
            "rcp_percentile": "rcp45_50",
            "seaLevelAnom_2050": 50.0,
        },  # county B
    ]
    assigned = ["A", "A", "A", "B"]
    assert sea_level_mean(features, assigned, "A", "rcp45", 2050) == (15.0, [1, 2])


def test_sea_level_mean_with_no_points_is_a_clear_error():
    with pytest.raises(ValueError, match="no UKCP18 points for A rcp26"):
        sea_level_mean([], [], "A", "rcp26", 2050)
