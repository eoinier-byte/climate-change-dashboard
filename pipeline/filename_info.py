"""
filename_info.py - read the details of a climate file from its name.

Example:
    tot_prec_CMIP5_rcp85_2071-2100_ensmean_final_JJA.nc
    -> variable: precipitation, scenario: rcp85, period: 2071-2100, season: Summer
"""

# VARIABLES: the name used inside the file -> the name we use in our CSV
VARIABLES = {
    "tmean": "temperature",
    "tot_prec": "precipitation",
}

# SCENARIOS: the scenarios that can appear in a file name
SCENARIOS = ["baseline", "rcp26", "rcp45", "rcp85"]

# PERIODS: the time periods that can appear in a file name
PERIODS = ["1976-2005", "2021-2050", "2071-2100"]

# SEASONS: the code in the file name -> the season name we use
SEASONS = {
    "ANNUAL": "Annual",
    "DJF": "Winter",  # December, January, February
    "MAM": "Spring",  # March, April, May
    "JJA": "Summer",  # June, July, August
    "SON": "Autumn",  # September, October, November
}


def get_file_details(filename):
    """Return the variable, scenario, period and season found in a file name."""

    # filename: if we're given a full path, keep only the last part (the name)
    filename = str(filename).replace("\\", "/").split("/")[-1]

    # details: what we found. None means "not found in the name".
    details = {
        "file": filename,
        "nc_variable": None,  # name inside the file, e.g. "tmean"
        "variable": None,  # name for our CSV, e.g. "temperature"
        "scenario": None,
        "period": None,
        "season": None,
    }

    # Look for each possible value in the file name
    for code, name in VARIABLES.items():
        if code in filename:
            details["nc_variable"] = code
            details["variable"] = name

    for scenario in SCENARIOS:
        if scenario in filename:
            details["scenario"] = scenario

    for period in PERIODS:
        if period in filename:
            details["period"] = period

    for code, name in SEASONS.items():
        if code in filename:
            details["season"] = name

    return details
