# CCD-420: tests for build_land_polygon.py on tiny made-up shapes (never the real boundaries).
#
# Run from the pipeline folder:  python -m pytest tests/test_build_land_polygon.py -v

import build_land_polygon as blp
import geopandas as gpd
import pytest
from shapely.geometry import Polygon, box

# Two 1 km squares in ITM metres with a 20 m gap between them (like an ROI/NI border sliver).
LEFT = box(600_000, 700_000, 601_000, 701_000)
RIGHT = box(601_020, 700_000, 602_020, 701_000)


def test_two_squares_with_small_gap_become_one_polygon_without_gap():
    land = blp.build_land(
        [
            gpd.GeoDataFrame(geometry=[LEFT], crs=blp.ITM),
            gpd.GeoDataFrame(geometry=[RIGHT], crs=blp.ITM),
        ]
    )
    assert len(land) == 1
    geom = land.geometry.iloc[0]
    assert geom.geom_type == "Polygon"
    assert len(geom.interiors) == 0
    # the middle of the gap is now land
    assert geom.contains(box(601_005, 700_400, 601_015, 700_600))
    # outer edges are not grown: total area ~ two squares plus the 20 m strip
    assert geom.area == pytest.approx(2_000_000 + 20 * 1_000, rel=1e-3)


def test_output_crs_is_itm_even_when_input_is_lat_lon():
    left_ll = gpd.GeoDataFrame(geometry=[LEFT], crs=blp.ITM).to_crs("EPSG:4326")
    right = gpd.GeoDataFrame(geometry=[RIGHT], crs=blp.ITM)
    land = blp.build_land([left_ll, right])
    assert land.crs.to_epsg() == 2157
    assert land.geometry.iloc[0].geom_type == "Polygon"


def test_narrow_coastal_inlet_away_from_the_border_stays_sea():
    # a 50 m wide inlet cut into the left square, more than 100 m from the right square
    inlet = box(600_400, 700_000, 600_450, 700_600)
    land = blp.build_land(
        [
            gpd.GeoDataFrame(geometry=[LEFT.difference(inlet)], crs=blp.ITM),
            gpd.GeoDataFrame(geometry=[RIGHT], crs=blp.ITM),
        ]
    )
    geom = land.geometry.iloc[0]
    assert not geom.intersects(box(600_410, 700_100, 600_440, 700_500))  # still sea
    assert geom.contains(box(601_005, 700_400, 601_015, 700_600))  # border gap closed


def test_invalid_input_geometry_is_repaired():
    # self-intersecting "bow tie" (invalid), touching the right square
    bowtie = Polygon([(601_020, 700_000), (602_020, 701_000), (602_020, 700_000),
                      (601_020, 701_000)])  # fmt: skip
    assert not bowtie.is_valid
    land = blp.build_land(
        [
            gpd.GeoDataFrame(geometry=[LEFT], crs=blp.ITM),
            gpd.GeoDataFrame(geometry=[bowtie], crs=blp.ITM),
        ]
    )
    geom = land.geometry.iloc[0]
    assert geom.is_valid
    assert geom.contains(box(601_005, 700_450, 601_015, 700_550))  # gap closed
    assert geom.area > 1_000_000  # bow tie kept, not dropped


def test_main_writes_gpkg_and_rejects_missing_file(tmp_path, capsys):
    a, b = tmp_path / "a.geojson", tmp_path / "b.geojson"
    gpd.GeoDataFrame(geometry=[LEFT], crs=blp.ITM).to_file(a)
    gpd.GeoDataFrame(geometry=[RIGHT], crs=blp.ITM).to_file(b)
    out = tmp_path / "land.gpkg"
    assert blp.main(["--part", str(a), "--part", str(b), "--out", str(out)]) == 0
    written = gpd.read_file(out, layer="land")
    assert written.crs.to_epsg() == 2157 and len(written) == 1

    missing = tmp_path / "nope.geojson"
    assert blp.main(["--part", str(missing), "--out", str(out)]) != 0
    assert "nope.geojson" in capsys.readouterr().err
