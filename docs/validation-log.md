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