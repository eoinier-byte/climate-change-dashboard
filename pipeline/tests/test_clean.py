"""CCD-275: a deliberately bad sample must have every problem flagged."""

import numpy as np
import pandas as pd
import pytest

from clean import clean, flag_values, range_for
from config import PLAUSIBLE_RANGES


def bad_temperature_sample():
    return pd.DataFrame(
        {
            "lat": [52.0, 52.1, 52.2, 52.3, 52.4, 52.5],
            "lon": [-8.0, -8.1, -8.2, -8.3, -8.4, -8.5],
            "tmean": [
                10.4,      # ok
                np.nan,    # null (e.g. a sea cell)
                365.0,     # out of range - typo for 36.5
                -9999.0,   # fill value
                9.97e36,   # NetCDF default fill value
                11.2,      # ok
            ],
        }
    )


def test_each_problem_is_flagged():
    flags = flag_values(bad_temperature_sample()["tmean"], "temperature", "Annual")
    assert flags.tolist() == ["ok", "null", "out_of_range", "fill_value", "fill_value", "ok"]


def test_clean_keeps_only_good_rows_and_reports_counts():
    kept, report = clean(bad_temperature_sample(), "tmean", "temperature", "Annual", source="sample")

    assert kept["tmean"].tolist() == [10.4, 11.2]
    assert kept["tmean"].isna().sum() == 0                  # Done when: zero nulls
    assert (report.rows_in, report.null, report.fill_value, report.out_of_range, report.rows_out) == (6, 1, 2, 1, 2)
    assert report.flagged == 4


def test_clean_never_changes_values():
    sample = bad_temperature_sample()
    original = sample.copy()
    kept, _ = clean(sample, "tmean", "temperature", "Annual")

    pd.testing.assert_frame_equal(sample, original)          # input untouched
    assert set(kept["tmean"]) <= set(original["tmean"].dropna())   # nothing filled in


def test_precipitation_annual_and_seasonal_ranges_differ():
    values = pd.Series([200.0, 3000.0])
    assert flag_values(values, "precipitation", "Annual").tolist() == ["out_of_range", "ok"]
    assert flag_values(values, "precipitation", "Winter").tolist() == ["ok", "out_of_range"]


def test_boundaries_are_inclusive():
    low, high = range_for("temperature", "Annual")
    assert flag_values(pd.Series([low, high]), "temperature", "Annual").tolist() == ["ok", "ok"]


def test_sea_level_over_two_metres_is_flagged():
    flags = flag_values(pd.Series([55.0, 550.0]), "sea_level", "Annual")
    assert flags.tolist() == ["ok", "out_of_range"]       # 550 cm = mm/cm mix-up


@pytest.mark.parametrize("key", list(PLAUSIBLE_RANGES))
def test_every_range_is_low_below_high(key):
    low, high = PLAUSIBLE_RANGES[key]
    assert low < high


def test_unknown_variable_raises():
    with pytest.raises(KeyError):
        range_for("wind", "Annual")
