# County rules (CCD-31)

How climate grid cells are turned into county values. Script: `pipeline/process_climate_data.py`.

## Counties

- **26 counties**, Republic of Ireland only. Northern Ireland is not included.
- **Dublin is one county.** The boundary file has a single Dublin, so we don't split it into Dublin City, Fingal, South Dublin and Dún Laoghaire–Rathdown. Climate Ireland's grid is about 1 km, so splitting Dublin wouldn't add useful detail.
- **Names** come from the `ENGLISH` column, changed from capitals to title case (`CORK` → `Cork`).

## Boundary file

- **Used:** Tailte Éireann, *Counties – National Statutory Boundaries – 2019 – Generalised 20m*, CC BY 4.0. Credit: © Tailte Éireann.
- **Not used:** CSO `ie_county_26.json`. It is coarser and declares no coordinate system (it is really EPSG:29903). See `docs/data-review.md` §4.

## Coordinate system

| Dataset | CRS |
|---|---|
| Climate grid (Climate Ireland) | EPSG:4326 (lat/lon) |
| Tailte Éireann boundaries | EPSG:4326 (lat/lon) |
| UKCP18 sea level points | `X`/`Y` are lat/lon (EPSG:4326) |

**Common CRS for the join: EPSG:4326.** Both the grid and the boundaries already use it, so no reprojection is needed.
For sea level only, distances are measured in **EPSG:2157** (Irish Transverse Mercator, metres) so the 15 km limit is in metres.

## Matching grid cells to counties

- Each land cell's centre becomes a point and is joined to the county polygons (`gpd.sjoin`, `predicate="intersects"`).
- **Land cells** come from the temperature baseline file and are used for all 70 files, matched by row and column (see data-review §4).
- **Cells on a border** that touch two counties keep their **first** match only, so every cell counts once.
- **Cells in no county** (Northern Ireland, and a few coastal cells just outside the outlines) are left out. Of 77,226 land cells, **63,611** are matched to a county.

## County value

- **Simple mean** of the matched cells in each county. Not area-weighted: all cells are almost the same size (about 1.01 × 1.05 km), so weighting would barely change the result.
- **Change from baseline** isn't stored; the app calculates it (see data-review §3).

## Sea level

- Each UKCP18 sea point goes to its **nearest** county within **15 km**. The county value is the mean of its points.
- **Leitrim** uses Sligo's values and **Limerick** uses Clare's (an estimate, marked in the `source` column).
- **Inland counties** have no sea level rows.