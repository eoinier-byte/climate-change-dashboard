# Required Variables — Column Specification (CCD-20)

| | |
|---|---|
| **Purpose** | Column specification for the processing pipeline and `climate_data.csv` |
| **Built from** | [docs/data-review.md](data-review.md) (CCD-17, CCD-19) |
| **Sources** | See [DATA_SOURCES.md](../DATA_SOURCES.md) |
| **Date** | 27 October 2026 |
| **Owner** | Eoin Ryan |

---

## 1. Output file: `climate_data.csv`

One row per county × variable × scenario × period × season.

| Column | Type | Allowed values | Notes |
|---|---|---|---|
| `county` | text | The 26 ROI county names from `AREA_NAME` in `ie_county_26.json` (e.g. `Cork`, `Dublin`) | Northern Ireland excluded |
| `variable` | text | `temperature`, `precipitation`, `sea_level` | Lower case |
| `scenario` | text | `baseline`, `rcp26`, `rcp45`, `rcp85` | `sea_level` has no `baseline` rows |
| `period` | text | `1976-2005`, `2021-2050`, `2071-2100` | `1976-2005` only with `baseline` |
| `season` | text | `Annual`, `Winter`, `Spring`, `Summer`, `Autumn` | `sea_level` is `Annual` only |
| `value` | decimal | Number, 3 decimal places | Unit depends on `variable`, see §2 |
| `unit` | text | `degC`, `mm`, `cm` | **New column.** Keeps units explicit for the API and frontend |

## 2. Variables

| Dashboard value | `variable` | Unit | Scenarios | Periods | Seasons | Baseline period | Source dataset (`DATA_SOURCES.md` entry) |
|---|---|---|---|---|---|---|---|
| Mean temperature, present day | `temperature` | °C (`degC`) | `baseline` | `1976-2005` | all 5 | — | Climate Ireland / TRANSLATE `tmean_CMIP5_baseline_1976-2005_{season}` (§1) |
| Mean temperature, future | `temperature` | °C (`degC`) | `rcp26`, `rcp45`, `rcp85` | `2021-2050`, `2071-2100` | all 5 | 1976–2005 | Climate Ireland / TRANSLATE `tmean_CMIP5_{rcp}_{period}_ensmid_final_{season}` (§1) |
| Total precipitation, present day | `precipitation` | mm per season or year (`mm`) | `baseline` | `1976-2005` | all 5 | — | Climate Ireland / TRANSLATE `tot_prec_CMIP5_baseline_1976-2005_{season}` (§1) |
| Total precipitation, future | `precipitation` | mm per season or year (`mm`) | `rcp26`, `rcp45`, `rcp85` | `2021-2050`, `2071-2100` | all 5 | 1976–2005 | Climate Ireland / TRANSLATE `tot_prec_CMIP5_{rcp}_{period}_ensmid_final_{season}` (§1) |
| Sea level rise (coastal counties) | `sea_level` | cm above baseline (`cm`) | `rcp26`, `rcp45`, `rcp85` | `2021-2050`, `2071-2100` | `Annual` | **1981–2000** | Met Office UKCP18 time-mean sea level, `rcp*_50` rows (§2) |
| County name and boundary | — | — | — | — | — | — | CSO `ie_county_26.json` (§3) |

### Derived values (calculated in the app, not stored)

| Dashboard value | Formula | Unit |
|---|---|---|
| Temperature change | future − baseline (same county and season) | °C |
| Precipitation change | (future − baseline) ÷ baseline × 100 | % |
| Sea level | stored value is already a change | cm |

## 3. Expected row counts

| Variable | Calculation | Rows |
|---|---|---|
| `temperature` | 26 counties × 5 seasons × 7 scenario/period combinations | 910 |
| `precipitation` | 26 × 5 × 7 | 910 |
| `sea_level` | 15 coastal counties × 3 RCPs × 2 periods × 1 season | ≤ 90 |
| **Total** | | **≤ 1,910** |

The pipeline should fail if `temperature` or `precipitation` don't have exactly 910 rows each.

## 4. Validation ranges

The cleaning step (CCD-275) uses sourced ranges for what is physically impossible in Ireland. They're based on Met Éireann's record extremes, UKCP18 and IPCC AR6. The ranges and their sources are in [`cleaning-rules.md`](cleaning-rules.md), and the values are in `pipeline/config.py`.

| `variable` | Season | Range |
|---|---|---|
| `temperature` | all | −18.8 to 32.5 °C |
| `precipitation` | Annual | 356.6 to 3,964.9 mm |
| `precipitation` | seasonal | 0 to 2,830.5 mm |
| `sea_level` | Annual | 0 to 200 cm |

Expected values are much narrower. In the first full run, county temperatures were 4.3 to 17.7 °C and annual precipitation was 832 to 1,890 mm.

## 5. Gaps and differences to tell the team

1. **Sea level years vs periods.** CCD-20 asked for sea level "for 2050 and 2100". We store 30-year period averages instead (2021–2050 = mean of 2030/2040/2050; 2071–2100 = mean of 2080/2090/2100). This matches the temperature and rainfall periods. The 2100 single-year value will be higher than the 2071–2100 average.
2. **Sea level baseline is 1981–2000**, not 1976–2005. The dashboard must label it separately.
3. **No sea level for inland counties.** Show "No coastline", never 0. The inland counties are Carlow, Cavan, Kildare, Kilkenny, Laois, Longford, Monaghan, Offaly, Roscommon, Tipperary and Westmeath. That leaves 15 coastal counties. Leitrim (about 3 km of coast) and Limerick (Shannon estuary only) may not get a UKCP18 cell; confirm both in the cell-to-county join.
4. **No present-day sea level row.** The baseline is 0 by definition.
5. **New `unit` column.** The earlier CSV didn't have one, so the database table (CCD-31 / CCD-40) needs it added.
6. **Not provided by our sources at all:** maximum and minimum temperature, the 2041–2070 period and uncertainty ranges are available but out of scope. Nothing the dashboard currently needs is missing.
