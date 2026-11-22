"""
CCD-355 - WorldClim 2.1 present-day climate (1970-2000) for European cities and the 26 counties.

The climate analogues (CCD-354) compare a county's future climate with today's climate in
European cities. Both sides need the SAME observed dataset, so this script reads WorldClim 2.1
(10-minute grid) and writes two files to data/processed/:

  worldclim_cities.csv    one row per city in data/analogue_cities.csv: the value of the
                          grid cell the city is in
  worldclim_counties.csv  one row per county: the average of the grid cells inside it

Each file has three variables:
  summer_temp_c     mean of the June, July and August average temperatures (°C)
  winter_temp_c     mean of the December, January and February average temperatures (°C)
  annual_precip_mm  total of the 12 monthly precipitation values (mm)

City coordinates come from Natural Earth populated places, not typed by hand.
Downloads go to data/raw/ (not committed) and are reused if they are already there.

How to run (from the pipeline folder):
    python worldclim_baseline.py
"""

import os

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
import requests
from rasterio.features import geometry_mask
from rasterio.transform import rowcol

# ---------------------------------------------------------------
# Where the files are
# ---------------------------------------------------------------

# BASE_DIR: the folder this script is in (the "pipeline" folder)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(BASE_DIR, "data", "raw")

# DOWNLOADS: name -> (url, where it is saved). See DATA_SOURCES.md §9 and §10.
DOWNLOADS = {
    "tavg": (
        "https://geodata.ucdavis.edu/climate/worldclim/2_1/base/wc2.1_10m_tavg.zip",
        os.path.join(RAW_DIR, "worldclim", "wc2.1_10m_tavg.zip"),
    ),
    "prec": (
        "https://geodata.ucdavis.edu/climate/worldclim/2_1/base/wc2.1_10m_prec.zip",
        os.path.join(RAW_DIR, "worldclim", "wc2.1_10m_prec.zip"),
    ),
    "places": (
        "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_populated_places.zip",
        os.path.join(RAW_DIR, "natural_earth", "ne_10m_populated_places.zip"),
    ),
}

# CITIES_FILE: the cities we compare with (committed). Columns: city, country.
CITIES_FILE = os.path.join(BASE_DIR, "data", "analogue_cities.csv")

# BOUNDARY_FILE: Tailte Eireann county boundaries, the same file process_climate_data.py uses
BOUNDARY_FILE = os.path.join(
    BASE_DIR, "data", "boundaries", "counties_tailte_eireann_2019.geojson"
)

OUTPUT_DIR = os.path.join(BASE_DIR, "data", "processed")

# ---------------------------------------------------------------
# Rules
# ---------------------------------------------------------------

# Months as positions in the 12-month stack (January = 0)
SUMMER = [5, 6, 7]  # June, July, August (same as JJA in filename_info.py)
WINTER = [11, 0, 1]  # December, January, February (same as DJF)

# A city on the coast can fall in a sea cell, which has no data. Then we take the nearest
# cell with data, but only up to this many cells away (10-minute cells are about 12-18 km).
MAX_SEARCH_CELLS = 2

# A county must cover at least this many cell centres, or its average means little
MIN_COUNTY_CELLS = 3

# Plausible values for Europe. Anything outside is a mistake, not weather.
RANGES = {
    "summer_temp_c": (-20, 35),
    "winter_temp_c": (-20, 35),
    "annual_precip_mm": (100, 4000),
}
VARIABLES = list(RANGES)


# ===============================================================
# Functions (tested in tests/test_worldclim_baseline.py)
# ===============================================================


def download(url, path):
    """Download url to path, unless the file is already there."""
    if os.path.exists(path):
        print(f"Reusing {os.path.relpath(path, BASE_DIR)}")
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    print(f"Downloading {url}")
    with requests.get(url, stream=True, timeout=60) as response:
        response.raise_for_status()
        # Write to a temporary name first, so a broken download is never "reused"
        with open(path + ".part", "wb") as file:
            file.writelines(response.iter_content(chunk_size=1 << 20))
    os.replace(path + ".part", path)


def worldclim_months(zip_path):
    """The 12 monthly GeoTIFFs inside a WorldClim zip, January first."""
    name = os.path.basename(zip_path).replace(".zip", "")  # e.g. wc2.1_10m_tavg
    return [f"zip://{zip_path}!{name}_{month:02d}.tif" for month in range(1, 13)]


def read_months(paths):
    """
    Read 12 monthly rasters into one array (12 x rows x columns).
    No-data cells become np.nan. Returns the array and the grid's transform.
    """
    layers = []
    transform = None
    for path in paths:
        with rasterio.open(path) as src:
            layer = src.read(1).astype("float64")
            if src.nodata is not None:
                layer[layer == src.nodata] = np.nan
            if transform is None:
                transform = src.transform
            elif src.transform != transform:
                raise ValueError(f"{path} is on a different grid from the first month")
        layers.append(layer)
    if len(layers) != 12:
        raise ValueError(f"Expected 12 months, got {len(layers)}")
    return np.stack(layers), transform


def climate_grids(tavg, prec):
    """
    tavg, prec: 12 x rows x columns arrays of monthly temperature and precipitation.
    Returns one grid per variable. A cell with any month missing becomes np.nan.
    """
    return {
        "summer_temp_c": tavg[SUMMER].mean(axis=0),
        "winter_temp_c": tavg[WINTER].mean(axis=0),
        "annual_precip_mm": prec.sum(axis=0),
    }


def find_cell(valid, transform, lon, lat, max_cells=MAX_SEARCH_CELLS):
    """
    The row and column of the cell at (lon, lat), and a note.
    If that cell has no data, use the nearest valid cell up to max_cells away, and say so
    in the note. If there is none, stop with an error.
    """
    row, col = rowcol(transform, lon, lat)
    rows, cols = valid.shape
    if not (0 <= row < rows and 0 <= col < cols):
        raise ValueError(f"({lon}, {lat}) is outside the grid")
    if valid[row, col]:
        return row, col, ""

    best = None  # (distance squared, row offset, column offset)
    for dr in range(-max_cells, max_cells + 1):
        for dc in range(-max_cells, max_cells + 1):
            r, c = row + dr, col + dc
            if 0 <= r < rows and 0 <= c < cols and valid[r, c]:
                distance = dr * dr + dc * dc
                if best is None or distance < best[0]:
                    best = (distance, dr, dc)
    if best is None:
        raise ValueError(f"No valid cell within {max_cells} cells of ({lon}, {lat})")
    _, dr, dc = best
    note = f"no data at the city's cell; used the nearest valid cell ({dr:+d} rows, {dc:+d} columns)"
    return row + dr, col + dc, note


def city_values(grids, transform, lon, lat):
    """The three variables at one city, from the same cell, and the note from find_cell()."""
    valid = np.all([np.isfinite(grid) for grid in grids.values()], axis=0)
    row, col, note = find_cell(valid, transform, lon, lat)
    values = {name: float(grid[row, col]) for name, grid in grids.items()}
    return values, note


def county_values(grids, transform, geometry, min_cells=MIN_COUNTY_CELLS):
    """
    The average of each variable over the cells whose centre is inside the polygon.
    Returns the averages and the number of cells used.
    """
    valid = np.all([np.isfinite(grid) for grid in grids.values()], axis=0)
    inside = geometry_mask(
        [geometry], out_shape=valid.shape, transform=transform, invert=True
    )
    cells = inside & valid
    count = int(cells.sum())
    if count < min_cells:
        raise ValueError(f"Only {count} cells inside the polygon (need {min_cells})")
    values = {name: float(grid[cells].mean()) for name, grid in grids.items()}
    return values, count


def load_cities(cities_file, places_path):
    """
    Our city list joined to Natural Earth by exact NAME and ADM0NAME (country).
    Stops with an error if a city is missing or matches more than one place.
    """
    cities = pd.read_csv(cities_file)
    places = gpd.read_file(places_path)
    rows = []
    problems = []
    for city, country in zip(cities["city"], cities["country"]):
        match = places[(places["NAME"] == city) & (places["ADM0NAME"] == country)]
        if len(match) != 1:
            problems.append(f"{city}, {country}: {len(match)} matches in Natural Earth")
            continue
        place = match.iloc[0]
        rows.append(
            {
                "city": city,
                "country": country,
                "latitude": float(place["LATITUDE"]),
                "longitude": float(place["LONGITUDE"]),
            }
        )
    if problems:
        raise ValueError("Cities not found exactly once:\n  " + "\n  ".join(problems))
    return pd.DataFrame(rows)


def validate(table, key, expected_rows=None):
    """
    Stop with an error if the table has empty values, the same key twice, the wrong number
    of rows, or a value outside RANGES. Lists every problem at once.
    """
    problems = []
    if table.isna().any().any():
        empty = table.columns[table.isna().any()].tolist()
        problems.append(f"empty values in {empty}")
    duplicated = table[key][table[key].duplicated()].tolist()
    if duplicated:
        problems.append(f"repeated {key}: {duplicated}")
    if expected_rows is not None and len(table) != expected_rows:
        problems.append(f"{len(table)} rows, expected {expected_rows}")
    for column, (low, high) in RANGES.items():
        outside = table[(table[column] < low) | (table[column] > high)]
        if len(outside):
            problems.append(
                f"{column} outside {low}..{high} for {outside[key].tolist()}"
            )
    if problems:
        raise ValueError("Validation failed: " + "; ".join(problems))


# ===============================================================
# The steps
# ===============================================================


def main():
    # 1. Download, or reuse what is already in data/raw/
    for url, path in DOWNLOADS.values():
        download(url, path)

    # 2. Read the 12 months of each variable and work out the three grids
    tavg, transform = read_months(worldclim_months(DOWNLOADS["tavg"][1]))
    prec, prec_transform = read_months(worldclim_months(DOWNLOADS["prec"][1]))
    if prec_transform != transform:
        raise ValueError("tavg and prec are on different grids")
    grids = climate_grids(tavg, prec)

    # 3. Cities: the cell each city is in
    cities = load_cities(CITIES_FILE, DOWNLOADS["places"][1])
    city_rows = []
    for city in cities.to_dict("records"):
        values, note = city_values(
            grids, transform, city["longitude"], city["latitude"]
        )
        city_rows.append({**city, **values, "note": note})
    cities = pd.DataFrame(city_rows)

    # 4. Counties: the average of the cells inside each county (lat/lon, like WorldClim)
    counties = gpd.read_file(BOUNDARY_FILE).to_crs("EPSG:4326")
    counties["county"] = counties["ENGLISH"].str.title()
    county_rows = []
    counties = counties.sort_values("county")
    for name, geometry in zip(counties["county"], counties.geometry):
        values, count = county_values(grids, transform, geometry)
        county_rows.append({"county": name, **values, "cells": count})
    counties = pd.DataFrame(county_rows)

    # 5. Check, round and save
    validate(cities.drop(columns="note"), "city")
    validate(counties, "county", expected_rows=26)
    # Every number is written with 3 decimals (latitude and longitude too, about 100 m)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    cities.to_csv(
        os.path.join(OUTPUT_DIR, "worldclim_cities.csv"),
        index=False,
        float_format="%.3f",
    )
    counties.to_csv(
        os.path.join(OUTPUT_DIR, "worldclim_counties.csv"),
        index=False,
        float_format="%.3f",
    )

    # 6. Summary
    print(f"\n{len(cities)} cities, {len(counties)} counties saved to data/processed/")
    for name, table in (("Cities", cities), ("Counties", counties)):
        print(f"\n{name}:")
        print(
            table[VARIABLES].describe().loc[["min", "mean", "max"]].round(1).to_string()
        )
    noted = cities[cities["note"] != ""]
    print(
        f"\nCities using a nearby cell ({len(noted)}): {', '.join(noted['city']) or 'none'}"
    )
    print(f"Cells per county: {counties['cells'].min()} to {counties['cells'].max()}")


if __name__ == "__main__":
    main()
