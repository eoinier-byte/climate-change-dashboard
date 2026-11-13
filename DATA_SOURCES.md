# Data Sources (CCD-22)

Every number on the dashboard traces back to one of the sources below. Column-level details are in [docs/variables.md](docs/variables.md), and the full dataset review is in [docs/data-review.md](docs/data-review.md).

Last updated: 10 November 2026 · Owner: Eoin Ryan

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

> Climate projections: Met Éireann TRANSLATE via EPA Climate Ireland (O'Brien & Nolan, 2023). Sea level: contains Met Office UKCP18 data licensed under the Open Government Licence v3.0. County boundaries: © Tailte Éireann, Counties – National Statutory Boundaries – 2019 – Generalised 20m, licensed under CC BY 4.0. Elevation data (flood layers): produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved. Northern Ireland outline (flood layers): © Ordnance Survey of Northern Ireland, OSNI Open Data – Largescale Boundaries – NI Outline, released under the Open Government Licence v3.0.

## 5. Considered and not used

| Source | Reason |
|---|---|
| IPCC AR6 Synthesis Report (sea level) | Global figures only, on SSP scenarios that don't match the RCPs used elsewhere. Replaced by UKCP18 on 27 Oct 2026 (Jira CCD-19). |
| EPA Research 471, Updated High-resolution Climate Projections for Ireland (2025) | Newer CMIP6/SSP projections. The Climate Ireland Data Explorer still serves the CMIP5/RCP TRANSLATE data, so we use that for consistency. Revisit when TRANSLATE moves to CMIP6. |
| EPA Climate Ireland coastal flooding maps | Images only, no downloadable data, and no RCP4.5 |
| Climate Ireland max/min temperature, 2041–2070, global warming levels | Available but out of scope for the current dashboard |

## 6. Copernicus DEM (flood engine, CCD-396)

> **Agreed by the team at stand-up on <DATE>.** Proposed by Artur Romanov on 9 November 2026 for the flood engine (CCD-395). Format details: [docs/flood-engine.md](docs/flood-engine.md). Download details: §7.

| | |
|---|---|
| **Organisation** | European Space Agency (ESA), Copernicus Contributing Missions; data © DLR e.V. and Airbus Defence and Space GmbH |
| **Dataset** | Copernicus DEM, GLO-90 (3 arc-seconds, ~90 m) or GLO-30 (1 arc-second, ~30 m). Digital Surface Model (includes buildings and vegetation) |
| **Used for** | Elevation grid for the flood engine (land below a given sea level) |
| **URL** | https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM (official source; we download the identical GLO-90 tiles from the public AWS copy instead, which needs no account, see §7) |
| **Date accessed** | 9 November 2026 (licence read); tiles downloaded 10 November 2026, see §7 |
| **Format** | GeoTIFF, 32-bit float, 1° × 1° tiles. WGS84 (EPSG:4326), heights in metres above EGM2008 (EPSG:3855) |
| **Licence / reuse terms** | **ESA Copernicus Contributing Mission Data Access Licence** (issue 21/02/2025, linked from the page above). General-public users: **non-commercial use only** (cl. 3.4.3), no reselling (cl. 3.4.4). Raw or resampled DEM may only be shared with people who accepted the licence (cl. 3.8.1.9), so **do not commit the DEM** to the repo. Derived flood masks are "Value Added Products" (cl. 1.12.3) and may be published under our own terms (cl. 3.8.2). Not yet read: the DEM "Mission Specific Annex" linked from the page. |
| **Required citation** | DOI requested by ESA: https://doi.org/10.5270/ESA-c5d3d65 |
| **Why chosen** | Free, covers all of Ireland in one consistent dataset, documented accuracy (< 4 m absolute vertical, 90 %) |

**Credit for published flood layers (licence cl. 4.2.4, Value Added Products):** "produced using data © CCME (year of acquisition), provided under COPERNICUS by the European Union and ESA". The page gives a DEM-specific wording ("produced using Copernicus WorldDEM-90 …", naming DLR e.V. and Airbus Defence and Space GmbH); copy it exactly from the page before using it.

## 7. Copernicus GLO-90 DEM download (CCD-420)

| | |
|---|---|
| **Source** | Copernicus DEM GLO-90, public AWS bucket (no account needed): https://copernicus-dem-90m.s3.amazonaws.com/ |
| **Date accessed** | 10 November 2026 (27 tiles, lat 51–55 N, lon 11–6 W; N51 W007, N55 W011 and N55 W010 are all sea and do not exist) |
| **How to get it** | `scripts/fetch_dem.sh [output_dir]` (default `data/dem/glo90`), then `gdalbuildvrt data/dem/glo90/ireland_glo90.vrt data/dem/glo90/Copernicus_DSM_COG_30_*_DEM.tif`. `data/dem/` is git-ignored: never commit the tiles (licence, see §6). |
| **What gdalinfo shows** | WGS84 (EPSG:4326), Float32, one band, pixel 0.00125° × 0.000833° (4.5″ × 3″ at this latitude), no nodata value set, no vertical datum in the metadata |
| **Vertical datum** | EGM2008 geoid (EPSG:3855), heights in metres, same as §6. Stated in the official Copernicus DEM collection description (https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM, checked 10 November 2026). The AWS copy is made from the official GLO-90 DGED tiles (bucket readme), and its maintainers confirm it keeps EGM2008 (https://forum.sentinel-hub.com/t/copernicus-dem-data-available-on-aws/3027). The GeoTIFF metadata does not record the datum, so code must assume it explicitly. |
| **Required attribution** | "produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved" |

Limitations:

- **Surface model, not terrain.** Heights include buildings and vegetation, so towns and forests look higher than the ground.
- **EGM2008 height 0 is not exactly local mean sea level.** The offset from Irish mean sea level along the coast has not been measured yet. UKCP18 (§2) gives sea-level *change* relative to a baseline, not heights on a datum, so the flood engine must state which present-day sea level it adds that change to.

## 8. Land polygon (flood sea mask, CCD-420)

> Chosen by Artur Romanov on 12 November 2026 (Option 1 of CCD-420; decision D3 in [docs/flood-engine.md](docs/flood-engine.md)). Built by `pipeline/build_land_polygon.py`.

| | |
|---|---|
| **Output** | `pipeline/data/boundaries/ireland_land.gpkg` (layer `land`, EPSG:2157, 9.2 MB, committed). Everything outside it is sea for the flood engine; lakes inside it stay land |
| **Inputs** | (1) Republic of Ireland: the Tailte Éireann county file from §3, `pipeline/data/boundaries/counties_tailte_eireann_2019.geojson`. (2) Northern Ireland: **OSNI Open Data – Largescale Boundaries – NI Outline**, Ordnance Survey of Northern Ireland (Land & Property Services) |
| **URL (NI outline)** | https://www.opendatani.gov.uk/dataset/osni-open-data-largescale-boundaries-ni-outline (shapefile ZIP resource) |
| **Date accessed** | 12 November 2026 (page checked and ZIP downloaded; files inside the ZIP are dated 26 September 2024) |
| **Format (NI outline)** | Shapefile in a ZIP, one MultiPolygon, TM65 / Irish Grid (EPSG:29902). The geometry is not valid as published; the build script repairs it (`make_valid`) |
| **How to rebuild** | Download the shapefile ZIP **in a browser** (the site returns 403 to scripts) to `pipeline/data/raw/ni_outline/` (git-ignored), then from the repo root: `python pipeline/build_land_polygon.py --part pipeline/data/boundaries/counties_tailte_eireann_2019.geojson --part pipeline/data/raw/ni_outline/osni_open_data_largescale_boundaries_ni_outline.zip --out pipeline/data/boundaries/ireland_land.gpkg` |
| **Licence / reuse terms** | ROI part: **CC BY 4.0** (§3). NI part: **Open Government Licence v3.0**. The dataset page says "UK Open Government Licence (OGL)"; the metadata file inside the ZIP says "Made and published by Ordnance Survey of Northern Ireland® and released under the Open Government Licence v3.0". Both allow redistribution with credit, so the combined file is committed |
| **Required attribution** | ROI: as §3. NI: "© Ordnance Survey of Northern Ireland" (credit field of the official SpatialNI ArcGIS item for this dataset). UNVERIFIED: OSNI's data.gov.uk pages ask for a longer statement beginning "Contains LPS Intellectual Property © Crown copyright and database right (year)"; its full wording has not been copied from the page yet |
| **Why chosen** | The ROI coastline is the same one the flood script uses to count cells per county, so ROI coastal cells are not lost between two different coastlines. Official sources on both sides of the border. Considered and not used: OpenStreetMap land polygons (https://osmdata.openstreetmap.de/data/land-polygons.html, ODbL): seamless but a different coastline from the county file and a large global download; Natural Earth: too coarse for a 90 m grid |

Limitations:

- **Two surveys meet at the border.** ROI (generalised 20 m) and NI (OSNI Largescale) outlines do not match exactly. The script closes gaps narrower than about 200 m (buffer +100 m then −100 m), only where the two outlines are within 100 m of each other, so no inland sliver becomes "sea" and coastal inlets elsewhere stay sea.
- **Estuaries inside county boundaries count as land.** The statutory county boundaries run across the inner parts of some estuaries (seen in the CCD-420 check images: the Shannon and Fergus estuaries, upper Cork Harbour), so that water is "land" in this polygon. The DEM gives water about 0 m, so these areas show as flooded already at 0.0 m: in the CCD-420 run, 184 km² in Clare, 58 km² in Limerick and 56 km² in Kerry at 0.0 m are mostly estuary water, not land. Proposed for Sprint 3 (not done): treat those areas as sea, or show flooding relative to the 0.0 m layer.
- **Generalised ROI coastline.** The ROI part is generalised to 20 m, finer than the 90 m flood grid.
- **Conflicting OSNI licence statement.** NISRA's Crown copyright page (https://www.nisra.gov.uk/crown-copyright) says OSNI-branded mapping is exempt from the OGL. The dataset itself is marked OGL v3.0 by OSNI, which we follow; UNVERIFIED with LPS.
