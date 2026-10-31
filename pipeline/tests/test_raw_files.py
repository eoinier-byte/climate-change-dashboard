# CCD-100: check every raw climate file opens and isn't empty.
# Run from the pipeline folder:  python -m pytest tests -v
#
# - The small sample file in tests/data is always checked (this is what runs in CI).
# - The real files in data/raw are checked too, if they're on your computer.
#   If a file fails, pytest shows its name and the reason.

import os

import pytest
import xarray as xr

from filename_info import get_file_details

# ---------------------------------------------------------------
# Where the files are
# ---------------------------------------------------------------

# TESTS_DIR: the folder this file is in (pipeline/tests)
TESTS_DIR = os.path.dirname(__file__)

# SAMPLE_FILE: the small sample file in pipeline/tests/data
SAMPLE_FILE = os.path.join(TESTS_DIR, "data", "tmean_CMIP5_baseline_1976-2005_ANNUAL.nc")

# RAW_DIR: the real downloaded files in pipeline/data/raw
RAW_DIR = os.path.join(TESTS_DIR, "..", "data", "raw")


def find_raw_files():
    """Make a list of every .nc file inside data/raw and its sub-folders."""
    files = []

    # os.walk goes into every folder and sub-folder, one at a time.
    # For each one it gives us: the folder's path, its sub-folders, and its file names.
    for folder, subfolders, names in os.walk(RAW_DIR):
        for name in names:
            if name.endswith(".nc"):
                files.append(os.path.join(folder, name))

    return sorted(files)


# RAW_FILES: the list of real files (empty in CI, because they aren't on GitHub)
RAW_FILES = find_raw_files()

# ---------------------------------------------------------------
# The check
# ---------------------------------------------------------------


def check_file(path):
    """Fail with the file name and the reason if the file is broken."""

    # name: just the file name, e.g. "tmean_CMIP5_baseline_1976-2005_ANNUAL.nc"
    name = os.path.basename(path)

    # variable: the name of the data inside the file, "tmean" or "tot_prec"
    variable = get_file_details(path)["nc_variable"]

    # Open the file. If it's corrupt or half-downloaded, this line fails.
    ds = xr.open_dataset(path)

    # assert = "this must be true, or the test fails with this message"
    assert variable in ds, f"{name}: variable '{variable}' is missing"
    assert ds.sizes["time"] > 0, f"{name}: no time steps"
    assert ds[variable].notnull().any(), f"{name}: every value is empty"

    ds.close()

# ---------------------------------------------------------------
# The tests
# ---------------------------------------------------------------


def test_sample_file():
    check_file(SAMPLE_FILE)


# @pytest.mark.parametrize runs this test once for EACH file in RAW_FILES,
# so 70 files = 70 tests. ids=... names each test after its file, so if one
# fails you can see which file it was.
@pytest.mark.parametrize("path", RAW_FILES, ids=[os.path.basename(p) for p in RAW_FILES])
def test_raw_file(path):
    check_file(path)