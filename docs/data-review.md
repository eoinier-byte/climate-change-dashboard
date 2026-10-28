# Climate Dataset Review (CCD-17, CCD-19)

| | |
|---|---|
| **Source page** | https://www.climateireland.ie/data-explorer/ (tab: *Climate Change Choices → CMIP5 → Scenarios*) |
| **Supporting pages** | [About the Climate Models](https://www.climateireland.ie/data-explorer/about-the-climate-models/) · [FAQs](https://www.climateireland.ie/data-explorer/faqs/) · [Data dictionary](https://www.climateireland.ie/data-explorer/data-dictionary/) |
| **Date checked** | 27 October 2026 (updated 28 October 2026 after building the pipeline, CCD-25) |
| **Checked by** | Eoin Ryan (PO / climate data owner) |
| **Underlying data** | Met Éireann **TRANSLATE** standardised, bias-corrected projections (O'Brien & Nolan, 2023). CMIP5 GCMs downscaled by regional climate models. |

This page records which Climate Ireland datasets feed the dashboard, what the files contain, and how they map to the pipeline outputs `climate_data.csv` and `sea_level.csv`. It combines a live check of the Data Explorer with the earlier hands-on inspection of the downloaded NetCDF files (Xarray).

---

## 1. Datasets used by the dashboard

The dashboard uses **two variables**, **four scenarios** and **two future periods**.

| Variable | File prefix | NetCDF variable | Scenarios | Periods | Seasons | Units | Absolute or anomaly | Grid | Download format | Files |
|---|---|---|---|---|---|---|---|---|---|---|
| Mean temperature | `tmean` | `tmean` | Baseline, RCP2.6, RCP4.5, RCP8.5 | Baseline 1976–2005; 2021–2050; 2071–2100 | Annual, Winter (DJF), Spring (MAM), Summer (JJA), Autumn (SON) | °C | **Absolute** | 451 × 351 grid, about 1 km cells (≈1.01 × 1.05 km), EPSG:4326 (lat/lon) | `.zip` containing NetCDF (`.nc`); the `ensmean_final` `.nc` is the one used | 5 baseline + 30 future = **35** |
| Precipitation (total) | `tot_prec` | `tot_prec` | same | same | same | mm (total for the season or year) | **Absolute** | same | same | **35** |

**Total: 70 files.** Units and variable names were confirmed with Xarray on the downloaded files. The future files hold absolute climatological values, not anomalies.

### Where each dashboard value comes from

| Dashboard value | Dataset | `climate_data.csv` row |
|---|---|---|
| County temperature, present day | `tmean_CMIP5_baseline_1976-2005_{season}` | `temperature, baseline, 1976-2005, {Season}` |
| County temperature, future | `tmean_CMIP5_{rcp}_{period}_ensmean_final_{season}` | `temperature, {rcp}, {period}, {Season}` |
| County rainfall, present day | `tot_prec_CMIP5_baseline_1976-2005_{season}` | `precipitation, baseline, 1976-2005, {Season}` |
| County rainfall, future | `tot_prec_CMIP5_{rcp}_{period}_ensmean_final_{season}` | `precipitation, {rcp}, {period}, {Season}` |
| Temperature / rainfall change | Not a separate dataset; computed in the app as future − baseline | Rainfall change should be shown as % of baseline to match Climate Ireland |
| Sea level rise (coastal counties) | **Not Climate Ireland.** UKCP18 time-mean sea level, `rcp*_50` rows Separate file `sea_level.csv`: `{county}, {rcp}, {year}, {rise_cm}, {source}`; see §5 |

Token values:

| Token | Values | CSV value |
|---|---|---|
| `{rcp}` | `rcp26`, `rcp45`, `rcp85` | same |
| `{period}` | `2021-2050`, `2071-2100` | same |
| `{season}` | `ANNUAL`, `DJF`, `MAM`, `JJA`, `SON` | `Annual`, `Winter`, `Spring`, `Summer`, `Autumn` |

Scenario labels on the site: RCP2.6 "early action", RCP4.5 "mid action", RCP8.5 "late action".

## 2. Download URLs

All files are under `https://www.climateservices.ie/TRANSLATE/`.

```
Baseline:  {var}_CMIP5_baseline_1976-2005_{season}.zip
Future:    {var}_CMIP5_{rcp}_{period}_ensmid_final_{season}.zip

var    = tmean | tot_prec
rcp    = rcp26 | rcp45 | rcp85
period = 2021-2050 | 2071-2100
season = ANNUAL | DJF | MAM | JJA | SON
```

Examples:
- `https://www.climateservices.ie/TRANSLATE/tmean_CMIP5_baseline_1976-2005_ANNUAL.zip`
- `https://www.climateservices.ie/TRANSLATE/tmean_CMIP5_rcp45_2021-2050_ensmid_final_JJA.zip`
- `https://www.climateservices.ie/TRANSLATE/tot_prec_CMIP5_rcp85_2071-2100_ensmid_final_DJF.zip`

Preview map for any file (PNG, legend shows units): `https://www.climateireland.ie/media/climateireland/map-images/ci-map-viewer-images/images/<same name>.png`

Local layout after download:

```
pipeline/data/raw/
├── temperature/{baseline,rcp26,rcp45,rcp85}/
├── precipitation/{baseline,rcp26,rcp45,rcp85}/
└── sea_level/        ukcp18_sea_level_ireland.json (downloaded by hand) + .csv (made by step 08)
```

## 3. Absolute vs anomaly

- **Used:** `ensmid_final` downloads (the `ensmean_final` `.nc` inside), which are **absolute** bias-corrected values (e.g. Cork annual baseline 9.811 °C).
- **Also available, not used:** `ensmid_chg` files with change from the 1976–2005 baseline (°C for temperature, **% for precipitation**). Same naming with `chg` in place of `final`. These could replace the in-app calculation later.
- Baseline period is **1976–2005** (the last 30 years of the CMIP5 historical run).
- Each period is a 30-year "representative year" (day-of-year average across the period and models), not a time series.

## 4. County aggregation notes

**Findings from building the pipeline (CCD-25, 28 Oct 2026):**

- **Grid size:** the grid is 451 × 351 cells of about **1 km** (≈1.01 × 1.05 km), not 1.5 km as first noted. The temperature files have 77,226 land cells (≈81,000 km²), which is the whole island, Northern Ireland included.
- **Rainfall land mask:** the rainfall baseline is a different product ("Seamus Gridded Rainfall", float64). Its land mask is wider: 100,041 cells, including a strip of 22,958 sea cells along the coast, and 143 temperature land cells have no rainfall value.
  - **Fix:** the pipeline uses the **temperature** land cells for all 70 files and reads each file's values **by row and column**, not by lat/lon. The lat/lon values differ very slightly between files (up to 0.000002°), so matching on them fails. This way temperature and rainfall are averaged over exactly the same land, and the sea strip is ignored.
- **CSO boundary file (no longer used):** `ie_county_26.json` declares **no** coordinate system, so GeoPandas assumes lat/lon, but its numbers are really **EPSG:29903 (Irish Grid)**. Testing EPSG:2157 put Ireland in the wrong place; EPSG:29903 lined up (pipeline step 06). It's also coarse: 2,183 points, with gaps of up to about 4 km along the coast, so some coastal cells showed up out at sea.
- **County boundaries now used:** Tailte Éireann, *Counties – National Statutory Boundaries – 2019 – Generalised 20m* (CC BY 4.0). It has the same 26 counties and is already in lat/lon (EPSG:4326); the names are in the `ENGLISH` column, in capitals. It matches **63,611** land cells to a county, compared with 63,356 for the CSO file (pipeline step 06b).
- **Coverage:** the result is **26 counties**. Northern Ireland cells don't fall inside any county and are dropped.
- **Method:** land cells become points, then `gpd.sjoin()` to the counties, then a plain mean per county. A cell exactly on a border keeps its first match only. Script: `pipeline/process_climate_data.py`.
- **Output:** 26 counties × 2 variables × 5 seasons × 7 scenario/period combinations (1 baseline + 3 RCPs × 2 periods) = **1,820 rows** in `climate_data.csv` (910 temperature + 910 precipitation). Confirmed by running the pipeline.
- **Limitation:** a small number of coastal land cells fall just outside the county outlines and aren't counted.

## 5. Sea level rise — UKCP18 (separate source)

Climate Ireland has no downloadable sea level data. Its coastal flooding page shows RCP2.6 and RCP8.5 maps as images only. The dashboard uses the **Met Office UKCP18 time-mean sea level projections**. Its coastal grid covers the whole island of Ireland and it uses the **same RCP scenarios** as the temperature and rainfall data. This replaces the earlier IPCC AR6 midpoint values, which used SSPs and had no sourced "medium" scenario.

> **Decision (27 Oct 2026, Eoin Ryan, story owner):** IPCC AR6 is **no longer used** for sea level, and UKCP18 replaces it. The AR6 Synthesis Report gives global figures on SSP scenarios, which can't be shown as national projections for Ireland and don't match the RCPs used elsewhere. The old Low/Medium/High midpoint table is retired. This is recorded on Jira CCD-7, CCD-16 and CCD-19.

| | |
|---|---|
| **Dataset** | UKCP18 Time-mean Sea Level Projections to 2100 (cm) |
| **Publisher / licence** | Met Office, Open Government Licence v3.0 |
| **Access** | ArcGIS feature service: `https://services.arcgis.com/Lq3V5RFuTBC9I7kv/ArcGIS/rest/services/Sea_Level_2010_2100/FeatureServer/1` (also exportable as CSV, GeoJSON or Shapefile via the [Open Net Zero listing](https://opennetzero.org/met-office/time-mean-sea-level-projections-to-2100-cm)) |
| **Scenarios** | RCP2.6, RCP4.5, RCP8.5. No separate baseline; the baseline is 0 by definition. |
| **Percentiles** | 5th, 50th, 95th, in the field `rcp_percentile` (e.g. `rcp45_50`) |
| **Years** | Single decadal years 2010–2100, fields `seaLevelAnom_2010` … `seaLevelAnom_2100` |
| **Units** | cm, relative sea level change (includes vertical land movement) |
| **Baseline** | **1981–2000** (differs from the 1976–2005 baseline used for temperature and rainfall) |
| **Grid** | ~12 km cells along the coast only: 212 sea points around Ireland. `X`/`Y` fields hold the cell centre lon/lat |
| **Coordinates** | The file header says `spatialReference` 27700 (British National Grid, metres), but that only applies to the shapes, which our download doesn't include. **`X` and `Y` are lat/lon (EPSG:4326)**: X −10.58 to −4.92, Y 51.39 to 55.83 (pipeline step 07). |
| **Download** | Downloaded by hand as JSON (1,908 rows = 212 points × 3 RCPs × 3 percentiles), saved as `pipeline/data/raw/sea_level/ukcp18_sea_level_ireland.json`, and turned into a CSV by pipeline step 08. |
| **Date checked** | 27 October 2026. Irish coverage was confirmed by querying cells near Cork, Dublin and Galway. |

**Processing rules**

- **Percentile:** use the **50th percentile only** (`rcp26_50`, `rcp45_50`, `rcp85_50`). This matches using the ensemble central value for temperature and rainfall. The 5th and 95th rows stay in the raw data for a possible uncertainty band later.
- **Time slots:** keep **every decade, 2020–2100** (9 values), not period averages. Sea level is shown as a rise over time, so it has its own output file and table instead of sharing the temperature/rainfall periods. 2010 is left out because it's before the dashboard's first period.
- **Counties:** each sea point goes to its **nearest** county within **15 km** (measured in EPSG:2157, metres). Points off Northern Ireland, Scotland and Wales are too far and are dropped. A county's value for each decade is the average of its points. This gives **13 coastal counties**.
- **Leitrim and Limerick:** both have coastline but no sea point of their own. Leitrim's 4 km of coast is on Donegal Bay, so it uses **Sligo's** values; Limerick's only coast is the Shannon Estuary, so it uses **Clare's**. These are estimates and are marked in the `source` column (`UKCP18, estimated from Sligo` / `UKCP18, estimated from Clare`). That makes **15 coastal counties** in total.
- **Inland counties:** no value. Store no row and show "No coastline" on the dashboard; never show 0.
- **Baseline:** no row. The values are a rise since the 1981–2000 average, so the baseline is 0 cm in about 1990.
- **Labelling:** cite as UKCP18 / Met Office, not Climate Ireland, and show cm with the 1981–2000 baseline.

**Spot check: 50th percentile, cm, single year**

| Coast cell near | RCP2.6 2050 | RCP4.5 2050 | RCP8.5 2050 | RCP2.6 2100 | RCP4.5 2100 | RCP8.5 2100 |
|---|---|---|---|---|---|---|
| Cork | 22 | 23 | 28 | 41 | 51 | 73 |
| Dublin | 18 | 19 | 23 | 33 | 43 | 65 |
| Galway | 20 | 21 | 25 | 37 | 46 | 68 |

**Output:** a separate file, `sea_level.csv`, with columns `county, scenario, year, rise_cm, source`. 15 coastal counties × 3 RCPs × 9 decades = **405 rows** (confirmed by running the pipeline). Example: `Sligo, rcp85, 2100, 67.371, UKCP18`. The database table `SeaLevelProjection` changes to match: county FK, `year` as an integer, `rise_cm` and `source` (agreed with Artur, CCD-33).

## 6. Not used (available on the site)

- Maximum and minimum temperature (`tmax`, `tmin`): same structure, °C.
- Period 2041–2070, for all variables.
- Change files (`ensmid_chg`), see §3.
- Global warming level datasets (1.5–4.0 °C) and the non-standardised 2041–2060 indices (snowfall, driving rain, etc.).

Adding 2041–2070 would make 10 scenario/period combinations and 2,600 CSV rows. The earlier planning notes assumed 10 combinations, but only 2021–2050 and 2071–2100 were downloaded.

## 7. Implications for the pipeline

1. The URL template means downloads can be scripted with no scraping.
2. Read the `ensmean_final` `.nc` inside each zip with Xarray. Variables are `tmean` and `tot_prec`.
3. Use the Tailte Éireann county file. If the CSO file is ever used again, override its CRS to EPSG:29903 before reprojecting.
4. Use one land mask (temperature) for every file and match cells by row and column, not lat/lon (see §4).
5. Store units per variable: °C for temperature, mm for precipitation, cm for sea level.
6. Re-run this review if Climate Ireland moves to CMIP6/SSPs. TRANSLATE-3 is in progress and says it will add them.

## 8. Definition of Done — CCD-17 / CCD-19

- [x] Climate Ireland Data Explorer opened and all CMIP5 temperature and precipitation datasets listed
- [x] Variable, scenarios, periods, seasons, units, grid resolution and download format recorded for each dataset used
- [x] Absolute vs anomaly documented (absolute used; `chg` files available; baseline 1976–2005)
- [x] Units and NetCDF variable names verified against downloaded files (Xarray)
- [x] Page URL and date checked recorded
- [x] Each dashboard value mapped to its source dataset and CSV row
- [x] Sea level source reviewed; UKCP18 chosen to match the RCP scenarios
- [ ] `docs/data-review.md` committed to the repo
- [ ] Linked on Jira CCD-17 and CCD-19
- [x] Sea level source decided by story owner: UKCP18 replaces IPCC AR6 (CCD-19; Jira CCD-7, CCD-16, CCD-19 updated)
- [ ] Reviewed by one teammate
- [ ] CCD-17 and CCD-19 moved to Done

## Sources

- [Climate Ireland — Data Explorer](https://www.climateireland.ie/data-explorer/)
- [Climate Ireland — About the Climate Models](https://www.climateireland.ie/data-explorer/about-the-climate-models/)
- [Climate Ireland — FAQs](https://www.climateireland.ie/data-explorer/faqs/) (resolution, CRS, formats, baseline, ensemble)
- [Climate Ireland — Data dictionary](https://www.climateireland.ie/data-explorer/data-dictionary/)
- [CSO county boundaries — ie_county_26.json](https://cdn.cso.ie/static/map/en/ie_county_26.json) (no longer used)
- County boundaries: © Tailte Éireann, Counties – National Statutory Boundaries – 2019 – Generalised 20m, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- O'Brien, E. & Nolan, P. (2023). [TRANSLATE: standardized climate projections for Ireland](https://doi.org/10.3389/fclim.2023.1166828). *Frontiers in Climate* 5.
- Met Office. [UKCP18 Time-mean Sea Level Projections to 2100](https://opennetzero.org/met-office/time-mean-sea-level-projections-to-2100-cm) ([feature service](https://services.arcgis.com/Lq3V5RFuTBC9I7kv/ArcGIS/rest/services/Sea_Level_2010_2100/FeatureServer)). Open Government Licence v3.0.
- [EPA Climate Ireland — Coastal flooding](https://www.epa.ie/our-services/monitoring--assessment/climate-change/climate-ireland/impact-of-climate-change-on-ireland/climate-hazards/coastal-flooding/) (confirms no downloadable Irish sea level dataset)