# Cleaning rules (CCD-275)

**Status: proposed by Eoin (data lead). Agree at stand-up, then remove this line.**

Code: `pipeline/clean.py` · Ranges: `pipeline/config.py` (`PLAUSIBLE_RANGES`) · Tests: `pipeline/tests/test_clean.py`

## What is flagged

Every grid cell (and every UKCP18 sea level value) is checked before county averages are calculated.

| Flag | Meaning | Example |
|---|---|---|
| `null` | No value. Most are sea cells, which are empty in every file and expected | `NaN` |
| `fill_value` | A "no data" code used by NetCDF tools | `-9999`, `9.97e36` |
| `out_of_range` | Outside the plausible range for Ireland, so a data error | `365` instead of `36.5` |

## What happens to flagged values

1. **They are removed before averaging.** A county average uses only cells that passed.
2. **Nothing is ever filled in, replaced or changed.**
3. **Every removal is counted.** `python -m process` prints totals and writes `pipeline/data/processed/cleaning_report.csv`, one row per file: rows in, null, fill value, out of range, rows out.
4. If a county ends up with no cells at all, its row is missing, and the row-count check in `process.py` fails the run. The data is never silently incomplete.

## Plausible ranges and their sources

A range marks what is **physically impossible** for Ireland. It does not judge what is likely.

| Variable | Season | Range | Source |
|---|---|---|---|
| temperature | annual & seasonal mean | −18.8 to 32.5 °C | [Met Éireann weather extreme records](https://www.met.ie/climate/weather-extreme-records): lowest −18.8 °C (Lullymore, 1979), highest 32.5 °C (Boora, 1976). A mean cannot fall outside the range of single readings ever recorded. |
| precipitation | annual total | 356.6 to 3,964.9 mm | Same source: lowest annual 356.6 mm (Glasnevin, 1887), highest 3,964.9 mm (Ballaghbeama Gap, 1960) |
| precipitation | seasonal total | 0 to 2,830.5 mm | Same source: lowest month 0.0 mm, highest month 943.5 mm (Gernapeka, Dec 2015); a season is 3 months, so at most 3 × 943.5 mm |
| sea level | 2021–2050, 2071–2100 | 0 to 200 cm | Lower: every UKCP18 Irish coast value is a rise (minimum 0.97 cm, checked 27 Oct 2026). Upper: IPCC AR6 Synthesis Report says a rise above 2 m by 2100 can't be ruled out. Above that means a unit mix-up (mm vs cm) |

These ranges are wide on purpose. They catch typing, unit and fill-value errors without removing real climate values, including future projections warmer or wetter than today.

## To agree at stand-up

- [ ] Removing flagged values before averaging (rather than stopping the whole run on the first one) is acceptable
- [ ] The ranges above are acceptable
