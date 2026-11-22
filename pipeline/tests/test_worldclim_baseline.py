# CCD-355: check worldclim_baseline.py on tiny pretend files, so no download is needed.
#
# The pretend WorldClim grid has 4 x 4 cells of 1 degree, from longitude 0 to 4 and
# latitude 4 down to 0. Each month's value is chosen so we know the right answers:
#
#   temperature in month m (1 = January) at row r, column c = m + 10*r + c
#       summer at a cell = mean of months 6, 7, 8  = 7 + 10*r + c
#       winter at a cell = mean of months 12, 1, 2 = 5 + 10*r + c
#   precipitation = 10 mm every month, so the annual total is 120 mm
#
#   Cell (row 0, col 0) is sea: no data in every month.
#
# Run from the pipeline folder:  python -m pytest tests -v

import zipfile

import geopandas as gpd
import numpy as np
import pandas as pd
import pytest
import rasterio
from rasterio.transform import from_origin
from shapely.geometry import Point, box
from worldclim_baseline import (
    city_values,
    climate_grids,
    county_values,
    find_cell,
    load_cities,
    read_months,
    validate,
    worldclim_months,
)

NODATA = -9999.0
TRANSFORM = from_origin(0, 4, 1, 1)  # top-left corner (lon 0, lat 4), 1-degree cells


def write_month(path, values):
    """Save one 4 x 4 month as a GeoTIFF, the way WorldClim stores them."""
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=4,
        width=4,
        count=1,
        dtype="float32",
        crs="EPSG:4326",
        transform=TRANSFORM,
        nodata=NODATA,
    ) as dst:
        dst.write(values.astype("float32"), 1)


def make_zip(folder, variable, month_values):
    """A pretend wc2.1_10m_<variable>.zip with 12 GeoTIFFs, named like the real ones."""
    zip_path = folder / f"wc2.1_10m_{variable}.zip"
    with zipfile.ZipFile(zip_path, "w") as archive:
        for month in range(1, 13):
            tif = folder / f"wc2.1_10m_{variable}_{month:02d}.tif"
            write_month(tif, month_values(month))
            archive.write(tif, tif.name)
    return zip_path


@pytest.fixture
def grids(tmp_path):
    rows, cols = np.indices((4, 4))

    def temperature(month):
        values = month + 10.0 * rows + cols
        values[0, 0] = NODATA  # the sea cell
        return values

    def precipitation(month):
        values = np.full((4, 4), 10.0)
        values[0, 0] = NODATA
        return values

    tavg, transform = read_months(
        worldclim_months(str(make_zip(tmp_path, "tavg", temperature)))
    )
    prec, _ = read_months(
        worldclim_months(str(make_zip(tmp_path, "prec", precipitation)))
    )
    assert transform == TRANSFORM
    return climate_grids(tavg, prec)


def test_seasonal_means_and_annual_total(grids):
    # Row 2, column 3: summer 7 + 20 + 3 = 30, winter 5 + 20 + 3 = 28
    assert grids["summer_temp_c"][2, 3] == pytest.approx(30.0)
    assert grids["winter_temp_c"][2, 3] == pytest.approx(28.0)
    assert grids["annual_precip_mm"][2, 3] == pytest.approx(120.0)


def test_no_data_becomes_empty(grids):
    assert np.isnan(grids["summer_temp_c"][0, 0])
    assert np.isnan(grids["annual_precip_mm"][0, 0])


def test_city_on_a_land_cell_uses_that_cell(grids):
    # (lon 3.5, lat 1.5) is row 2, column 3
    values, note = city_values(grids, TRANSFORM, 3.5, 1.5)
    assert values["summer_temp_c"] == pytest.approx(30.0)
    assert note == ""


def test_city_on_the_sea_cell_uses_the_nearest_land_cell(grids):
    # (lon 0.5, lat 3.5) is the sea cell (row 0, col 0). The nearest land is one cell
    # away; the search finds row 0, column 1 first: summer 7 + 0 + 1 = 8.
    values, note = city_values(grids, TRANSFORM, 0.5, 3.5)
    assert values["summer_temp_c"] == pytest.approx(8.0)
    assert values["annual_precip_mm"] == pytest.approx(120.0)
    assert "nearest valid cell (+0 rows, +1 columns)" in note


def test_city_with_no_land_within_two_cells_is_an_error():
    valid = np.zeros((6, 6), dtype=bool)
    valid[5, 5] = True  # the only land is 5 cells away from (0, 0)
    transform = from_origin(0, 6, 1, 1)
    with pytest.raises(ValueError, match="No valid cell within 2 cells"):
        find_cell(valid, transform, 0.5, 5.5)


def test_county_mean_over_the_cells_inside(grids):
    # This square holds the centres of rows 1-2, columns 1-2.
    # Summer there: 7 + 10*r + c, average = 7 + 15 + 1.5 = 23.5
    values, cells = county_values(grids, TRANSFORM, box(1, 1, 3, 3))
    assert cells == 4
    assert values["summer_temp_c"] == pytest.approx(23.5)
    assert values["annual_precip_mm"] == pytest.approx(120.0)


def test_county_skips_the_sea_cell(grids):
    # The top-left 2 x 2 cells include the sea cell, so only 3 land cells are averaged:
    # summer at (0,1), (1,0), (1,1) = 8, 17, 18, average 43 / 3
    values, cells = county_values(grids, TRANSFORM, box(0, 2, 2, 4))
    assert cells == 3
    assert values["summer_temp_c"] == pytest.approx(43 / 3)


def test_county_with_too_few_cells_is_an_error(grids):
    with pytest.raises(ValueError, match="Only 1 cells"):
        county_values(grids, TRANSFORM, box(2, 2, 3, 3))


def test_cities_are_matched_by_exact_name_and_country(tmp_path):
    places = gpd.GeoDataFrame(
        {
            "NAME": ["London", "Londonderry/Derry", "Porto"],
            "ADM0NAME": ["United Kingdom", "United Kingdom", "Portugal"],
            "LATITUDE": [51.5, 55.0, 41.15],
            "LONGITUDE": [-0.12, -7.33, -8.62],
        },
        geometry=[Point(-0.12, 51.5), Point(-7.33, 55.0), Point(-8.62, 41.15)],
        crs="EPSG:4326",
    )
    places_path = tmp_path / "places.geojson"
    places.to_file(places_path)

    cities_file = tmp_path / "cities.csv"
    cities_file.write_text("city,country\nLondon,United Kingdom\nPorto,Portugal\n")
    cities = load_cities(cities_file, places_path)
    assert cities["latitude"].tolist() == [51.5, 41.15]

    cities_file.write_text("city,country\nAtlantis,United Kingdom\n")
    with pytest.raises(ValueError, match="Atlantis, United Kingdom: 0 matches"):
        load_cities(cities_file, places_path)


def good_table():
    return pd.DataFrame(
        {
            "city": ["Brest", "Porto"],
            "summer_temp_c": [16.0, 20.0],
            "winter_temp_c": [7.0, 10.0],
            "annual_precip_mm": [1200.0, 1250.0],
        }
    )


def test_validation_accepts_good_rows():
    validate(good_table(), "city", expected_rows=2)


@pytest.mark.parametrize(
    "change, message",
    [
        ({"winter_temp_c": [7.0, None]}, "empty values"),
        ({"summer_temp_c": [16.0, 40.0]}, "summer_temp_c outside -20..35"),
        ({"annual_precip_mm": [50.0, 1250.0]}, "annual_precip_mm outside 100..4000"),
        ({"city": ["Brest", "Brest"]}, "repeated city"),
    ],
)
def test_validation_rejects_bad_rows(change, message):
    table = good_table().assign(**change)
    with pytest.raises(ValueError, match=message):
        validate(table, "city")


def test_validation_rejects_the_wrong_number_of_rows():
    with pytest.raises(ValueError, match="2 rows, expected 26"):
        validate(good_table(), "city", expected_rows=26)
