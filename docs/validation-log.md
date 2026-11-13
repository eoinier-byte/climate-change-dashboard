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

- Sea-level values against the UKCP18 source: the raw UKCP18 file is not on this machine. Sea-level rows were checked against `sea_level.csv` only (checks 1, 2 and 4). **Done later in CCD-239, check 4 below.**

## Differences explained / Jira bugs logged

- No mismatches between the database and the processed CSVs, or between the database and the source files, so no Jira bugs were logged.

---

# Data Validation Testing (CCD-239)

**Date:** 13 November 2026 **Run by:** Artur Romanov
**Script:** `pipeline/spot_check.py` (tests: `pipeline/tests/test_spot_check.py`) · **Tolerance:** 0.0005 (rounding only, as in CCD-36)
**Compared with:** `pipeline/data/processed/climate_data.csv` and `sea_level.csv`. CCD-271 showed the database matches these files row for row, so a match with the CSV is a match with the database.

This section brings together every validation check on the data. Earlier checks (CCD-36, CCD-271) are referenced, not repeated. New checks use source files downloaded on 13 November 2026:

| Source | What was downloaded |
|---|---|
| TRANSLATE, https://www.climateservices.ie/TRANSLATE/ | `tmean_CMIP5_rcp26_2021-2050_ensmid_final_SON.zip`, `tot_prec_CMIP5_rcp85_2071-2100_ensmid_final_JJA.zip` (the `ensmean_final` `.nc` inside each), and `tmean_CMIP5_baseline_1976-2005_ANNUAL.zip` (the land mask the pipeline uses, CCD-31) |
| UKCP18, feature service in `DATA_SOURCES.md` §2 | Layer 1 "UKCP18 Time-mean Sea Level Projections to 2100 (cm)", query `rcp_percentile LIKE '%_50'` inside lon −11 to −5.3, lat 51.2 to 55.6: 636 rows (212 cells × 3 scenarios) |

`spot_check.py` recomputes values a different way from the pipeline: `shapely.contains_xy` point-in-polygon instead of `gpd.sjoin` for climate, and a shapely distance from each sea cell to every county instead of `gpd.sjoin_nearest` for sea level. Same cleaning rules (CCD-275) and the same 15 km sea-point limit.

## Check 1: county aggregation recomputed independently: PASSED

8 counties, 3 different scripts, every difference within rounding.

| County | Variable, file | Recomputed | CSV | Where |
|---|---|---|---|---|
| Cork | temperature, baseline annual | 9.815 | 9.815 | CCD-36 check 1 (rerun here: 9.8147) |
| Dublin | temperature, baseline annual | 9.674 | 9.674 | CCD-36 check 1 (rerun here: 9.6737) |
| Galway | temperature, rcp85 2071-2100 summer | 17.0901 | 17.090 | CCD-271 check 5 |
| Kerry | precipitation, rcp45 2021-2050 winter | 596.4895 | 596.490 | CCD-271 check 5 |
| Carlow | temperature, baseline spring | 8.2894 | 8.289 | CCD-271 check 5 |
| Donegal | temperature, rcp26 2021-2050 autumn | 10.3233 | 10.323 | Check 2 below |
| Wexford | temperature and precipitation | 11.6803 / 189.7328 | 11.680 / 189.733 | Checks 2 and 3 below |
| Mayo | precipitation, rcp85 2071-2100 summer | 263.9961 | 263.996 | Check 3 below |

## Check 2: temperature range and 5 spot-checks: PASSED

**Range.** Baseline annual file: 4.898 to 11.139 °C (CCD-36). `tmean_CMIP5_rcp26_2021-2050_ensmean_final_SON.nc`: 6.540 to 13.099 °C. Both inside the cleaning range −2 to 22 °C (`pipeline/cleaning_ranges.py`). The file metadata gives the unit as `Celsius`; the CSV stores `degC`.

| # | County | Scenario, period, season | Source file (ensmean) | Recomputed | CSV | Difference |
|---|---|---|---|---|---|---|
| 1 | Cork | baseline 1976-2005 Annual | `tmean_CMIP5_baseline_1976-2005_ANNUAL.nc` | 9.8147 | 9.815 | 0.0003 |
| 2 | Dublin | baseline 1976-2005 Annual | `tmean_CMIP5_baseline_1976-2005_ANNUAL.nc` | 9.6737 | 9.674 | 0.0003 |
| 3 | Galway | rcp85 2071-2100 Summer | `tmean_CMIP5_rcp85_2071-2100_ensmean_final_JJA.nc` | 17.0901 | 17.090 | 0.0001 |
| 4 | Carlow | baseline 1976-2005 Spring | `tmean_CMIP5_baseline_1976-2005_MAM.nc` | 8.2894 | 8.289 | 0.0004 |
| 5 | Donegal (4,330 cells) | rcp26 2021-2050 Autumn | `tmean_CMIP5_rcp26_2021-2050_ensmean_final_SON.nc` | 10.3233 | 10.323 | 0.0003 |
| 6 | Wexford (2,106 cells) | rcp26 2021-2050 Autumn | `tmean_CMIP5_rcp26_2021-2050_ensmean_final_SON.nc` | 11.6803 | 11.680 | 0.0003 |

Rows 1–2 are from CCD-36 and were rerun with `spot_check.py` on 13 November; rows 3–4 are from CCD-271 check 5.

## Check 3: precipitation range, unit and 5 spot-checks: PASSED

**Range.** Baseline annual file: 545.735 to 3,576.961 mm (CCD-36). `tot_prec_CMIP5_rcp85_2071-2100_ensmean_final_JJA.nc`: 124.670 to 611.715 mm. Both inside the cleaning range 50 to 5,000 mm.
**Unit.** The file metadata gives `mm`, and the values are seasonal or annual totals (a summer file holds about a quarter of the annual amount), which matches the CSV unit `mm` and `docs/variables.md`.

| # | County | Scenario, period, season | Source file (ensmean) | Recomputed | CSV | Difference |
|---|---|---|---|---|---|---|
| 1 | Cork | baseline 1976-2005 Annual | `tot_prec_CMIP5_baseline_1976-2005_ANNUAL.nc` | 1368.817 | 1368.817 | 0.0001 |
| 2 | Dublin | baseline 1976-2005 Annual | `tot_prec_CMIP5_baseline_1976-2005_ANNUAL.nc` | 843.268 | 843.268 | 0.0003 |
| 3 | Kerry | rcp45 2021-2050 Winter | `tot_prec_CMIP5_rcp45_2021-2050_ensmean_final_DJF.nc` | 596.4895 | 596.490 | 0.0005 |
| 4 | Mayo (5,022 cells) | rcp85 2071-2100 Summer | `tot_prec_CMIP5_rcp85_2071-2100_ensmean_final_JJA.nc` | 263.9961 | 263.996 | 0.0001 |
| 5 | Wexford (2,106 cells) | rcp85 2071-2100 Summer | `tot_prec_CMIP5_rcp85_2071-2100_ensmean_final_JJA.nc` | 189.7328 | 189.733 | 0.0002 |

Rows 1–2 are from CCD-36, row 3 from CCD-271 check 5. Rainfall cells count as land only where the baseline temperature file has a value, as in the pipeline (see the Kerry note in CCD-271).

## Check 4: sea level against the cited source: PASSED

**Source:** Met Office UKCP18 Time-mean Sea Level Projections to 2100 (cm), feature service layer 1 (`DATA_SOURCES.md` §2), field `seaLevelAnom_<year>`, rows with `rcp_percentile` = `<scenario>_50`. A county's value is the mean over the UKCP18 cells nearest to that county and within 15 km of it. The cells used are listed by `OBJECTID`, so each number can be looked up in the service.

| County | Scenario | Year | UKCP18 cells (`OBJECTID`) | Recomputed (cm) | CSV (cm) | Difference |
|---|---|---|---|---|---|---|
| Dublin | rcp45 | 2050 | 2192, 2201, 2210, 2219, 2471 | 19.0463 | 19.046 | 0.0003 |
| Cork | rcp85 | 2100 | 305, 314, 395, 449, 458, 512, 521, 548, 584, 593, 638, 692, 755, 764, 818, 845, 854, 863, 890, 908, 917, 944 | 75.4045 | 75.404 | 0.0005 (rounding) |
| Galway | rcp26 | 2100 | 146, 155, 164, 173, 254, 263, 335, 344, 407, 470 | 38.8326 | 38.833 | 0.0004 |

The pipeline used an export of the same service taken on 27 October 2026; matching values from the 13 November query show the data has not changed since.

## Check 5: CSV and database row counts: PASSED

See CCD-271 checks 1 and 2: ClimateProjection 1,820 = 1,820, SeaLevelProjection 405 = 405, 26 counties, and every county/scenario/variable group matches. Repeated on every pull request by `backend/climate/tests/test_loaded_data.py`.

## Summary (for the report)

The processed data was checked at every step from the source files to the database. County averages were recomputed independently, with a different point-in-polygon method from the pipeline, for 8 of the 26 counties across all four scenarios, all five seasons and both climate variables. Every recomputed value matched the processed data to within 0.0005, which is the rounding to three decimal places. The value ranges recorded for two temperature files (4.9 to 13.1 °C) and two precipitation files (124.7 to 3,577.0 mm) were inside the pipeline's plausibility limits, and the units stated in the files (Celsius, mm) matched the database. Six temperature and five precipitation spot-checks matched the TRANSLATE source files. Three sea-level values matched the Met Office UKCP18 projections, with the exact source cells listed. The database holds exactly the rows in the processed files (1,820 climate and 405 sea-level rows), with no empty values and no duplicate keys, and these database checks run automatically on every pull request. No mismatches were found, so no Jira bugs were logged. Known simplifications, rather than errors, are noted above: rainfall uses the temperature grid's land cells, and Leitrim and Limerick use sea-level values from Sligo and Clare.

## Differences explained / Jira bugs logged

- No mismatches, so no Jira bugs were logged.
