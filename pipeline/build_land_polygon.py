"""CCD-420: build the whole-island land polygon for the flood sea mask (docs/flood-engine.md D3).

    python pipeline/build_land_polygon.py \
        --part pipeline/data/boundaries/counties_tailte_eireann_2019.geojson \
        --part pipeline/data/raw/ni_outline/osni_open_data_largescale_boundaries_ni_outline.zip \
        --out pipeline/data/boundaries/ireland_land.gpkg

Each --part is read, reprojected to ITM (EPSG:2157) and unioned with the others. The ROI and NI
outlines come from different surveys, so along the border they can leave thin slivers between
them; flood_precompute.py would treat such a gap as "sea". A closing step (buffer +close_m, then
-close_m) fills gaps narrower than 2 * close_m, but only where two parts are within close_m of
each other, so coastal inlets stay sea. Sources and licences: DATA_SOURCES.md §8.
"""

import argparse
import sys
from pathlib import Path

import geopandas as gpd

ITM = "EPSG:2157"
CLOSE_M = 100.0  # fills gaps up to ~200 m wide; about 2 cells of the 90 m flood grid


def build_land(parts, close_m=CLOSE_M):
    """Union GeoDataFrames into one land geometry in ITM, with border slivers closed.

    Invalid input geometry (the OSNI NI outline is not valid as published) is repaired first,
    so the union cannot fail or drop parts. Returns a one-row GeoDataFrame in EPSG:2157.
    """
    geoms = [gdf.to_crs(ITM).geometry.make_valid().union_all() for gdf in parts]
    merged = gpd.GeoSeries(geoms, crs=ITM).union_all()
    # Close gaps only where two parts come within close_m of each other (the ROI/NI border).
    # Closing the whole outline would also fill narrow coastal inlets and turn that sea into land.
    near_both = [
        a.buffer(close_m).intersection(b.buffer(close_m))
        for i, a in enumerate(geoms)
        for b in geoms[i + 1 :]
    ]
    if near_both:
        zone = gpd.GeoSeries(near_both, crs=ITM).union_all()
        closed = merged.buffer(close_m).buffer(-close_m)
        merged = merged.union(closed.intersection(zone))
    return gpd.GeoDataFrame(geometry=[merged], crs=ITM)


def main(argv=None):
    p = argparse.ArgumentParser(description="Build the island land polygon (CCD-420).")
    p.add_argument(
        "--part", action="append", required=True, help="polygon file (repeat)"
    )
    p.add_argument("--out", required=True, help="output .gpkg")
    p.add_argument("--close-m", type=float, default=CLOSE_M, help="sliver closing (m)")
    args = p.parse_args(argv)
    for path in args.part:
        if not Path(path).is_file():
            print(f"error: file not found: {path}", file=sys.stderr)
            return 2
    land = build_land([gpd.read_file(path) for path in args.part], args.close_m)
    land.to_file(args.out, layer="land", driver="GPKG")
    print(f"wrote {args.out}: area {land.geometry.area.sum() / 1e6:.1f} km2, {ITM}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
