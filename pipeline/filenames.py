"""Read variable, scenario, period and season from a Climate Ireland file name.

Example names:
    tmean_CMIP5_baseline_1976-2005_ANNUAL.nc
    tot_prec_CMIP5_rcp85_2071-2100_ensmean_final_JJA.nc

The old code used `"rcp26" in path` checks and returned "unknown" when
nothing matched, which could slip into the CSV. This version only accepts
names that match the exact pattern and returns None for anything else.
"""

import re
from dataclasses import dataclass
from pathlib import Path

from config import BASELINE_PERIOD, CLIMATE_VARIABLES, FUTURE_PERIODS, SEASONS

_PATTERN = re.compile(
    r"^(?P<nc_var>tmean|tot_prec)"
    r"_CMIP5_"
    r"(?P<scenario>baseline|rcp26|rcp45|rcp85)"
    r"_(?P<period>\d{4}-\d{4})"
    r"(?:_(?:ensmean|ensmid)_final)?"
    r"_(?P<season_code>ANNUAL|DJF|MAM|JJA|SON)"
    r"\.nc$"
)


@dataclass(frozen=True)
class ClimateFile:
    path: Path
    nc_var: str        # variable name inside the NetCDF file, e.g. "tmean"
    variable: str      # name used in climate_data.csv, e.g. "temperature"
    unit: str
    scenario: str
    period: str
    season: str        # "Annual", "Winter", ...


def parse_climate_filename(path):
    """Return a ClimateFile, or None if the name isn't a dataset we use."""
    path = Path(path)
    match = _PATTERN.match(path.name)
    if not match:
        return None

    scenario = match["scenario"]
    period = match["period"]

    # Baseline files must use the baseline period, and projections a future one.
    if scenario == "baseline" and period != BASELINE_PERIOD:
        return None
    if scenario != "baseline" and period not in FUTURE_PERIODS:
        return None

    variable, unit = CLIMATE_VARIABLES[match["nc_var"]]
    return ClimateFile(
        path=path,
        nc_var=match["nc_var"],
        variable=variable,
        unit=unit,
        scenario=scenario,
        period=period,
        season=SEASONS[match["season_code"]],
    )


def find_climate_files(folders):
    """Every recognised .nc file under the given folders, in a stable order.

    Files are found by name, not by folder, so the pipeline still works
    if a file sits in a different sub-folder.
    """
    found = []
    skipped = []
    for folder in folders:
        for path in sorted(Path(folder).rglob("*.nc")):
            parsed = parse_climate_filename(path)
            if parsed is None:
                skipped.append(path)
            else:
                found.append(parsed)
    return found, skipped
