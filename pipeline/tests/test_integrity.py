"""CCD-100: every raw NetCDF file must open and have the expected shape.

- In CI only the committed sample in tests/data/ is checked.
- On your computer, every file under data/raw/ is checked too.
A failure names the file and the reason.
"""

from pathlib import Path

import pytest

from config import CLIMATE_RAW_DIRS
from filenames import find_climate_files

xr = pytest.importorskip("xarray")

SAMPLE_DIR = Path(__file__).parent / "data"

sample_files, _ = find_climate_files([SAMPLE_DIR])
raw_files, unrecognised = find_climate_files(
    [folder for folder in CLIMATE_RAW_DIRS.values() if folder.exists()]
)
ALL_FILES = sample_files + raw_files


def test_sample_file_is_committed():
    assert sample_files, f"No sample .nc file in {SAMPLE_DIR}"


@pytest.mark.parametrize("climate_file", ALL_FILES, ids=lambda f: f.path.name)
def test_file_loads_with_expected_variable_and_dims(climate_file):
    name = climate_file.path.name
    try:
        ds = xr.open_dataset(climate_file.path, engine="netcdf4")
    except Exception as error:
        pytest.fail(f"{name}: cannot be opened ({error})")

    with ds:
        assert climate_file.nc_var in ds.data_vars, (
            f"{name}: expected variable '{climate_file.nc_var}', found {sorted(ds.data_vars)}"
        )
        var = ds[climate_file.nc_var]

        for coord in ("lat", "lon"):
            assert coord in ds.variables, f"{name}: no '{coord}' coordinate"

        if "time" in var.dims:
            assert var.sizes["time"] > 0, f"{name}: empty time dimension"

        assert int(var.count()) > 0, f"{name}: every value is empty"


def test_no_unrecognised_nc_files_in_raw():
    names = [p.name for p in unrecognised]
    assert not names, f"Unrecognised .nc files in data/raw/ (rename or remove): {names}"


def test_raw_folder_has_all_70_files_when_present():
    if not raw_files:
        pytest.skip("data/raw/ not downloaded on this machine (normal in CI)")
    assert len(raw_files) == 70, f"expected 70 climate files in data/raw/, found {len(raw_files)}"
