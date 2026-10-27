from pathlib import Path

import pytest

from filenames import find_climate_files, parse_climate_filename


@pytest.mark.parametrize(
    "name, expected",
    [
        ("tmean_CMIP5_baseline_1976-2005_ANNUAL.nc",
         ("temperature", "degC", "baseline", "1976-2005", "Annual")),
        ("tot_prec_CMIP5_rcp85_2071-2100_ensmean_final_JJA.nc",
         ("precipitation", "mm", "rcp85", "2071-2100", "Summer")),
        ("tmean_CMIP5_rcp26_2021-2050_ensmean_final_DJF.nc",
         ("temperature", "degC", "rcp26", "2021-2050", "Winter")),
        ("tot_prec_CMIP5_rcp45_2021-2050_ensmid_final_SON.nc",      # name used in the .zip
         ("precipitation", "mm", "rcp45", "2021-2050", "Autumn")),
        ("tmean_CMIP5_rcp45_2071-2100_ensmean_final_MAM.nc",
         ("temperature", "degC", "rcp45", "2071-2100", "Spring")),
    ],
)
def test_recognised_names(name, expected):
    parsed = parse_climate_filename(name)
    assert parsed is not None
    assert (parsed.variable, parsed.unit, parsed.scenario, parsed.period, parsed.season) == expected


@pytest.mark.parametrize(
    "name",
    [
        "tmax_CMIP5_rcp45_2021-2050_ensmean_final_ANNUAL.nc",     # variable not used
        "tmean_CMIP5_rcp60_2021-2050_ensmean_final_ANNUAL.nc",    # RCP6.0 not used
        "tmean_CMIP5_rcp45_2041-2070_ensmean_final_ANNUAL.nc",    # period not used
        "tmean_CMIP5_baseline_2021-2050_ANNUAL.nc",               # baseline with future period
        "tmean_CMIP5_rcp45_1976-2005_ensmean_final_ANNUAL.nc",    # projection with baseline period
        "tmean_CMIP5_rcp45_2021-2050_ensmean_final_ANNUAL.csv",   # not NetCDF
        "notes.nc",
    ],
)
def test_unrecognised_names_return_none(name):
    assert parse_climate_filename(name) is None


def test_find_climate_files_ignores_folder_layout(tmp_path):
    (tmp_path / "anywhere" / "deep").mkdir(parents=True)
    good = tmp_path / "anywhere" / "deep" / "tmean_CMIP5_baseline_1976-2005_ANNUAL.nc"
    bad = tmp_path / "anywhere" / "other.nc"
    good.touch()
    bad.touch()

    found, skipped = find_climate_files([tmp_path])

    assert [f.path for f in found] == [good]
    assert skipped == [bad]


def test_sample_file_name_is_recognised():
    sample = Path(__file__).parent / "data" / "tmean_CMIP5_baseline_1976-2005_ANNUAL.nc"
    assert parse_climate_filename(sample) is not None
