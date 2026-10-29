# Required Variables — Column Specification (CCD-20)

| | |
|---|---|
| **Purpose** | Column specification for the processing pipeline outputs `climate_data.csv` and `sea_level.csv` |
| **Built from** | [docs/data-review.md](data-review.md) (CCD-17, CCD-19) |
| **Sources** | See [DATA_SOURCES.md](../DATA_SOURCES.md) |
| **Date** | 27 October 2026 (updated 29 October 2026: sea level moved to its own file, every 10 years) |
| **Owner** | Eoin Ryan |

Both files are made by `pipeline/process_climate_data.py` and saved in `pipeline/data/processed/` (each also as `.json`). Database tables: [data-model.md](data-model.md).

---

## 1. Output files

### `climate_data.csv`: temperature and rainfall

One row per county × variable × scenario × period × season.

| Column | Type | Allowed values | Notes |
|---|---|---|---|
| `county` | text | The 26 ROI county names, from the `ENGLISH` column of the Tailte Éireann boundary file in title case (e.g. `Cork`, `Dublin`) | Northern Ireland excluded. Dublin is one county ([county-rules.md](county-rules.md)) |
| `variable` | text | `temperature`, `precipitation` | Lower case |
| `scenario` | text | `baseline`, `rcp26`, `rcp45`, `rcp85` | |
| `period` | text | `1976-2005`, `2021-2050`, `2071-2100` | `1976-2005` only with `baseline` |
| `season` | text | `Annual`, `Winter`, `Spring`, `Summer`, `Autumn` | The database stores these lower case |
| `value` | decimal | Number, 3 decimal places | Absolute value, unit in `unit` |
| `unit` | text | `degC`, `mm` | |

### `sea_level.csv`: sea level rise, coastal counties

One row per coastal county × scenario × year.

| Column | Type | Allowed values | Notes |
|---|---|---|---|
| `county` | text | The 15 coastal counties (see §5) | Inland counties have no rows |
| `scenario` | text | `rcp26`, `rcp45`, `rcp85` | No `baseline` rows: the rise is measured from the 1981–2000 average, so the baseline is 0 cm |
| `year` | integer | `2020`, `2030` … `2100` | Every 10 years (9 values) |
| `rise_cm` | decimal | Number, 3 decimal places | Rise in cm since the 1981–2000 average |
| `source` | text | `UKCP18`, `UKCP18, estimated from Sligo`, `UKCP18, estimated from Clare` | Marks Leitrim and Limerick as estimates |

## 2. Variables

| Dashboard value | File / `variable` | Unit | Scenarios | Periods / years | Seasons | Baseline period | Source dataset (`DATA_SOURCES.md` entry) |
|---|---|---|---|---|---|---|---|
| Mean temperature, present day | `climate_data.csv` / `temperature` | °C (`degC`) | `baseline` | `1976-2005` | all 5 | — | Climate Ireland / TRANSLATE `tmean_CMIP5_baseline_1976-2005_{season}` (§1) |
| Mean temperature, future | `climate_data.csv` / `temperature` | °C (`degC`) | `rcp26`, `rcp45`, `rcp85` | `2021-2050`, `2071-2100` | all 5 | 1976–2005 | Climate Ireland / TRANSLATE `tmean_CMIP5_{rcp}_{period}_ensmean_final_{season}` (§1) |
| Total precipitation, present day | `climate_data.csv` / `precipitation` | mm per season or year (`mm`) | `baseline` | `1976-2005` | all 5 | — | Climate Ireland / TRANSLATE `tot_prec_CMIP5_baseline_1976-2005_{season}` (§1) |
| Total precipitation, future | `climate_data.csv` / `precipitation` | mm per season or year (`mm`) | `rcp26`, `rcp45`, `rcp85` | `2021-2050`, `2071-2100` | all 5 | 1976–2005 | Climate Ireland / TRANSLATE `tot_prec_CMIP5_{rcp}_{period}_ensmean_final_{season}` (§1) |
| Sea level rise (coastal counties) | `sea_level.csv` | cm above baseline | `rcp26`, `rcp45`, `rcp85` | 2020–2100, every 10 years | — | **1981–2000** | Met Office UKCP18 time-mean sea level, `rcp*_50` rows (§2) |
| County name and boundary | — | — | — | — | — | — | Tailte Éireann county boundaries, 2019, Generalised 20m (§3) |

### Derived values (calculated in the app, not stored)

| Dashboard value | Formula | Unit |
|---|---|---|
| Temperature change | future − baseline (same county and season) | °C |
| Precipitation change | (future − baseline) ÷ baseline × 100 | % |
| Sea level | stored value is already a change | cm |

## 3. Expected row counts

| File | Calculation | Rows |
|---|---|---|
| `climate_data.csv`: `temperature` | 26 counties × 5 seasons × 7 scenario/period combinations | 910 |
| `climate_data.csv`: `precipitation` | 26 × 5 × 7 | 910 |
| **`climate_data.csv` total** | | **1,820** |
| `sea_level.csv` | 15 coastal counties × 3 RCPs × 9 years | **405** |

Both counts were confirmed by running the pipeline on 28 October 2026.

## 4. Validation ranges

Values outside these ranges should be flagged during cleaning (CCD-275).

| Variable | Season | Plausible range |
|---|---|---|
| `temperature` | Annual | 5 to 16 °C |
| `temperature` | seasonal | −2 to 22 °C |
| `precipitation` | Annual | 500 to 3,000 mm |
| `precipitation` | seasonal | 50 to 1,200 mm |
| sea level `rise_cm` | — | 0 to 150 cm (current data: 6.4 to 75.4) |

These ranges are set from the baseline maps and the spot checks in `data-review.md`, with a margin. Adjust them if real data falls outside.

## 5. Gaps and differences to tell the team

1. **Sea level is every 10 years, not period averages.** CCD-20 asked for sea level "for 2050 and 2100". We keep every decade from 2020 to 2100, so the dashboard can show the rise over time and still pick out 2050 and 2100. Because it doesn't share the temperature and rainfall periods, sea level has its own file and table (`SeaLevelProjection`).
2. **Sea level baseline is 1981–2000**, not 1976–2005. The dashboard must label it separately.
3. **No sea level for inland counties.** Show "No coastline", never 0. The inland counties are Carlow, Cavan, Kildare, Kilkenny, Laois, Longford, Monaghan, Offaly, Roscommon, Tipperary and Westmeath. The 15 coastal counties are Clare, Cork, Donegal, Dublin, Galway, Kerry, Leitrim, Limerick, Louth, Mayo, Meath, Sligo, Waterford, Wexford and Wicklow.
4. **Leitrim and Limerick are estimates.** Neither has a UKCP18 sea point within 15 km of its coast. Leitrim uses Sligo's values (Donegal Bay) and Limerick uses Clare's (Shannon Estuary), marked in the `source` column.
5. **No present-day sea level row.** The baseline is 0 by definition.
6. **`unit` column** is in `climate_data.csv`, and the database stores it (`ClimateProjection.unit`).
7. **Not provided by our sources at all:** maximum and minimum temperature, the 2041–2070 period and uncertainty ranges are available but out of scope. Nothing the dashboard currently needs is missing.