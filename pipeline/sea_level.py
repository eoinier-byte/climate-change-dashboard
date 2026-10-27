"""Turn UKCP18 coastal sea level cells into county rows.

Input: data/raw/sea_level/ukcp18_sea_level_ireland.csv
       (made by scripts/download_ukcp18.py)

Steps:
1. Keep the 50th percentile rows only (rcp26_50, rcp45_50, rcp85_50).
2. Average the decadal years into the dashboard periods
   (2021-2050 = 2030/2040/2050, 2071-2100 = 2080/2090/2100).
3. Assign each coastal cell to the nearest county, if it is within 15 km.
   UKCP18 cells sit over the sea, so a point-in-county join would find
   nothing; a nearest-county join is needed.
4. Drop cells nearest Northern Ireland, then average per county.
Inland counties get no row; the dashboard shows "No coastline".
"""

import pandas as pd

from config import (
    COUNTY_NAME_FIELD,
    METRIC_CRS,
    NORTHERN_IRELAND,
    SEA_LEVEL_MAX_DISTANCE_M,
    SEA_LEVEL_PERIOD_YEARS,
    UKCP18_PERCENTILE,
    UKCP18_UNIT,
)


def load_cells(path):
    """Read the downloaded UKCP18 CSV."""
    df = pd.read_csv(path)
    required = {"X", "Y", "rcp_percentile"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"{path} is missing columns: {sorted(missing)}")
    return df


def period_means(cells):
    """50th percentile cells, one row per cell x scenario x period.

    Returns columns: lon, lat, scenario, period, value (cm).
    """
    median = cells[cells["rcp_percentile"].str.endswith(f"_{UKCP18_PERCENTILE}")].copy()
    median["scenario"] = median["rcp_percentile"].str.split("_").str[0]

    rows = []
    for period, years in SEA_LEVEL_PERIOD_YEARS.items():
        columns = [f"seaLevelAnom_{year}" for year in years]
        missing = [c for c in columns if c not in median.columns]
        if missing:
            raise ValueError(f"UKCP18 data is missing columns: {missing}")
        part = median[["X", "Y", "scenario"]].copy()
        part["period"] = period
        part["value"] = median[columns].mean(axis=1)
        rows.append(part)

    out = pd.concat(rows, ignore_index=True)
    return out.rename(columns={"X": "lon", "Y": "lat"})


def assign_to_counties(cell_values, counties_all):
    """Attach the nearest county name to each cell (or drop it).

    counties_all must still include Northern Ireland, so cells off the
    Antrim/Down coast attach there and are dropped, rather than being
    pulled onto Donegal or Louth.
    """
    import geopandas as gpd   # imported here so the pandas-only parts test without it

    points = gpd.GeoDataFrame(
        cell_values,
        geometry=gpd.points_from_xy(cell_values["lon"], cell_values["lat"]),
        crs="EPSG:4326",
    ).to_crs(METRIC_CRS)

    counties = counties_all[[COUNTY_NAME_FIELD, "geometry"]].to_crs(METRIC_CRS)

    joined = gpd.sjoin_nearest(
        points,
        counties,
        how="inner",
        max_distance=SEA_LEVEL_MAX_DISTANCE_M,
        distance_col="distance_m",
    )
    joined = joined[joined[COUNTY_NAME_FIELD] != NORTHERN_IRELAND]
    return pd.DataFrame(joined.drop(columns="geometry"))


def county_rows(assigned):
    """Average per county, scenario and period, in climate_data.csv format."""
    means = (
        assigned.groupby([COUNTY_NAME_FIELD, "scenario", "period"])["value"]
        .mean()
        .reset_index()
    )
    return [
        {
            "county": row[COUNTY_NAME_FIELD],
            "variable": "sea_level",
            "scenario": row["scenario"],
            "period": row["period"],
            "season": "Annual",
            "value": round(float(row["value"]), 3),
            "unit": UKCP18_UNIT,
        }
        for _, row in means.iterrows()
    ]
