# Aggregation Validation Log (CCD-36)

**Date:** 31 October 2026 **Run by:** Eoin Ryan
**Script:** `pipeline/validate_aggregation.py` · **Tolerance:** 0.0005 (rounding only)

## Check 1: Cork and Dublin recomputed a different way: PASSED

Every grid cell was checked one by one ("is this point inside the county?") instead of using `gpd.sjoin()`, for the baseline annual temperature and rainfall files.

| County | Variable | Mine | Pipeline | Difference |
|---|---|---|---|---|
| Cork | temperature | 9.815 | 9.815 | 0.0003 |
| Cork | precipitation | 1368.817 | 1368.817 | 0.0001 |
| Dublin | temperature | 9.674 | 9.674 | 0.0003 |
| Dublin | precipitation | 843.268 | 843.268 | 0.0003 |

All differences are within the rounding tolerance.

## Check 2: every county value is between the file's lowest and highest value: PASSED

Temperature file: 4.898 to 11.139 °C. Rainfall file: 545.735 to 3,576.961 mm. Problems found: 0.

## Check 3: test with a tiny made-up grid: PASSED

`pipeline/tests/test_aggregate.py` passed.

## Differences explained / Jira bugs logged

- No differences in the checks above.
- **Cleaning range fixed during this run:** the first pipeline run removed 40 to 117 real cells from every annual rainfall file as "out of range". 
- These are very wet mountain cells (the baseline file's wettest cell is 3,577 mm a year), so the rainfall maximum was raised from 3,000 to 5,000 mm (`pipeline/cleaning_ranges.py`, `docs/cleaning-rules.md`, `docs/variables.md`). 
- After the rerun, all 70 files had 0 values out of range, and the output had 0 empty values.
---

# Import Validation Log (CCD-271)

**Date:** 12 November 2026 **Run by:** Artur Romanov
**Database:** local dev (`climate_dev`, PostgreSQL 16 from `docker-compose.yml`), loaded with `python manage.py load_data` (CCD-270, commit `dd37824`)
**Compared with:** `pipeline/data/processed/climate_data.csv` and `sea_level.csv`, and 3 TRANSLATE source files
**Automated version:** `backend/climate/tests/test_loaded_data.py` runs checks 1–4 in CI on every pull request

## Check 1: total rows: PASSED

| Table | CSV data rows | Database rows |
|---|---|---|
| ClimateProjection | 1,820 | 1,820 |
| SeaLevelProjection | 405 | 405 |
| County | 26 names | 26 (15 coastal) |

## Check 2: rows per county, scenario and variable: PASSED

- ClimateProjection: 208 groups in both (26 counties × 4 scenarios × 2 variables). 52 baseline groups have 5 rows (1 period × 5 seasons) and 156 future groups have 10 (2 periods × 5 seasons). Mismatches: 0.
- SeaLevelProjection: 45 groups in both (15 coastal counties × 3 scenarios), 9 years each. Mismatches: 0.

## Check 3: five CSV rows looked up in the database: PASSED

Rows chosen with `random.Random(2026).sample()`, so the test checks the same five.

| County | Variable | Scenario | Period | Season | CSV | Database | Result |
|---|---|---|---|---|---|---|---|
| Cork | precipitation | rcp85 | 2071-2100 | Summer | 229.557 mm | 229.557 mm, rcp85 | Match |
| Kilkenny | precipitation | rcp45 | 2071-2100 | Winter | 325.145 mm | 325.145 mm, rcp45 | Match |
| Louth | temperature | rcp26 | 2071-2100 | Winter | 5.807 degC | 5.807 degC, rcp26 | Match |
| Louth | temperature | rcp85 | 2071-2100 | Summer | 17.346 degC | 17.346 degC, rcp85 | Match |
| Offaly | temperature | rcp85 | 2071-2100 | Annual | 12.237 degC | 12.237 degC, rcp85 | Match |

## Check 4: no empty values and no duplicate keys: PASSED

- Null or blank cells in County, ClimateProjection and SeaLevelProjection: 0.
- Duplicate natural keys: 0 for (county, variable, scenario, period, season) and 0 for (county, scenario, year). Both unique constraints (`uniq_climate_projection`, `uniq_sea_level_projection`) exist in the database.

## Check 5: three values recomputed from the source files: PASSED

The three files were downloaded from `https://www.climateservices.ie/TRANSLATE/` (the `ensmean_final` `.nc` from each zip). The combinations are ones CCD-36 did not cover: both variables, three scenarios, three seasons, a large and a small county. Each county mean was recomputed with `shapely.contains_xy` point-in-polygon on the Tailte Éireann 2019 boundaries (not the pipeline's `gpd.sjoin`), dropping empty, -9999 and out-of-range cells (CCD-275). The file metadata gives the units as `Celsius` and `mm`.

| County | File | Recomputed | Database | Difference |
|---|---|---|---|---|
| Galway | `tmean_CMIP5_rcp85_2071-2100_ensmean_final_JJA.nc` | 17.0901 | 17.090 degC | 0.0001 |
| Kerry | `tot_prec_CMIP5_rcp45_2021-2050_ensmean_final_DJF.nc` | 596.4895 | 596.490 mm | 0.0005 (rounding) |
| Carlow | `tmean_CMIP5_baseline_1976-2005_MAM.nc` | 8.2894 | 8.289 degC | 0.0004 |

All within the 0.0005 rounding tolerance used in CCD-36.

**Kerry, first attempt:** using every rainfall cell inside the county gave 588.140 mm (4,415 cells). The pipeline counts a cell as land only if the temperature grid has a value there (CCD-31), which leaves 4,077 cells in Kerry. With that land mask the result is 596.4895, matching the database. So the 338 extra cells are rainfall cells on the coast with no temperature value, not a loading error. This is how the pipeline defines land; it is noted here in case the team wants to review it.

## Not checked

- Sea-level values against the UKCP18 source: the raw UKCP18 file is not on this machine. Sea-level rows were checked against `sea_level.csv` only (checks 1, 2 and 4).

## Differences explained / Jira bugs logged

- No mismatches between the database and the processed CSVs, or between the database and the source files, so no Jira bugs were logged.
