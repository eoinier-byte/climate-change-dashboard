# Data Cleaning Rules (CCD-275)

Code: `pipeline/clean.py`. Ranges: `pipeline/cleaning_ranges.py`.

Before a county average is worked out, every grid cell's value is checked. A value is **bad** if it is:

| Problem | Example |
|---|---|
| Empty (null) | NaN |
| A "no data" code | -9999 |
| Outside the range below | 365 instead of 36.5 |

| Variable | Accepted range | Source |
|---|---|---|
| Temperature | -2 to 22 °C | [variables.md](variables.md) §4 |
| Rainfall | 50 to 5,000 mm | [variables.md](variables.md) §4 (raised from 3,000 on 31 Oct 2026: real mountain cells reach 3,577 mm a year) |

**Rule:** bad values are left out of the average. They are never filled in with another number. `process_climate_data.py` prints how many were removed from each file.

**Agreed by:** ☐ Taras ☐ Artur ☐ Ronel ☐ Eoin