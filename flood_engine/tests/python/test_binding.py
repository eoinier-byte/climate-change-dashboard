"""Tests for the Python binding of the flood engine (CCD-399).

The 5x5 grid and the expected cells are the same as make_table_grid() and the
"[table]" cases in flood_engine/tests/test_flood.cpp.
"""

import numpy as np
import pytest

CELL_SIZE_M = 1000.0  # 1 cell = 1 km x 1 km = 1 km2

#         c0   c1   c2   c3   c4
#   r0   SEA  0.5  1.5  3.0  3.0
#   r1   SEA  0.8  1.2  3.0  0.3   <- (1,4) inland hollow, walled by 3.0 m
#   r2   SEA  1.0  2.5  3.0  3.0
#   r3   SEA  0.4  0.9  3.0  3.0
#   r4   SEA  1.8  1.1  3.0  3.0
TABLE_ELEVATION = [
    [0.0, 0.5, 1.5, 3.0, 3.0],
    [0.0, 0.8, 1.2, 3.0, 0.3],
    [0.0, 1.0, 2.5, 3.0, 3.0],
    [0.0, 0.4, 0.9, 3.0, 3.0],
    [0.0, 1.8, 1.1, 3.0, 3.0],
]


def table_grid():
    """Elevation (float32) and sea mask (uint8) of the 5x5 table grid."""
    elevation = np.array(TABLE_ELEVATION, dtype=np.float32)
    is_sea = np.zeros((5, 5), dtype=np.uint8)
    is_sea[:, 0] = 1  # column 0 is sea
    return elevation, is_sea


# (sea level in m, flooded (row, col) cells in row-major order), as in test_flood.cpp.
TABLE_CASES = [
    (0.0, []),
    (0.5, [(0, 1), (3, 1)]),
    (1.0, [(0, 1), (1, 1), (2, 1), (3, 1), (3, 2)]),
    (1.2, [(0, 1), (1, 1), (1, 2), (2, 1), (3, 1), (3, 2), (4, 2)]),
    (
        2.0,
        [(0, 1), (0, 2), (1, 1), (1, 2), (2, 1), (3, 1), (3, 2), (4, 1), (4, 2)],
    ),
]


def flooded_cells(flooded):
    """Flooded (row, col) cells in row-major order."""
    return [(int(r), int(c)) for r, c in np.argwhere(flooded != 0)]


@pytest.mark.parametrize(("sea_level_m", "expected"), TABLE_CASES)
def test_table_grid_matches_cpp_tests(engine, sea_level_m, expected):
    elevation, is_sea = table_grid()
    result = engine.compute_flood(elevation, is_sea, CELL_SIZE_M, sea_level_m)

    assert set(result) == {"flooded", "flooded_cells", "flooded_area_km2"}
    assert set(np.unique(result["flooded"])) <= {0, 1}
    assert flooded_cells(result["flooded"]) == expected
    assert result["flooded_cells"] == len(expected)
    expected_km2 = len(expected) * CELL_SIZE_M * CELL_SIZE_M / 1e6
    assert result["flooded_area_km2"] == pytest.approx(expected_km2, abs=1e-9)


def test_output_shape_dtype_and_count(engine):
    elevation, is_sea = table_grid()
    result = engine.compute_flood(elevation, is_sea, CELL_SIZE_M, 2.0)

    flooded = result["flooded"]
    assert isinstance(flooded, np.ndarray)
    assert flooded.shape == elevation.shape
    assert flooded.dtype == np.uint8
    assert isinstance(result["flooded_cells"], int)
    assert isinstance(result["flooded_area_km2"], float)
    assert result["flooded_cells"] == int(flooded.sum())


def test_non_square_grid_rows_are_height(engine):
    # 2 rows x 3 columns, sea in column 0. (1,1) is a 3.0 m wall; (1,2) floods only
    # through (0,2). If rows and columns were swapped the shape would be (3, 2).
    elevation = np.array([[0.0, 0.2, 0.4], [0.0, 3.0, 0.1]], dtype=np.float32)
    is_sea = np.array([[1, 0, 0], [1, 0, 0]], dtype=np.uint8)
    result = engine.compute_flood(elevation, is_sea, CELL_SIZE_M, 1.0)

    assert result["flooded"].shape == (2, 3)
    assert flooded_cells(result["flooded"]) == [(0, 1), (0, 2), (1, 2)]


def test_float64_list_of_lists_and_bool_mask_are_accepted(engine):
    _, is_sea = table_grid()
    mask = is_sea.astype(bool)
    result = engine.compute_flood(TABLE_ELEVATION, mask, CELL_SIZE_M, 1.0)
    assert flooded_cells(result["flooded"]) == TABLE_CASES[2][1]


def test_any_non_zero_sea_value_is_sea(engine):
    # 256 would become 0 (land) with a plain uint8 cast; it must still count as sea.
    elevation, _ = table_grid()
    is_sea = np.zeros((5, 5), dtype=np.int64)
    is_sea[:, 0] = [256, -1, 2, 1, 1000]
    result = engine.compute_flood(elevation, is_sea, CELL_SIZE_M, 1.0)
    assert flooded_cells(result["flooded"]) == TABLE_CASES[2][1]


def test_sea_level_above_range_raises_invalid_sea_level(engine):
    elevation, is_sea = table_grid()
    with pytest.raises(ValueError, match="InvalidSeaLevel"):
        engine.compute_flood(elevation, is_sea, CELL_SIZE_M, 2.5)


def test_invalid_cell_size_raises_value_error(engine):
    elevation, is_sea = table_grid()
    with pytest.raises(ValueError, match="InvalidCellSize"):
        engine.compute_flood(elevation, is_sea, 0.0, 1.0)


def test_shape_mismatch_raises_value_error(engine):
    elevation, _ = table_grid()
    is_sea = np.zeros((5, 4), dtype=np.uint8)
    with pytest.raises(ValueError, match="same shape"):
        engine.compute_flood(elevation, is_sea, CELL_SIZE_M, 1.0)


def test_one_dimensional_input_raises_value_error(engine):
    elevation = np.zeros(5, dtype=np.float32)
    is_sea = np.zeros(5, dtype=np.uint8)
    with pytest.raises(ValueError, match="2-D"):
        engine.compute_flood(elevation, is_sea, CELL_SIZE_M, 1.0)
