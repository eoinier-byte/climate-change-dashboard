"""Raw climate files -> data/processed/climate_data.csv

Run from the pipeline/ folder:
    python -m process

Based on Eoin's scripts/process_climate_data.py, with:
- paths relative to the project (no C:\\Users\\... paths)
- strict file-name parsing (no "unknown" rows)
- cleaning before averaging, with a report (CCD-275)
- UKCP18 sea level rows for coastal counties
- a `unit` column and row-count checks (docs/variables.md)
"""

import sys

import geopandas as gpd
import pandas as pd
import xarray as xr

import sea_level
from clean import clean
from config import (
    BOUNDARY_FILE,
    BOUNDARY_TRUE_CRS,
    CLEANING_REPORT_CSV,
    CLIMATE_RAW_DIRS,
    COUNTY_COUNT,
    COUNTY_NAME_FIELD,
    EXPECTED_ROWS,
    MAX_SEA_LEVEL_ROWS,
    NORTHERN_IRELAND,
    OUTPUT_COLUMNS,
    OUTPUT_CSV,
    PROCESSED_DIR,
    SEA_LEVEL_RAW_FILE,
)
from filenames import find_climate_files


def load_counties():
    """All 27 areas (26 counties + Northern Ireland) in lat/lon.

    The CSO file's CRS label is wrong: override it to Irish Grid first.
    """
    counties = gpd.read_file(BOUNDARY_FILE)
    counties = counties.set_crs(BOUNDARY_TRUE_CRS, allow_override=True)
    return counties.to_crs("EPSG:4326")


def grid_to_points(climate_file):
    """Open one NetCDF file and return its grid cells as a DataFrame."""
    with xr.open_dataset(climate_file.path, engine="netcdf4") as ds:
        data = ds[climate_file.nc_var]
        if "time" in data.dims:
            data = data.isel(time=0)     # each file holds one "representative year"
        return data.to_dataframe().reset_index()


def process_climate_file(climate_file, counties):
    """County averages for one file, plus its cleaning report."""
    df = grid_to_points(climate_file)

    df, report = clean(
        df,
        value_column=climate_file.nc_var,
        variable=climate_file.variable,
        season=climate_file.season,
        source=climate_file.path.name,
    )

    points = gpd.GeoDataFrame(
        df,
        geometry=gpd.points_from_xy(df["lon"], df["lat"]),
        crs="EPSG:4326",
    )
    joined = gpd.sjoin(points, counties, how="inner", predicate="intersects")

    means = joined.groupby(COUNTY_NAME_FIELD)[climate_file.nc_var].mean()
    rows = [
        {
            "county": county,
            "variable": climate_file.variable,
            "scenario": climate_file.scenario,
            "period": climate_file.period,
            "season": climate_file.season,
            "value": round(float(value), 3),
            "unit": climate_file.unit,
        }
        for county, value in means.items()
    ]
    return rows, report


def process_sea_level(counties_all):
    """UKCP18 rows for coastal counties, or [] if the data isn't downloaded."""
    if not SEA_LEVEL_RAW_FILE.exists():
        print(f"\nSea level skipped: {SEA_LEVEL_RAW_FILE} not found.")
        print("Run: python scripts/download_ukcp18.py")
        return [], []

    cells = sea_level.load_cells(SEA_LEVEL_RAW_FILE)
    values = sea_level.period_means(cells)
    reports = []
    kept_parts = []
    for (scenario, period), part in values.groupby(["scenario", "period"]):
        kept, report = clean(part, "value", "sea_level", "Annual",
                             source=f"UKCP18 {scenario} {period}")
        kept_parts.append(kept)
        reports.append(report)
    values = pd.concat(kept_parts, ignore_index=True)

    assigned = sea_level.assign_to_counties(values, counties_all)
    return sea_level.county_rows(assigned), reports


def check_output(df):
    """Fail loudly if the output doesn't match docs/variables.md."""
    problems = []

    counts = df.groupby("variable").size().to_dict()
    for variable, expected in EXPECTED_ROWS.items():
        got = counts.get(variable, 0)
        if got != expected:
            problems.append(f"{variable}: expected {expected} rows, got {got}")

    sea_rows = counts.get("sea_level", 0)
    if sea_rows > MAX_SEA_LEVEL_ROWS:
        problems.append(f"sea_level: at most {MAX_SEA_LEVEL_ROWS} rows expected, got {sea_rows}")

    climate = df[df["variable"].isin(EXPECTED_ROWS)]
    if climate["county"].nunique() != COUNTY_COUNT:
        problems.append(f"expected {COUNTY_COUNT} counties, got {climate['county'].nunique()}")

    if NORTHERN_IRELAND in set(df["county"]):
        problems.append("Northern Ireland rows found")

    if df["value"].isna().any():
        problems.append(f"{int(df['value'].isna().sum())} null values in output")

    duplicates = df.duplicated(["county", "variable", "scenario", "period", "season"]).sum()
    if duplicates:
        problems.append(f"{duplicates} duplicate rows")

    return problems


def main():
    print("Loading county boundaries...")
    counties_all = load_counties()
    counties = counties_all[counties_all[COUNTY_NAME_FIELD] != NORTHERN_IRELAND]
    print(f"Loaded {len(counties)} counties")

    files, skipped = find_climate_files(CLIMATE_RAW_DIRS.values())
    print(f"\nFound {len(files)} climate files")
    for path in skipped:
        print(f"  Skipped (name not recognised): {path.name}")

    all_rows, reports, failures = [], [], []
    for climate_file in files:
        print(f"Processing: {climate_file.path.name}")
        try:
            rows, report = process_climate_file(climate_file, counties)
            all_rows.extend(rows)
            reports.append(report)
        except Exception as error:          # keep going, report at the end
            failures.append((climate_file.path.name, error))

    sea_rows, sea_reports = process_sea_level(counties_all)
    all_rows.extend(sea_rows)
    reports.extend(sea_reports)

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    report_df = pd.DataFrame([r.as_dict() for r in reports])
    report_df.to_csv(CLEANING_REPORT_CSV, index=False)

    output = pd.DataFrame(all_rows, columns=OUTPUT_COLUMNS)
    output = output.sort_values(["county", "variable", "scenario", "period", "season"])
    output.to_csv(OUTPUT_CSV, index=False)

    print("\n" + "=" * 50)
    print(f"Rows written: {len(output)}  ->  {OUTPUT_CSV}")
    print(output.groupby("variable").size().to_string())
    if not report_df.empty:
        totals = report_df[["rows_in", "null", "fill_value", "out_of_range", "rows_out"]].sum()
        print("\nCleaning totals (grid cells):")
        print(totals.to_string())
        print(f"Per-file report: {CLEANING_REPORT_CSV}")

    problems = check_output(output)
    for name, error in failures:
        problems.append(f"FAILED {name}: {error}")

    if problems:
        print("\nPROBLEMS:")
        for problem in problems:
            print(f"  - {problem}")
        sys.exit(1)

    print("\nAll checks passed.")


if __name__ == "__main__":
    main()
