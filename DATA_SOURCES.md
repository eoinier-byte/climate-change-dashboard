# Data Sources (CCD-22)

Every number on the dashboard traces back to one of the sources below. Column-level details are in [docs/variables.md](docs/variables.md), and the full dataset review is in [docs/data-review.md](docs/data-review.md).

Last updated: 27 October 2026 · Owner: Eoin Ryan

---

## 1. Climate Ireland — TRANSLATE climate projections

| | |
|---|---|
| **Organisation** | Environmental Protection Agency (Climate Ireland portal); data produced by Met Éireann's TRANSLATE project with ICHEC (University of Galway) and MaREI (UCC) |
| **Dataset** | TRANSLATE standardised, bias-corrected CMIP5 climate projections: mean temperature (`tmean`) and total precipitation (`tot_prec`) |
| **Used for** | `temperature`, `precipitation` |
| **URL** | https://www.climateireland.ie/data-explorer/ (files served from `https://www.climateservices.ie/TRANSLATE/`) |
| **Date accessed** | 27 October 2026 |
| **Format** | `.zip` containing NetCDF (`.nc`); 1.5 km grid, EPSG:4326 |
| **Licence / reuse terms** | **Licence name not stated.** The Climate Ireland FAQ says all data in the projection map viewers and the TRANSLATE data is freely available to use, and the disclaimer says TRANSLATE data is published "as is". See the [FAQs](https://www.climateireland.ie/data-explorer/faqs/) and [About the Climate Models](https://www.climateireland.ie/data-explorer/about-the-climate-models/). |
| **Required citation** | O'Brien, E. and Nolan, P. (2023). TRANSLATE: standardized climate projections for Ireland. *Frontiers in Climate*, 5, 1166828. https://doi.org/10.3389/fclim.2023.1166828 |
| **Why chosen** | Ireland's official standardised national projections, bias-corrected, at high resolution, covering the baseline plus RCP2.6/4.5/8.5 for every season |

**Footer attribution:** Climate projections: Met Éireann TRANSLATE via EPA Climate Ireland (O'Brien & Nolan, 2023).

## 2. Met Office — UKCP18 sea level projections

| | |
|---|---|
| **Organisation** | Met Office (UK) |
| **Dataset** | UKCP18 Time-mean Sea Level Projections to 2100 (cm), 50th percentile rows |
| **Used for** | `sea_level` |
| **URL** | https://opennetzero.org/met-office/time-mean-sea-level-projections-to-2100-cm · feature service: https://services.arcgis.com/Lq3V5RFuTBC9I7kv/ArcGIS/rest/services/Sea_Level_2010_2100/FeatureServer |
| **Date accessed** | 27 October 2026 |
| **Format** | ArcGIS feature service; exportable as CSV, GeoJSON or Shapefile. About 12 km coastal cells, WGS84 |
| **Licence / reuse terms** | **Open Government Licence v3.0.** The service states the data is licensed under OGL v3.0 (https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). |
| **Why chosen** | Covers the Irish coast with location-specific values on the same RCP2.6/4.5/8.5 scenarios as the climate data. Replaced IPCC AR6 (see §5). |

**Footer attribution:** Contains Met Office data licensed under the Open Government Licence v3.0.

## 3. Tailte Éireann — County boundaries

| | |
|---|---|
| **Organisation** | Tailte Éireann (formerly Ordnance Survey Ireland) |
| **Dataset** | Counties – National Statutory Boundaries – 2019 – Generalised 20m, saved as `pipeline/data/boundaries/counties_tailte_eireann_2019.geojson` |
| **Used for** | `county`, and the spatial join of grid cells and sea points to counties |
| **URL** | https://data.gov.ie/dataset/counties-national-statutory-boundaries-2019-generalised-20m1 |
| **Date accessed** | 28 October 2026 |
| **Format** | GeoJSON, EPSG:4326 (lat/lon). 26 counties; names in the `ENGLISH` column, in capitals |
| **Licence / reuse terms** | **CC BY 4.0**. Credit Tailte Éireann |
| **Why chosen** | Official statutory boundaries with a more detailed coastline than the CSO file: matches 63,611 climate land cells to a county, against 63,356 for the CSO file (pipeline step 06) |

**Footer attribution:** County boundaries: © Tailte Éireann, Counties – National Statutory Boundaries – 2019 – Generalised 20m, licensed under CC BY 4.0.

**Replaced:** CSO `ie_county_26.json` (https://cdn.cso.ie/static/map/en/ie_county_26.json), used until 28 October 2026. It declares no coordinate system (it is really EPSG:29903, Irish Grid) and has a coarser coastline. It is kept in the repo only for pipeline steps 05–06.

## 4. Footer text (combined)

> Climate projections: Met Éireann TRANSLATE via EPA Climate Ireland (O'Brien & Nolan, 2023). Sea level: contains Met Office UKCP18 data licensed under the Open Government Licence v3.0. County boundaries: © Tailte Éireann, Counties – National Statutory Boundaries – 2019 – Generalised 20m, licensed under CC BY 4.0.

## 5. Considered and not used

| Source | Reason |
|---|---|
| IPCC AR6 Synthesis Report (sea level) | Global figures only, on SSP scenarios that don't match the RCPs used elsewhere. Replaced by UKCP18 on 27 Oct 2026 (Jira CCD-19). |
| EPA Research 471, Updated High-resolution Climate Projections for Ireland (2025) | Newer CMIP6/SSP projections. The Climate Ireland Data Explorer still serves the CMIP5/RCP TRANSLATE data, so we use that for consistency. Revisit when TRANSLATE moves to CMIP6. |
| EPA Climate Ireland coastal flooding maps | Images only, no downloadable data, and no RCP4.5 |
| Climate Ireland max/min temperature, 2041–2070, global warming levels | Available but out of scope for the current dashboard |