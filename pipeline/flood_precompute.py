"""CCD-400: precompute the flood layers for the coastal counties.

Contract: docs/flood-engine.md (§2 grid layout, §3 input, §7 limits, §9 D3/D5/D6).

    python pipeline/flood_precompute.py --dem data/dem/glo90/ireland_glo90.vrt \
        --land <land polygon .gpkg/.geojson/.shp> \
        --counties pipeline/data/boundaries/counties_tailte_eireann_2019.geojson \
        --out pipeline/data/processed/flood --county cork

Steps (each is a function below so the tests can run it on tiny synthetic inputs):
  1. DEM -> one national ITM (EPSG:2157) grid with square cells, bilinear; NaN / no data -> -9999.0
  2. land polygon -> sea mask on the same grid (outside land = sea)
  3. one engine call per level k/10.0 (k = 0..20) on the whole national grid
  4. per county: count flooded cells inside the county; write an RGBA PNG in EPSG:3857
  5. per county: index.json (D6)

The raw DEM is never written out (licence, D2): only flooded/not-flooded masks leave this script.
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import geopandas as gpd
import numpy as np
import rasterio
from PIL import Image
from rasterio.features import rasterize
from rasterio.transform import Affine
from rasterio.warp import (
    Resampling,
    calculate_default_transform,
    reproject,
    transform_bounds,
)
from rasterio.windows import Window
from rasterio.windows import transform as window_transform
from shapely.geometry import Polygon

ITM = "EPSG:2157"  # Irish Transverse Mercator, metres (§2)
WEB_MERCATOR = "EPSG:3857"  # web map tiles (D6)
WGS84 = "EPSG:4326"
NODATA = -9999.0  # §3: finite no-data value the engine understands

# Levels are k / 10.0, never built by adding 0.1 repeatedly (§3: repeated addition drifts).
LEVEL_STEPS = range(21)

# The 15 coastal counties (County.has_coastline; the same 15 counties that have rows in
# pipeline/data/processed/sea_level.csv). Slugs as in the County table (slugify(name)).
COASTAL_SLUGS = (
    "clare",
    "cork",
    "donegal",
    "dublin",
    "galway",
    "kerry",
    "leitrim",
    "limerick",
    "louth",
    "mayo",
    "meath",
    "sligo",
    "waterford",
    "wexford",
    "wicklow",
)

FLOOD_RGBA = (0, 102, 255, 160)  # semi-transparent blue; everything else alpha 0 (D6)

# DATA_SOURCES.md §7 "Required attribution", copied exactly.
ATTRIBUTION = (
    "produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and "
    "Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; "
    "all rights reserved"
)
MODEL_LIMITS = (
    "Indicative only: still-water 'bathtub' model with a connectivity check. No tides, storm "
    "surges or flood defences. See docs/flood-engine.md §7."
)


class PrecomputeError(Exception):
    """A problem with the inputs; main() prints the message and exits non-zero."""


def levels():
    """The 21 sea levels in metres and their PNG file names (level in cm, 3 digits)."""
    return [(k / 10.0, f"level_{k * 10:03d}.png") for k in LEVEL_STEPS]


def check_exists(path, what):
    if not Path(path).is_file():
        raise PrecomputeError(f"{what} file not found: {path}")


def resolve_counties(requested):
    """Return the county slugs to process; reject unknown and non-coastal slugs by name."""
    if requested is None:
        return list(COASTAL_SLUGS)
    slug = requested.strip().lower()
    if slug not in COASTAL_SLUGS:
        raise PrecomputeError(
            f"county '{requested}' is unknown or not coastal; "
            f"valid coastal slugs: {', '.join(COASTAL_SLUGS)}"
        )
    return [slug]


# ---------------------------------------------------------------------------
# Step 1: the national ITM grid and the elevation on it
# ---------------------------------------------------------------------------


def make_grid(bounds_itm, cell_size):
    """A north-up ITM grid covering bounds_itm, snapped to whole cells.

    Returns (transform, rows, cols). Row 0 is the northern row (§2).
    """
    left, bottom, right, top = bounds_itm
    left = np.floor(left / cell_size) * cell_size
    bottom = np.floor(bottom / cell_size) * cell_size
    right = np.ceil(right / cell_size) * cell_size
    top = np.ceil(top / cell_size) * cell_size
    cols = int(np.rint((right - left) / cell_size))
    rows = int(np.rint((top - bottom) / cell_size))
    return Affine(cell_size, 0.0, left, 0.0, -cell_size, top), rows, cols


def national_grid(dem_path, land_itm, cell_size, pad_cells=3):
    """Grid extent = land polygon bounds clipped to the DEM's extent, plus a few cells of padding.

    The padding makes sure the grid edge is sea: water never enters from outside the grid (§5).
    """
    with rasterio.open(dem_path) as src:
        dem_bounds = transform_bounds(src.crs, ITM, *src.bounds)
    lb = land_itm.total_bounds
    pad = pad_cells * cell_size
    bounds = (
        max(lb[0], dem_bounds[0]) - pad,
        max(lb[1], dem_bounds[1]) - pad,
        min(lb[2], dem_bounds[2]) + pad,
        min(lb[3], dem_bounds[3]) + pad,
    )
    if bounds[0] >= bounds[2] or bounds[1] >= bounds[3]:
        raise PrecomputeError("the land polygon does not overlap the DEM")
    return make_grid(bounds, cell_size)


def load_elevation(dem_path, transform, rows, cols):
    """Reproject the DEM onto the ITM grid with bilinear resampling (elevation is continuous).

    Cells the DEM does not cover start as NaN; every NaN (also NaN inside the DEM) then becomes
    NODATA, because the engine rejects NaN (§3). The GLO-90 tiles set no nodata value
    (DATA_SOURCES.md §7), so no source value is treated as nodata.
    """
    elevation = np.full((rows, cols), np.nan, dtype=np.float32)
    with rasterio.open(dem_path) as src:
        reproject(
            source=rasterio.band(src, 1),
            destination=elevation,
            src_nodata=src.nodata,
            dst_transform=transform,
            dst_crs=ITM,
            dst_nodata=np.nan,
            resampling=Resampling.bilinear,
        )
    elevation[~np.isfinite(elevation)] = NODATA
    return elevation


# ---------------------------------------------------------------------------
# Step 2: the sea mask from the land polygon (D3)
# ---------------------------------------------------------------------------


def fill_holes(geom):
    """Drop interior rings. A hole in a land polygon is enclosed by land on every side
    (a lake or lough), so it must stay land, not sea."""
    if geom is None or geom.is_empty:
        return geom
    if geom.geom_type == "Polygon":
        return Polygon(geom.exterior)
    if geom.geom_type in ("MultiPolygon", "GeometryCollection"):
        parts = [
            fill_holes(g)
            for g in geom.geoms
            if g.geom_type in ("Polygon", "MultiPolygon")
        ]
        return gpd.GeoSeries(parts).union_all() if parts else geom
    return geom


def sea_mask(land_itm, transform, rows, cols):
    """1 = sea (cell centre outside every land polygon), 0 = land. Lakes inside land are land."""
    shapes = [
        fill_holes(g) for g in land_itm.geometry if g is not None and not g.is_empty
    ]
    land = rasterize(
        ((g, 1) for g in shapes),
        out_shape=(rows, cols),
        transform=transform,
        fill=0,
        dtype="uint8",
    )
    return (land == 0).astype(np.uint8)


# ---------------------------------------------------------------------------
# Step 4: per-county counts and PNGs
# ---------------------------------------------------------------------------


def county_mask(geom_itm, transform, rows, cols):
    """1 where the cell centre is inside the county, on the national ITM grid."""
    return rasterize(
        [(geom_itm, 1)],
        out_shape=(rows, cols),
        transform=transform,
        fill=0,
        dtype="uint8",
    ).astype(bool)


def county_stats(flooded, in_county, cell_size):
    """Flooded cells inside the county only, and their area from the ITM grid (D6)."""
    count = int(np.count_nonzero((flooded != 0) & in_county))
    return count, count * cell_size * cell_size / 1e6


def county_window(in_county):
    """Smallest row/col window that holds the county, so PNGs are cropped to the county."""
    r = np.flatnonzero(in_county.any(axis=1))
    c = np.flatnonzero(in_county.any(axis=0))
    if r.size == 0:
        raise PrecomputeError(
            "county has no cells on the grid (is it outside the DEM?)"
        )
    return Window(c[0], r[0], c[-1] - c[0] + 1, r[-1] - r[0] + 1)


class CountyPng:
    """Fixed EPSG:3857 output grid for one county, reused for all 21 levels."""

    def __init__(self, grid_transform, window, cell_size):
        self.window = window
        self.src_transform = window_transform(window, grid_transform)
        left = self.src_transform.c
        top = self.src_transform.f
        right = left + window.width * cell_size
        bottom = top - window.height * cell_size
        self.dst_transform, self.width, self.height = calculate_default_transform(
            ITM,
            WEB_MERCATOR,
            int(window.width),
            int(window.height),
            left,
            bottom,
            right,
            top,
        )
        # Bounds of the PNG itself (not of the polygon), so the overlay lines up exactly.
        t = self.dst_transform
        m_left, m_top = t.c, t.f
        m_right, m_bottom = t.c + t.a * self.width, t.f + t.e * self.height
        west, south, east, north = transform_bounds(
            WEB_MERCATOR, WGS84, m_left, m_bottom, m_right, m_top
        )
        self.bounds = [
            [south, west],
            [north, east],
        ]  # D6 order: [[south, west], [north, east]]

    def write(self, mask_window, path):
        """Reproject a 0/1 mask (county window, ITM) to EPSG:3857 with NEAREST (categorical
        data: bilinear would invent fractional, 'half-flooded' values) and save it as RGBA."""
        dst = np.zeros((self.height, self.width), dtype=np.uint8)
        reproject(
            source=mask_window.astype(np.uint8),
            destination=dst,
            src_transform=self.src_transform,
            src_crs=ITM,
            dst_transform=self.dst_transform,
            dst_crs=WEB_MERCATOR,
            resampling=Resampling.nearest,
        )
        rgba = np.zeros((self.height, self.width, 4), dtype=np.uint8)
        rgba[dst == 1] = FLOOD_RGBA
        Image.fromarray(rgba, "RGBA").save(path)


# ---------------------------------------------------------------------------
# The engine
# ---------------------------------------------------------------------------


def load_engine():
    """Import flood_engine_py (docs/flood-engine.md §10) from FLOOD_ENGINE_PY_DIR or PYTHONPATH."""
    engine_dir = os.environ.get("FLOOD_ENGINE_PY_DIR")
    if engine_dir:
        sys.path.insert(0, engine_dir)
    try:
        import flood_engine_py
    except ImportError as exc:
        raise PrecomputeError(
            "cannot import flood_engine_py. Build it (docs/flood-engine.md §10) and set "
            "FLOOD_ENGINE_PY_DIR=flood_engine/build/python"
        ) from exc
    return flood_engine_py.compute_flood


# ---------------------------------------------------------------------------
# Whole run
# ---------------------------------------------------------------------------


def read_counties(counties_path, slugs, name_field):
    gdf = gpd.read_file(counties_path)
    if name_field not in gdf.columns:
        raise PrecomputeError(f"{counties_path} has no '{name_field}' column")
    gdf = gdf.to_crs(ITM)
    gdf["slug"] = gdf[name_field].str.strip().str.lower().str.replace(" ", "-")
    found = {}
    for slug in slugs:
        rows = gdf[gdf["slug"] == slug]
        if rows.empty:
            raise PrecomputeError(f"county '{slug}' not found in {counties_path}")
        found[slug] = rows.geometry.union_all()
    return found


def run(
    dem_path,
    land_path,
    counties_path,
    out_dir,
    county=None,
    cell_size=90.0,
    name_field="ENGLISH",
    compute_flood=None,
    log=print,
):
    """Build every requested county's PNGs and index.json. Returns {slug: index dict}."""
    slugs = resolve_counties(county)
    for path, what in (
        (dem_path, "DEM"),
        (land_path, "land polygon"),
        (counties_path, "counties"),
    ):
        check_exists(path, what)
    if not cell_size > 0:
        raise PrecomputeError(f"--cell-size must be > 0, got {cell_size}")
    if compute_flood is None:
        compute_flood = load_engine()

    t0 = time.perf_counter()
    land = gpd.read_file(land_path).to_crs(ITM)
    counties = read_counties(counties_path, slugs, name_field)

    # Step 1 + 2: one national grid, elevation and sea mask on it.
    transform, rows, cols = national_grid(dem_path, land, cell_size)
    log(f"grid: {rows} rows x {cols} cols, {cell_size:g} m cells, {ITM}")
    elevation = load_elevation(dem_path, transform, rows, cols)
    is_sea = sea_mask(land, transform, rows, cols)
    log(
        f"cells: {int(is_sea.sum())} sea, {int((is_sea == 0).sum())} land, "
        f"{int(((elevation == NODATA) & (is_sea == 0)).sum())} land cells without elevation"
    )

    # Per-county grids, fixed for all levels.
    prepared = {}
    for slug, geom in counties.items():
        in_county = county_mask(geom, transform, rows, cols)
        window = county_window(in_county)
        png = CountyPng(transform, window, cell_size)
        (Path(out_dir) / slug).mkdir(parents=True, exist_ok=True)
        prepared[slug] = (in_county, window, png, [])

    # Step 3 + 4: ONE engine call per level on the national grid, then cut out each county.
    for level_m, file_name in levels():
        result = compute_flood(elevation, is_sea, cell_size, level_m, NODATA)
        flooded = np.asarray(result["flooded"])
        for slug, (in_county, window, png, entries) in prepared.items():
            count, area = county_stats(flooded, in_county, cell_size)
            r0, c0 = int(window.row_off), int(window.col_off)
            sl = (slice(r0, r0 + int(window.height)), slice(c0, c0 + int(window.width)))
            png.write(
                (flooded[sl] != 0) & in_county[sl], Path(out_dir) / slug / file_name
            )
            entries.append(
                {
                    "level_m": level_m,
                    "file": file_name,
                    "flooded_cells": count,
                    "flooded_area_km2": area,
                }
            )

    # Step 5: index.json per county (D6 fields + attribution + model limits).
    indexes = {}
    for slug, (_, _, png, entries) in prepared.items():
        index = {
            "slug": slug,
            "bounds": png.bounds,
            "cell_size_m": cell_size,
            "levels": entries,
            "attribution": ATTRIBUTION,
            "model_limits": MODEL_LIMITS,
        }
        with open(Path(out_dir) / slug / "index.json", "w", encoding="utf-8") as f:
            json.dump(index, f, indent=2, ensure_ascii=False)
        indexes[slug] = index

    log(f"done in {time.perf_counter() - t0:.1f} s")
    return indexes


def main(argv=None):
    p = argparse.ArgumentParser(description="Precompute flood layers (CCD-400).")
    p.add_argument(
        "--dem", required=True, help="DEM raster or VRT (e.g. ireland_glo90.vrt)"
    )
    p.add_argument(
        "--land", required=True, help="land polygon for the whole island (D3)"
    )
    p.add_argument("--counties", required=True, help="county boundary file")
    p.add_argument("--out", required=True, help="output folder (D6)")
    p.add_argument("--county", help="one coastal county slug (default: all 15)")
    p.add_argument("--cell-size", type=float, default=90.0, help="ITM cell size in m")
    p.add_argument("--name-field", default="ENGLISH", help="county name column")
    args = p.parse_args(argv)
    try:
        indexes = run(
            args.dem,
            args.land,
            args.counties,
            args.out,
            county=args.county,
            cell_size=args.cell_size,
            name_field=args.name_field,
        )
    except PrecomputeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    for slug, index in indexes.items():
        print(f"\n{slug}: bounds {index['bounds']}")
        print("  level_m  flooded_cells  flooded_area_km2")
        for e in index["levels"]:
            print(
                f"  {e['level_m']:7.1f}  {e['flooded_cells']:13d}  {e['flooded_area_km2']:16.4f}"
            )
    return 0


if __name__ == "__main__":
    sys.exit(main())
