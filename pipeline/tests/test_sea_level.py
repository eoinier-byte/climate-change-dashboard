import pandas as pd
import pytest

import sea_level


def ukcp18_sample():
    """Two cells, values chosen so the averages are easy to check."""
    rows = []
    for x, y in [(-8.0, 51.8), (-6.1, 53.4)]:
        for scenario in ("rcp26", "rcp45", "rcp85"):
            for pct in ("5", "50", "95"):
                row = {"X": x, "Y": y, "rcp_percentile": f"{scenario}_{pct}"}
                for year in range(2010, 2101, 10):
                    row[f"seaLevelAnom_{year}"] = float(year - 2000)   # 2030 -> 30, 2100 -> 100
                if pct != "50":
                    for year in range(2010, 2101, 10):
                        row[f"seaLevelAnom_{year}"] = 999.0             # must be ignored
                rows.append(row)
    return pd.DataFrame(rows)


def test_period_means_use_median_only():
    out = sea_level.period_means(ukcp18_sample())
    assert (out["value"] != 999.0).all()
    assert len(out) == 2 * 3 * 2                 # cells x scenarios x periods
    assert set(out["scenario"]) == {"rcp26", "rcp45", "rcp85"}


def test_period_means_average_the_right_decades():
    out = sea_level.period_means(ukcp18_sample())
    by_period = out.groupby("period")["value"].unique()
    assert by_period["2021-2050"].tolist() == [40.0]    # mean of 30, 40, 50
    assert by_period["2071-2100"].tolist() == [90.0]    # mean of 80, 90, 100


def test_missing_year_column_raises():
    cells = ukcp18_sample().drop(columns="seaLevelAnom_2040")
    with pytest.raises(ValueError, match="seaLevelAnom_2040"):
        sea_level.period_means(cells)


def test_county_rows_format():
    assigned = pd.DataFrame(
        {
            "AREA_NAME": ["Cork", "Cork", "Dublin"],
            "scenario": ["rcp45", "rcp45", "rcp45"],
            "period": ["2071-2100"] * 3,
            "value": [50.0, 52.0, 43.0],
        }
    )
    rows = sea_level.county_rows(assigned)
    assert rows == [
        {"county": "Cork", "variable": "sea_level", "scenario": "rcp45", "period": "2071-2100",
         "season": "Annual", "value": 51.0, "unit": "cm"},
        {"county": "Dublin", "variable": "sea_level", "scenario": "rcp45", "period": "2071-2100",
         "season": "Annual", "value": 43.0, "unit": "cm"},
    ]


def test_cells_attach_to_nearest_county_and_skip_far_or_northern_ireland():
    gpd = pytest.importorskip("geopandas")
    from shapely.geometry import box

    # Two square "counties" in lat/lon, side by side.
    counties = gpd.GeoDataFrame(
        {"AREA_NAME": ["Cork", "Northern Ireland"]},
        geometry=[box(-9.0, 51.5, -8.0, 52.0), box(-6.5, 54.0, -5.5, 54.5)],
        crs="EPSG:4326",
    )
    cells = pd.DataFrame(
        {
            "lon": [-8.5, -6.0, -3.0],          # off Cork, off N. Ireland, far away (Wales)
            "lat": [51.45, 54.55, 52.0],        # Cork cell is ~5.5 km south of the box
            "scenario": ["rcp45"] * 3,
            "period": ["2071-2100"] * 3,
            "value": [50.0, 40.0, 30.0],
        }
    )
    assigned = sea_level.assign_to_counties(cells, counties)
    assert assigned["AREA_NAME"].tolist() == ["Cork"]
