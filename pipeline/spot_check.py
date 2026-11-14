"""
CCD-239 - Spot-check county values against the source files.

The pipeline (process_climate_data.py) finds the cells in a county with
gpd.sjoin() and matches sea points to counties with gpd.sjoin_nearest().
This script does both a DIFFERENT way, so a bug in one would show up
as a difference:
  - climate: shapely.contains_xy() point-in-polygon on the land cells
  - sea level: shapely distance from each sea point to every county

Climate spot-check (one TRANSLATE .nc file, one or more counties):
    python spot_check.py climate <file.nc> <land_mask.nc> Galway Kerry

    <land_mask.nc> is tmean_CMIP5_baseline_1976-2005_ANNUAL.nc: the pipeline
    counts a cell as land only if that file has a value there (CCD-31).

Sea-level spot-check (a JSON export of the UKCP18 feature service, see
DATA_SOURCES.md section 2, 50th percentile rows only):
    python spot_check.py sea <ukcp18.json> Dublin:rcp45:2050 Cork:rcp85:2100

Each line printed is: what was checked, the recomputed value, the value
in data/processed/*.csv and the difference. Copy them into
docs/validation-log.md.
"""

import argparse
import json
import os

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely
import xarray as xr
from clean import clean_values
from filename_info import get_file_details

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BOUNDARIES = os.path.join(
    BASE_DIR, "data", "boundaries", "counties_tailte_eireann_2019.geojson"
)
CLIMATE_CSV = os.path.join(BASE_DIR, "data", "processed", "climate_data.csv")
SEA_LEVEL_CSV = os.path.join(BASE_DIR, "data", "processed", "sea_level.csv")

# Same limit as the pipeline: a sea point further than this from every county is dropped.
MAX_SEA_DISTANCE_M = 15000
# The pipeline rounds to 3 decimal places, so a difference this small is just rounding.
TOLERANCE = 0.0005


def load_counties(crs="EPSG:4326"):
    """County outlines as {"Cork": geometry, ...} in the given CRS."""
    counties = gpd.read_file(BOUNDARIES).to_crs(crs)
    return dict(zip(counties["ENGLISH"].str.title(), counties.geometry))


def county_cells(outline, land_grid, lats, lons):
    """Row and column numbers of the land cells whose centre is inside the outline.

    land_grid: 2-D array, NaN = sea. lats: latitude of each row. lons: longitude of each column.
    """
    rows, cols = np.where(~np.isnan(land_grid))
    inside = shapely.contains_xy(outline, lons[cols], lats[rows])
    return rows[inside], cols[inside]


def county_mean(grid, rows, cols, variable):
    """Mean of grid at the given cells, after the pipeline's cleaning rules (CCD-275)."""
    table = pd.DataFrame({"value": grid[rows, cols]})
    table, _ = clean_values(table, variable)
    if table.empty:
        raise ValueError("no valid cells in this county")
    return float(table["value"].mean())


def nearest_county(points, outlines, max_distance):
    """For each point, the name of the nearest outline, or None if every outline is further than max_distance.

    points: list of shapely Points. outlines: {name: geometry}. All in the same metric CRS.
    """
    names = list(outlines)
    geoms = list(outlines.values())
    result = []
    for point in points:
        distances = [point.distance(geom) for geom in geoms]
        best = int(np.argmin(distances))
        result.append(names[best] if distances[best] <= max_distance else None)
    return result


def sea_level_mean(features, assigned, county, scenario, year):
    """Mean rise in cm over the 50th-percentile sea points assigned to the county.

    features: list of attribute dicts from the UKCP18 service. assigned: nearest_county() result, same order.
    Returns (mean, OBJECTIDs used).
    """
    column = f"seaLevelAnom_{year}"
    used = [
        f
        for f, name in zip(features, assigned)
        if name == county and f["rcp_percentile"] == f"{scenario}_50"
    ]
    if not used:
        raise ValueError(f"no UKCP18 points for {county} {scenario}")
    return float(np.mean([f[column] for f in used])), sorted(
        f["OBJECTID"] for f in used
    )


def file_range(grid):
    """Lowest and highest value in a grid, ignoring empty cells."""
    return float(np.nanmin(grid)), float(np.nanmax(grid))


def read_features(path):
    """Attribute dicts from a feature service JSON export (keeps only 50th-percentile rows)."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return [
        f["attributes"]
        for f in data["features"]
        if f["attributes"]["rcp_percentile"].endswith("_50")
    ]


def report(label, mine, pipeline):
    difference = abs(mine - pipeline)
    flag = (
        "" if difference <= TOLERANCE else "   <-- DIFFERENT: explain or log a Jira bug"
    )
    print(
        f"{label}: recomputed {mine:.4f}, csv {pipeline:.3f}, difference {difference:.4f}{flag}"
    )


def run_climate(nc_path, land_path, counties_to_check):
    details = get_file_details(nc_path)
    with xr.open_dataset(land_path) as ds:
        land = ds["tmean"].values[0]
        lats, lons = ds["lat"].values, ds["lon"].values
    with xr.open_dataset(nc_path) as ds:
        grid = ds[details["nc_variable"]].values[0]
        units = ds[details["nc_variable"]].attrs.get("units", "?")

    low, high = file_range(grid)
    print(f"{details['file']}: units {units!r}, range {low:.3f} to {high:.3f}")

    climate = pd.read_csv(CLIMATE_CSV)
    outlines = load_counties()
    for county in counties_to_check:
        rows, cols = county_cells(outlines[county], land, lats, lons)
        mine = county_mean(grid, rows, cols, details["variable"])
        match = climate[
            (climate["county"] == county)
            & (climate["variable"] == details["variable"])
            & (climate["scenario"] == details["scenario"])
            & (climate["period"] == details["period"])
            & (climate["season"] == details["season"])
        ]
        report(f"  {county} ({len(rows)} cells)", mine, float(match["value"].iloc[0]))


def run_sea(json_path, checks):
    features = read_features(json_path)
    points = gpd.GeoSeries(
        gpd.points_from_xy([f["X"] for f in features], [f["Y"] for f in features]),
        crs="EPSG:4326",
    ).to_crs("EPSG:2157")
    assigned = nearest_county(
        list(points), load_counties("EPSG:2157"), MAX_SEA_DISTANCE_M
    )

    sea = pd.read_csv(SEA_LEVEL_CSV)
    for check in checks:
        county, scenario, year = check.split(":")
        mine, ids = sea_level_mean(features, assigned, county, scenario, int(year))
        match = sea[
            (sea["county"] == county)
            & (sea["scenario"] == scenario)
            & (sea["year"] == int(year))
        ]
        report(
            f"  {county} {scenario} {year} (OBJECTID {', '.join(map(str, ids))})",
            mine,
            float(match["rise_cm"].iloc[0]),
        )


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    sub = parser.add_subparsers(dest="kind", required=True)
    climate = sub.add_parser("climate")
    climate.add_argument("nc_file")
    climate.add_argument("land_mask")
    climate.add_argument("counties", nargs="+")
    sea = sub.add_parser("sea")
    sea.add_argument("json_file")
    sea.add_argument("checks", nargs="+", help="county:scenario:year")
    args = parser.parse_args(argv)
    if args.kind == "climate":
        run_climate(args.nc_file, args.land_mask, args.counties)
    else:
        run_sea(args.json_file, args.checks)


if __name__ == "__main__":
    main()
