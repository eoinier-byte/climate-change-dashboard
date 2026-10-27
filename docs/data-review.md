# Climate Dataset Review (CCD-17, CCD-19)

| | |
|---|---|
| **Source page** | https://www.climateireland.ie/data-explorer/ (tab: *Climate Change Choices → CMIP5 → Scenarios*) |
| **Supporting pages** | [About the Climate Models](https://www.climateireland.ie/data-explorer/about-the-climate-models/) · [FAQs](https://www.climateireland.ie/data-explorer/faqs/) · [Data dictionary](https://www.climateireland.ie/data-explorer/data-dictionary/) |
| **Date checked** | 27 October 2026 |
| **Checked by** | Eoin Ryan (PO / climate data owner) |
| **Underlying data** | Met Éireann **TRANSLATE** standardised, bias-corrected projections (O'Brien & Nolan, 2023). CMIP5 GCMs downscaled by regional climate models. |

This page records which Climate Ireland datasets feed the dashboard, what the files contain, and how they map to `climate_data.csv`. It combines a live check of the Data Explorer with the earlier hands-on inspection of the downloaded NetCDF files (Xarray).

---

## 1. Datasets used by the dashboard

The dashboard uses **two variables**, **four scenarios** and **two future periods**.

| Variable | File prefix | NetCDF variable | Scenarios | Periods | Seasons | Units | Absolute or anomaly | Grid | Download format | Files |
|---|---|---|---|---|---|---|---|---|---|---|
| Mean temperature | `tmean` | `tmean` | Baseline, RCP2.6, RCP4.5, RCP8.5 | Baseline 1976–2005; 2021–2050; 2071–2100 | Annual, Winter (DJF), Spring (MAM), Summer (JJA), Autumn (SON) | °C | **Absolute** | 1.5 km × 1.5 km, EPSG:4326 (lat/lon) | `.zip` containing NetCDF-4 (`.nc`). The zip is named `…ensmid_final…` but the file inside is `…ensmean_final….nc` | 5 baseline + 30 future = **35** |
| Precipitation (total) | `tot_prec` | `tot_prec` | same | same | same | mm (total for the season or year) | **Absolute** | same | same | **35** |

**Total: 70 files.** Units and variable names were confirmed with Xarray on the downloaded files. The future files hold absolute climatological values, not anomalies.

### Where each dashboard value comes from

| Dashboard value | Dataset | `climate_data.csv` row |
|---|---|---|
| County temperature, present day | `tmean_CMIP5_baseline_1976-2005_{season}` | `temperature, baseline, 1976-2005, {Season}` |
| County temperature, future | `tmean_CMIP5_{rcp}_{period}_ensmid_final_{season}` | `temperature, {rcp}, {period}, {Season}` |
| County rainfall, present day | `tot_prec_CMIP5_baseline_1976-2005_{season}` | `precipitation, baseline, 1976-2005, {Season}` |
| County rainfall, future | `tot_prec_CMIP5_{rcp}_{period}_ensmid_final_{season}` | `precipitation, {rcp}, {period}, {Season}` |
| Temperature / rainfall change | Not a separate dataset; computed in the app as future − baseline | Rainfall change should be shown as % of baseline to match Climate Ireland |
| Sea level rise (coastal counties) | **Not Climate Ireland.** UKCP18 time-mean sea level, `rcp*_50` rows | `sea_level, {rcp}, {period}, Annual` in cm; see §5 |

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
data/raw/
├── temperature/{baseline,rcp26,rcp45,rcp85}/
├── precipitation/{baseline,rcp26,rcp45,rcp85}/
└── sea_level/        (UKCP18 export, CSV or GeoJSON)
```

## 3. Absolute vs anomaly

- **Used:** `ensmid_final` files, which are **absolute** bias-corrected values (e.g. Cork annual baseline 9.811 °C).
- **Also available, not used:** `ensmid_chg` files with change from the 1976–2005 baseline (°C for temperature, **% for precipitation**). Same naming with `chg` in place of `final`. These could replace the in-app calculation later.
- Baseline period is **1976–2005** (the last 30 years of the CMIP5 historical run).
- Each period is a 30-year "representative year" (day-of-year average across the period and models), not a time series.

## 4. County aggregation notes

- **County boundaries:** CSO `ie_county_26.json` (https://cdn.cso.ie/static/map/en/ie_county_26.json).
- **CRS gotcha:** the file declares EPSG:4326 but its coordinates are **EPSG:29903 (Irish Grid)**. Testing EPSG:2157 put Ireland near France; EPSG:29903 lined up. The fix is `set_crs("EPSG:29903", allow_override=True)` then `to_crs("EPSG:4326")`. Before the fix the spatial join returned 0 matches; after it, 982 on the test sample.
- **Coverage:** Climate Ireland data covers the Republic only, and Northern Ireland is dropped from the boundary file. The result is **26 counties**.
- **Method:** grid cells become points, then `gpd.sjoin()` to counties, then `groupby("AREA_NAME").mean()`. Script: `process_climate_data.py`.
- **Expected output size:** 26 counties × 2 variables × 5 seasons × 7 scenario/period combinations (1 baseline + 3 RCPs × 2 periods) = **1,820 rows** in `climate_data.csv`.

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
| **Grid** | ~12 km WGS84 cells along the coast only; `X`/`Y` fields hold the cell centre lon/lat |
| **Date checked** | 27 October 2026. Irish coverage was confirmed by querying cells near Cork, Dublin and Galway. |

**Processing rules**

- **Percentile:** use the **50th percentile only** (`rcp26_50`, `rcp45_50`, `rcp85_50`). This matches using the ensemble central value for temperature and rainfall. The 5th and 95th rows stay in the raw data for a possible uncertainty band later.
- **Time slots:** average the decadal years inside each period.
  - 2021–2050 = mean of `seaLevelAnom_2030`, `_2040`, `_2050`
  - 2071–2100 = mean of `seaLevelAnom_2080`, `_2090`, `_2100`
- **Counties:** assign each coastal cell to the nearest coastal county, then average per county. This happens later in the processing step.
- **Inland counties:** no value. Store no row and show "No coastline" on the dashboard; never show 0.
- **Labelling:** cite as UKCP18 / Met Office, not Climate Ireland, and show cm with the 1981–2000 baseline.

**Spot check: 50th percentile, cm, single year**

| Coast cell near | RCP2.6 2050 | RCP4.5 2050 | RCP8.5 2050 | RCP2.6 2100 | RCP4.5 2100 | RCP8.5 2100 |
|---|---|---|---|---|---|---|
| Cork | 22 | 23 | 28 | 41 | 51 | 73 |
| Dublin | 18 | 19 | 23 | 33 | 43 | 65 |
| Galway | 20 | 21 | 25 | 37 | 46 | 68 |

**CSV rows:** `county, sea_level, {rcp}, {period}, Annual, {value_cm}` for coastal counties only. That adds at most 15 coastal counties × 3 RCPs × 2 periods = 90 rows (see variables.md).

## 6. Not used (available on the site)

- Maximum and minimum temperature (`tmax`, `tmin`): same structure, °C.
- Period 2041–2070, for all variables.
- Change files (`ensmid_chg`), see §3.
- Global warming level datasets (1.5–4.0 °C) and the non-standardised 2041–2060 indices (snowfall, driving rain, etc.).

Adding 2041–2070 would make 10 scenario/period combinations and 2,600 CSV rows. The earlier planning notes assumed 10 combinations, but only 2021–2050 and 2071–2100 were downloaded.

## 7. Implications for the pipeline

1. The URL template means downloads can be scripted with no scraping.
2. Read the `ensmean` `.nc` inside each zip with Xarray. Variables are `tmean` and `tot_prec`.
3. Always override the county file CRS to EPSG:29903 before reprojecting.
4. Store units per variable: °C for temperature, mm for precipitation.
5. Re-run this review if Climate Ireland moves to CMIP6/SSPs. TRANSLATE-3 is in progress and says it will add them.

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
- [CSO county boundaries — ie_county_26.json](https://cdn.cso.ie/static/map/en/ie_county_26.json)
- O'Brien, E. & Nolan, P. (2023). [TRANSLATE: standardized climate projections for Ireland](https://doi.org/10.3389/fclim.2023.1166828). *Frontiers in Climate* 5.
- Met Office. [UKCP18 Time-mean Sea Level Projections to 2100](https://opennetzero.org/met-office/time-mean-sea-level-projections-to-2100-cm) ([feature service](https://services.arcgis.com/Lq3V5RFuTBC9I7kv/ArcGIS/rest/services/Sea_Level_2010_2100/FeatureServer)). Open Government Licence v3.0.
- [EPA Climate Ireland — Coastal flooding](https://www.epa.ie/our-services/monitoring--assessment/climate-change/climate-ireland/impact-of-climate-change-on-ireland/climate-hazards/coastal-flooding/) (confirms no downloadable Irish sea level dataset)
