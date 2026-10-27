"""Shared settings for the climate data pipeline.

All paths are relative to this folder, so the code runs on any computer
(no more C:\\Users\\... paths). Run everything from the pipeline/ folder.
"""

from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PIPELINE_DIR = Path(__file__).resolve().parent
REPO_DIR = PIPELINE_DIR.parent
DATA_DIR = PIPELINE_DIR / "data"

RAW_DIR = DATA_DIR / "raw"                      # not committed (see .gitignore)
CLIMATE_RAW_DIRS = {
    "temperature": RAW_DIR / "temperature",
    "precipitation": RAW_DIR / "precipitation",
}
SEA_LEVEL_RAW_FILE = RAW_DIR / "sea_level" / "ukcp18_sea_level_ireland.csv"
MANIFEST_FILE = RAW_DIR / "MANIFEST.md"

BOUNDARY_FILE = DATA_DIR / "boundaries" / "ie_county_26.json"

PROCESSED_DIR = DATA_DIR / "processed"
OUTPUT_CSV = PROCESSED_DIR / "climate_data.csv"
CLEANING_REPORT_CSV = PROCESSED_DIR / "cleaning_report.csv"

DOCS_DIR = REPO_DIR / "docs"
INSPECTION_REPORT = DOCS_DIR / "dataset-inspection.md"

# ---------------------------------------------------------------------------
# County boundaries
# ---------------------------------------------------------------------------

# The CSO file says EPSG:4326 but its coordinates are really Irish Grid.
# Testing showed EPSG:29903 lines up with Ireland; EPSG:2157 did not.
BOUNDARY_TRUE_CRS = "EPSG:29903"
NORTHERN_IRELAND = "Northern Ireland"
COUNTY_NAME_FIELD = "AREA_NAME"

# Metric CRS (Irish Transverse Mercator) for distance calculations.
METRIC_CRS = "EPSG:2157"

# ---------------------------------------------------------------------------
# Climate Ireland / TRANSLATE datasets
# ---------------------------------------------------------------------------

# NetCDF variable name -> (CSV variable name, unit)
CLIMATE_VARIABLES = {
    "tmean": ("temperature", "degC"),
    "tot_prec": ("precipitation", "mm"),
}

SEASONS = {
    "ANNUAL": "Annual",
    "DJF": "Winter",
    "MAM": "Spring",
    "JJA": "Summer",
    "SON": "Autumn",
}

SCENARIOS = ("baseline", "rcp26", "rcp45", "rcp85")
BASELINE_PERIOD = "1976-2005"
FUTURE_PERIODS = ("2021-2050", "2071-2100")

# Climate Ireland download address. The .zip is named "ensmid" but the
# NetCDF file inside is named "ensmean".
CLIMATE_IRELAND_BASE_URL = "https://www.climateservices.ie/TRANSLATE/"

# ---------------------------------------------------------------------------
# UKCP18 sea level
# ---------------------------------------------------------------------------

UKCP18_QUERY_URL = (
    "https://services.arcgis.com/Lq3V5RFuTBC9I7kv/ArcGIS/rest/services/"
    "Sea_Level_2010_2100/FeatureServer/1/query"
)
# lon/lat box around the island of Ireland (includes some UK cells,
# which the county join drops).
UKCP18_IRELAND_BBOX = (-11.0, 51.2, -5.3, 55.6)
UKCP18_PERCENTILE = "50"          # use the median only (see docs/data-review.md §5)
UKCP18_UNIT = "cm"

# Decadal years averaged into each dashboard period.
SEA_LEVEL_PERIOD_YEARS = {
    "2021-2050": (2030, 2040, 2050),
    "2071-2100": (2080, 2090, 2100),
}

# A coastal cell is assigned to the nearest county only if it is this close.
# UKCP18 cells are ~12 km apart, so 15 km keeps each cell to its own coast.
SEA_LEVEL_MAX_DISTANCE_M = 15_000

# ---------------------------------------------------------------------------
# Cleaning: fill values and plausible ranges (CCD-275)
# ---------------------------------------------------------------------------

# Values NetCDF tools commonly use for "no data". Treated like nulls.
FILL_VALUES = (-9999.0, -999.0, 9.969209968386869e36, 1e20)

# A value outside its range is physically impossible for Ireland, so it is
# a data error (e.g. 365 instead of 36.5), not real climate. Each range has
# its source. Keys are (variable, "annual" | "seasonal").
PLAUSIBLE_RANGES = {
    # Met Éireann weather extreme records (https://www.met.ie/climate/weather-extreme-records):
    # lowest air temperature -18.8 °C (Lullymore, 2 Jan 1979), highest 32.5 °C
    # (Boora, 29 Jun 1976). An annual or seasonal MEAN cannot fall outside the
    # range of single readings ever recorded.
    ("temperature", "annual"): (-18.8, 32.5),
    ("temperature", "seasonal"): (-18.8, 32.5),

    # Met Éireann weather extreme records: lowest annual rainfall 356.6 mm
    # (Glasnevin, 1887), highest annual 3,964.9 mm (Ballaghbeama Gap, 1960).
    ("precipitation", "annual"): (356.6, 3964.9),
    # Same source: lowest monthly total 0.0 mm, highest monthly 943.5 mm
    # (Gernapeka, Dec 2015). A season is 3 months, so at most 3 x 943.5 mm.
    ("precipitation", "seasonal"): (0.0, 2830.5),

    # Lower: every UKCP18 value for Irish coast cells is a rise (minimum
    # 0.97 cm across all percentiles and years, checked 27 Oct 2026).
    # Upper: IPCC AR6 Synthesis Report says a rise above 2 m by 2100 can't be
    # ruled out under very high emissions. More than 200 cm means a unit error.
    ("sea_level", "annual"): (0.0, 200.0),
}

# ---------------------------------------------------------------------------
# Output checks (docs/variables.md §3)
# ---------------------------------------------------------------------------

COUNTY_COUNT = 26
EXPECTED_ROWS = {
    "temperature": 910,     # 26 counties x 5 seasons x 7 scenario/periods
    "precipitation": 910,
}
MAX_SEA_LEVEL_ROWS = 90     # 15 coastal counties x 3 RCPs x 2 periods

OUTPUT_COLUMNS = ["county", "variable", "scenario", "period", "season", "value", "unit"]
