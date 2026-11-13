# CCD-400: tests for flood_precompute.py on tiny made-up inputs.
#
# The real DEM is never used here (licence, docs/flood-engine.md D2; CI doesn't have it).
# Instead each test builds a few cells, made-up polygons, or a tiny GeoTIFF in tmp_path.
#
# The end-to-end test with the real C++ engine needs flood_engine_py and skips when
# FLOOD_ENGINE_PY_DIR is not set (it runs in the CI "cpp" job, which builds the binding).
#
# Run from the pipeline folder:  python -m pytest tests -v

import json
import os
import sys

import flood_precompute as fp
import geopandas as gpd
import numpy as np
import pytest
import rasterio
from PIL import Image
from rasterio.transform import from_origin
from shapely.geometry import Polygon, box

# ---------------------------------------------------------------------------
# Levels
# ---------------------------------------------------------------------------


def test_levels_are_k_over_10_with_cm_file_names():
    lv = fp.levels()
    assert [m for m, _ in lv] == [k / 10 for k in range(21)]  # exact, not repeated +0.1
    assert lv[0] == (0.0, "level_000.png")
    assert lv[3] == (0.3, "level_030.png")  # 0.1+0.1+0.1 would be 0.30000000000000004
    assert lv[-1] == (2.0, "level_200.png")
    assert [f for _, f in lv] == [f"level_{k * 10:03d}.png" for k in range(21)]


# ---------------------------------------------------------------------------
# Sea mask
#
#   A 6 x 6 grid of 1 m cells. Land polygon = the middle 4 x 4 cells (x 1..5, y 1..5).
#   The lake is cell (row 2, col 2): once as a separate polygon inside the land,
#   once as a hole in the land polygon. Both times it must be land, not sea.
# ---------------------------------------------------------------------------

GRID = from_origin(0, 6, 1, 1)  # left=0, top=6, 1 m cells, so row 0 = north
LAND = box(1, 1, 5, 5)
LAKE = box(2, 3, 3, 4)  # covers the centre of cell row 2, col 2


def test_sea_mask_outside_land_is_sea_and_lake_is_land():
    land = gpd.GeoDataFrame(geometry=[LAND, LAKE], crs=fp.ITM)
    sea = fp.sea_mask(land, GRID, 6, 6)
    assert sea[0, 0] == 1  # outside the land polygon -> sea
    assert sea[5, 5] == 1
    assert sea[1, 1] == 0  # inside -> land
    assert sea[2, 2] == 0  # lake inside the land polygon -> land
    assert sea.sum() == 36 - 16


def test_sea_mask_lake_as_hole_is_still_land():
    with_hole = Polygon(LAND.exterior.coords, [LAKE.exterior.coords])
    land = gpd.GeoDataFrame(geometry=[with_hole], crs=fp.ITM)
    sea = fp.sea_mask(land, GRID, 6, 6)
    assert sea[2, 2] == 0
    assert sea.sum() == 36 - 16


# ---------------------------------------------------------------------------
# Per-county count and area
# ---------------------------------------------------------------------------


def test_county_count_only_counts_cells_inside_county():
    flooded = np.array(
        [
            [1, 1, 0],
            [1, 0, 1],
        ],
        dtype=np.uint8,
    )
    # County = left two columns of a 3-col grid of 90 m cells
    transform = from_origin(0, 180, 90, 90)
    in_county = fp.county_mask(box(0, 0, 180, 180), transform, 2, 3)
    assert in_county.tolist() == [[True, True, False], [True, True, False]]
    count, area = fp.county_stats(flooded, in_county, 90.0)
    assert count == 3  # the flooded cell in column 2 is outside the county
    assert area == pytest.approx(3 * 90 * 90 / 1e6)


# ---------------------------------------------------------------------------
# County slugs and missing files
# ---------------------------------------------------------------------------


def test_unknown_slug_is_a_clear_error():
    with pytest.raises(
        fp.PrecomputeError, match="'atlantis'.*valid coastal slugs: clare, cork"
    ):
        fp.resolve_counties("atlantis")


def test_non_coastal_slug_is_a_clear_error():
    with pytest.raises(fp.PrecomputeError, match="'kildare' is unknown or not coastal"):
        fp.resolve_counties("kildare")


def test_all_15_coastal_by_default():
    assert len(fp.resolve_counties(None)) == 15
    assert fp.resolve_counties("Cork") == ["cork"]


def test_main_exits_non_zero_with_slug_in_message(tmp_path, capsys):
    code = fp.main(
        [
            "--dem",
            "x",
            "--land",
            "y",
            "--counties",
            "z",
            "--out",
            str(tmp_path),
            "--county",
            "kildare",
        ]
    )
    assert code != 0
    err = capsys.readouterr().err
    assert "kildare" in err and "cork" in err


def test_missing_dem_names_the_path(tmp_path):
    missing = tmp_path / "nope.vrt"
    with pytest.raises(fp.PrecomputeError, match="DEM file not found: .*nope.vrt"):
        fp.run(
            missing,
            missing,
            missing,
            tmp_path,
            county="cork",
            compute_flood=lambda *a: None,
        )


def test_missing_land_names_the_path(tmp_path, synthetic):
    missing = tmp_path / "land.gpkg"
    with pytest.raises(
        fp.PrecomputeError, match="land polygon file not found: .*land.gpkg"
    ):
        fp.run(
            synthetic["dem"],
            missing,
            synthetic["counties"],
            tmp_path,
            compute_flood=None,
        )


# ---------------------------------------------------------------------------
# End to end on a tiny synthetic GeoTIFF
#
#   DEM: lat/lon (EPSG:4326, like GLO-90), 40 x 40 cells of 0.005 deg near Cork.
#   Height rises from west to east: 0 m at lon -8.50, 4 m at lon -8.30.
#   One cell is NaN, to check it becomes nodata instead of crashing the engine.
#   Land polygon: everything east of lon -8.46 (so the western strip is sea).
#   Counties: CORK covers lon -8.47 .. -8.35; KILDARE is next to it (not coastal).
#   So at 0 m nothing floods (the coast is at about 0.8 m), and at 2 m a strip floods.
# ---------------------------------------------------------------------------


def fake_engine(elevation, is_sea, cell_size_m, sea_level_m, nodata):
    """Pure-numpy stand-in for flood_engine_py: 4-neighbour flood fill from the sea."""
    sea = np.asarray(is_sea) != 0
    can = (~sea) & (elevation != nodata) & (elevation <= sea_level_m)
    flooded = np.zeros_like(can)
    frontier = sea.copy()
    while True:
        grow = np.zeros_like(can)
        grow[1:] |= frontier[:-1]
        grow[:-1] |= frontier[1:]
        grow[:, 1:] |= frontier[:, :-1]
        grow[:, :-1] |= frontier[:, 1:]
        new = grow & can & ~flooded
        if not new.any():
            break
        flooded |= new
        frontier = new
    n = int(flooded.sum())
    return {
        "flooded": flooded.astype(np.uint8),
        "flooded_cells": n,
        "flooded_area_km2": n * cell_size_m**2 / 1e6,
    }


@pytest.fixture
def synthetic(tmp_path):
    west, north, step, n = -8.50, 52.00, 0.005, 40
    lon = west + step * (np.arange(n) + 0.5)
    elev = np.tile(((lon - west) * 20).astype(np.float32), (n, 1))
    elev[5, 30] = np.nan
    dem = tmp_path / "dem.tif"
    with rasterio.open(
        dem,
        "w",
        driver="GTiff",
        width=n,
        height=n,
        count=1,
        dtype="float32",
        crs="EPSG:4326",
        transform=from_origin(west, north, step, step),
    ) as dst:
        dst.write(elev, 1)

    south = north - n * step
    land = tmp_path / "land.geojson"
    gpd.GeoDataFrame(
        geometry=[box(-8.46, south, -8.30, north)], crs="EPSG:4326"
    ).to_file(land)
    counties = tmp_path / "counties.geojson"
    gpd.GeoDataFrame(
        {"ENGLISH": ["CORK", "KILDARE"]},
        geometry=[box(-8.47, 51.82, -8.35, 51.98), box(-8.35, 51.82, -8.30, 51.98)],
        crs="EPSG:4326",
    ).to_file(counties)
    return {"dem": dem, "land": land, "counties": counties, "out": tmp_path / "flood"}


def check_outputs(index, out, cell_size):
    folder = out / "cork"
    # D6 fields
    assert index["slug"] == "cork"
    assert index["cell_size_m"] == cell_size
    assert "Copernicus WorldDEM-90" in index["attribution"]
    assert "docs/flood-engine.md §7" in index["model_limits"]
    # bounds = [[south, west], [north, east]] in WGS84, around the CORK box
    (south, west), (north, east) = index["bounds"]
    assert south < north and west < east
    assert south == pytest.approx(51.82, abs=0.01) and north == pytest.approx(
        51.98, abs=0.01
    )
    assert west == pytest.approx(-8.47, abs=0.01) and east == pytest.approx(
        -8.35, abs=0.01
    )
    # one entry + one PNG per level
    names = [f for _, f in fp.levels()]
    assert [e["file"] for e in index["levels"]] == names
    assert [e["level_m"] for e in index["levels"]] == [k / 10 for k in range(21)]
    for e in index["levels"]:
        assert e["flooded_area_km2"] == pytest.approx(
            e["flooded_cells"] * cell_size**2 / 1e6
        )
        img = Image.open(folder / e["file"])
        assert img.mode == "RGBA"
    # written index.json is the same as the returned one
    assert json.loads((folder / "index.json").read_text(encoding="utf-8")) == index
    # physics: nothing at 0 m, something at 2 m, never fewer cells at a higher level
    counts = [e["flooded_cells"] for e in index["levels"]]
    assert counts[0] == 0 and counts[-1] > 0
    assert counts == sorted(counts)
    # the 2 m PNG has blue pixels; the 0 m PNG is fully transparent
    assert np.asarray(Image.open(folder / "level_200.png"))[..., 3].max() > 0
    assert np.asarray(Image.open(folder / "level_000.png"))[..., 3].max() == 0
    # only cork was written
    assert sorted(p.name for p in out.iterdir()) == ["cork"]


def test_end_to_end_with_numpy_stand_in_engine(synthetic):
    s = synthetic
    indexes = fp.run(
        s["dem"],
        s["land"],
        s["counties"],
        s["out"],
        county="cork",
        cell_size=200.0,
        compute_flood=fake_engine,
        log=lambda *a: None,
    )
    check_outputs(indexes["cork"], s["out"], 200.0)


@pytest.mark.skipif(
    not os.environ.get("FLOOD_ENGINE_PY_DIR"),
    reason="FLOOD_ENGINE_PY_DIR is not set: flood_engine_py not built (see docs/flood-engine.md §10)",
)
def test_end_to_end_with_real_engine(synthetic, monkeypatch):
    s = synthetic
    monkeypatch.setattr(sys, "path", list(sys.path))  # load_engine() adds to sys.path
    code = fp.main(
        [
            "--dem",
            str(s["dem"]),
            "--land",
            str(s["land"]),
            "--counties",
            str(s["counties"]),
            "--out",
            str(s["out"]),
            "--county",
            "cork",
            "--cell-size",
            "200",
        ]
    )
    assert code == 0
    index = json.loads((s["out"] / "cork" / "index.json").read_text(encoding="utf-8"))
    check_outputs(index, s["out"], 200.0)
    # the real engine and the numpy stand-in agree cell for cell
    other = fp.run(
        s["dem"],
        s["land"],
        s["counties"],
        s["out"].with_name("flood_fake"),
        county="cork",
        cell_size=200.0,
        compute_flood=fake_engine,
        log=lambda *a: None,
    )
    assert [e["flooded_cells"] for e in index["levels"]] == [
        e["flooded_cells"] for e in other["cork"]["levels"]
    ]
