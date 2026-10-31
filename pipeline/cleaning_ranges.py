# CCD-275: the lowest and highest value we accept for each variable.
#
# IMPORTANT: our files hold 30-YEAR AVERAGES (e.g. the average summer
# temperature from 2071-2100), not the temperature on one hot day.
# So the numbers are much lower than a heatwave record.
#
# The highest real value in our data is 17.7 degC (Wexford, summer,
# RCP8.5, 2071-2100). The lowest is 4.3 degC (a winter average).
# The ranges below leave a safety margin around that, because single
# grid cells (e.g. on a mountain) can be a bit colder or wetter than a
# county's average.
#
# The ranges aren't there to catch slightly odd values. They catch
# IMPOSSIBLE ones, like 365 typed instead of 36.5.
#
# Source: docs/variables.md, section 4 "Validation ranges".
#
# Rainfall was first set to 3,000 mm, but our first real run (31 Oct 2026)
# removed 40 to 117 real cells from every ANNUAL rainfall file. These are
# very wet mountain cells: the baseline file's wettest cell is 3,577 mm a
# year. So the maximum is now 5,000 mm. That still catches mistakes like
# an extra zero (e.g. 13,000 instead of 1,300).

# RANGES: variable name -> (lowest allowed, highest allowed)
RANGES = {
    "temperature": (-2, 22),       # degC
    "precipitation": (50, 5000),   # mm
}

# FILL_VALUE: a number some climate files use to mean "no data here".
# It isn't a real measurement, so we remove it.
FILL_VALUE = -9999