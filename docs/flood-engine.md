# Flood engine: input and output format (CCD-396)

· Owner: Artur Romanov · Parent story: CCD-395 · Last updated: 8 November 2026

This document is the contract between four parts of the project:

| Part | Ticket | Role |
|---|---|---|
| C++ flood engine (`flood_engine/`) | CCD-395 | Computes which land cells flood for one sea level |
| Python binding (pybind11) | CCD-419 | Calls the engine from Python |
| Precompute script | CCD-420 | Prepares the elevation grid and sea mask per county, calls the engine for every sea level, saves the flood layers |
| Django endpoint | CCD-360 | Serves the saved flood layers to the frontend |

All three must use the format below. If a change is needed, change this file first.

---

## 1. Purpose

Given an elevation grid, a sea mask and a sea level in metres, the engine returns which **land** cells are flooded
and the flooded area in km².

The model is a simplified "bathtub" model with a connectivity check. It ignores tides, storm surges, waves,
rivers, rainfall and flood defences (see §7).

The engine does not know where the data came from. It does not read files, reproject data or know about counties.
That is the job of the precompute script (CCD-420).

---

## 2. Units and conventions

| Quantity | Unit | Notes |
|---|---|---|
| Elevation | metres (m) | Height above the vertical datum of the source data |
| Sea level | metres (m) | Same vertical datum as the elevation |
| Cell size | metres (m) | Side length of one **square** cell |
| Flooded area | square kilometres (km²) | |

**Meaning of sea level.** `sea_level_m` is the still-water level in the vertical datum of the elevation data
(EGM2008 for the chosen source, §8). We treat the geoid as present-day mean sea level, so `sea_level_m` is the
**rise above today's mean sea level**: 0 m means today, no rise. No tide is added (see §7 and D5).

**Grid layout: row-major.** The grid is stored as one flat array. "Row-major" means the cells of row 0 come first
(left to right), then the cells of row 1, and so on. The cell at row `r`, column `c` is at index

```
index = r * width + c        (0 <= r < height, 0 <= c < width)
```

Row 0 is the **top** (northern) row and column 0 is the **left** (western) column, as in a GeoTIFF. The engine itself
does not use this orientation; it only matters so that the precompute script and the API read the output the same way.

**Coordinate system.** The engine assumes square cells measured in metres. The precompute script must therefore give
it a grid in a projected coordinate system. Proposed: **Irish Transverse Mercator (ITM), EPSG:2157**. A grid in
degrees (EPSG:4326) must **not** be passed in directly, because its cells are not square and not in metres.

---

## 3. Input

The engine takes one `FloodInput` value and one sea level.

| Field | C++ type | Unit | Meaning |
|---|---|---|---|
| `width` | `std::size_t` | cells | Number of columns |
| `height` | `std::size_t` | cells | Number of rows |
| `cell_size_m` | `double` | m | Side of one square cell. Must be finite and `> 0` |
| `nodata` | `float` | m | Value that marks a cell with no elevation data. Default `-9999.0` |
| `elevation_m` | `std::vector<float>` | m | `width * height` values, row-major |
| `is_sea` | `std::vector<std::uint8_t>` | – | `width * height` values, row-major. `1` = sea, `0` = land |
| `sea_level_m` (separate argument) | `double` | m | Sea level to test. Must be in `[0.0, 2.0]` |

Notes:

- **The sea is given explicitly.** The engine never guesses which cells are sea (for example "everything at 0 m").
  The precompute script decides it (decision D3). For sea cells, the elevation value is ignored.
- **Sea mask values.** Any non-zero `is_sea` value means sea; `0` means land.
- **No-data cells** are cells where `elevation_m[i] == nodata`. On land they are treated as **dry walls**: they never
  flood and water cannot pass through them. This is the safe choice: we never show flooding where we have no data.
- **No-data must be a finite float** (default `-9999.0f`). If the source data uses NaN for no-data, the precompute
  script must convert it to `nodata` before calling the engine. Otherwise the engine rejects the grid with
  `NonFiniteElevation`, because NaN never compares equal to anything, including `nodata`.
- **A grid with no sea cells is valid input.** The result has 0 flooded cells. It is not an error.
- **Computing the levels.** The precompute script computes each level as `k / 10.0` for `k = 0..20`, never by adding
  `0.1` repeatedly. Repeated addition drifts (0.1 has no exact binary representation), and the drift could flip
  cells that sit exactly on a step.
- **Sea-level range.** `0.0 <= sea_level_m <= 2.0`. The upper limit is the named constant `kMaxSeaLevelM = 2.0`.
  The precompute script calls the engine for 0.0, 0.1, …, 2.0 m (21 values) for each of the 15 coastal counties.
- `float` (32-bit) is used for elevation because a national grid has millions of cells and the source data is
  stored as 32-bit float. `double` is used for single values (cell size, sea level, area).

---

## 4. Output

On success the engine returns a `FloodResult`:

| Field | C++ type | Unit | Meaning |
|---|---|---|---|
| `flooded` | `std::vector<std::uint8_t>` | – | `width * height` values, row-major, same layout as the input. `1` = flooded **land** cell, `0` = not flooded |
| `flooded_cells` | `std::size_t` | cells | Number of `1` values in `flooded` |
| `flooded_area_km2` | `double` | km² | `flooded_cells * cell_size_m * cell_size_m / 1e6` |

Sea cells are always `0` in `flooded`: the sea is not "flooded land". No-data cells are always `0`.

Example: with `cell_size_m = 1000`, one cell is 1000 m × 1000 m = 1 km², so `flooded_area_km2 == flooded_cells`.
With `cell_size_m = 30`, one cell is 900 m² = 0.0009 km².

---

## 5. Flood rule

A **land** cell floods when **both** are true:

1. `elevation_m <= sea_level_m` (a cell exactly at the sea level floods), **and**
2. it is connected to a sea cell through a path of other flooded cells.

**Connectivity: 4-neighbour.** Two cells are connected only if they share an edge (up, down, left, right), not
only a corner. With 8-neighbour (corners too), water could leak diagonally between two dry cells, which is not
physical.

```
 SEA  3.0          Cell (1,1) is 0.2 m and touches the sea only at a corner.
 3.0  0.2          With 4-neighbour it stays dry; with 8-neighbour it would flood.
```

**Why the connectivity check matters.** A low inland hollow that is surrounded by higher ground does not flood,
because the sea cannot reach it. Without the check, every cell below the sea level would flood, which overstates
the flooding.

**Property: flooding is monotonic.** If `h1 < h2`, every cell flooded at `h1` is also flooded at `h2`. A higher sea
level can only add flooded cells, never remove them. This is checked by a test.

**Algorithm.** Breadth-first search (BFS) that starts from all sea cells at once and spreads into neighbouring land
cells that are at or below the sea level and not no-data. It uses a queue in a `std::vector`/`std::deque`, not
recursion, because a real grid has millions of cells and recursion could overflow the stack.
Time O(N), memory O(N), where N = `width * height`.

*Implementation note:* the BFS may start only from sea cells that have at least one land neighbour. The result is
identical (a sea cell with only sea neighbours cannot flood any land directly), and the queue is smaller.

**Grid edge.** Cells outside the grid are not sea and not land; water does not enter from outside the grid. So the
precompute script must include the nearby sea in the grid and mark it in `is_sea`.

---

## 6. Errors

The engine returns either a result or an error, never both:

```cpp
using FloodOutcome = std::variant<FloodResult, FloodError>;
```

All input is validated **before** any computation, so a failure can never produce a partial result.
The engine does not throw C++ exceptions on bad input. This matters because the Python binding (CCD-419) must not
let C++ exceptions cross into Python. The only possible exception, `std::bad_alloc` (out of memory), is caught
inside the engine and returned as `AllocationFailed`.

| Code | When |
|---|---|
| `EmptyGrid` | `width == 0` or `height == 0` |
| `SizeOverflow` | `width * height` does not fit in `std::size_t` |
| `ElevationSizeMismatch` | `elevation_m.size() != width * height` |
| `SeaMaskSizeMismatch` | `is_sea.size() != width * height` |
| `InvalidCellSize` | `cell_size_m` is NaN, infinite, or `<= 0` |
| `InvalidSeaLevel` | `sea_level_m` is NaN, infinite, `< 0.0` or `> 2.0` |
| `NonFiniteElevation` | an elevation is NaN or infinite and is not equal to `nodata` |
| `AllocationFailed` | not enough memory for the output or the BFS queue |

Each `FloodError` also has a `message` in plain English that names the wrong value, for example
`"sea_level_m = 2.5 is outside [0.0, 2.0]"`.

---

## 7. Model limits

These are known simplifications. They should also be stated on the dashboard next to the flood map.

- **Not a flood forecast.** It shows land below a given sea level that is connected to the sea, not a real flood event.
- **No tides, storm surges or waves.** Real coastal floods are driven by surges on top of high tide; the sea level here
  is a constant still-water level.
- **No flood defences.** Sea walls and embankments are ignored unless they appear in the elevation data.
- **No rivers or rainfall.** Only the sea is a water source.
- **Surface model, not bare earth.** The chosen elevation source (§8) is a Digital Surface Model: it includes
  buildings and trees. Built-up and wooded areas look higher than the ground, so the engine may show **less**
  flooding there than in reality.
- **Resolution.** One cell is about 30 m or 90 m. Narrow features (small embankments, channels) can be missed.
- **Vertical accuracy.** The chosen source states an absolute vertical accuracy of under 4 m (90 % of cells). That is
  larger than the whole 0–2 m range we model, so results are indicative only.
- **Vertical datum.** The chosen source uses the EGM2008 geoid. Irish heights normally use Malin Head (OSGM15), and the
  sea-level projections are relative to mean sea level. The small difference between these is not corrected
  (decision D4).
- **Little land may flood.** With 0–2 m of still water, no tide offset and a 90 m surface model, very little land may
  flood. The precompute script is first run on one pilot county (Cork) to check this (decision D5).

---

## 8. Elevation source. Decided: GLO-90 (pending objections until 12 Nov)

> Decided by Artur on 9 November 2026 (D1). It stands unless a team member objects by Thursday 12 November 2026.

**Copernicus DEM, GLO-90**, from the Copernicus Data Space Ecosystem. GLO-30 is used only if the pilot county shows
that GLO-90 misses obvious coastal features (D1).

| | |
|---|---|
| Dataset | Copernicus DEM, instances GLO-30 (1 arc-second, ~30 m) and GLO-90 (3 arc-seconds, ~90 m) |
| Type | Digital Surface Model (includes buildings, infrastructure, vegetation) |
| Format | GeoTIFF (32-bit float), 1° × 1° tiles |
| Horizontal CRS | WGS84, EPSG:4326 → reprojected by the precompute script to ITM, EPSG:2157 |
| Vertical datum | EGM2008 (EPSG:3855), metres |
| Access | Free with a Copernicus Data Space account: https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM |
| Licence | ESA "Copernicus Contributing Mission Data Access Licence" (issue 21/02/2025). For the general public: free, **non-commercial use only** |

Licence points that affect our project (checked on 9 November 2026 against the licence PDF linked from the page above):

- **Non-commercial only** for users like us (general public, clause 3.4.3). Our student project is non-commercial.
- **Do not commit or republish the raw DEM.** Raw and resampled/reprojected DEM tiles ("Altered Products") may only be
  shared with people who have accepted the licence (clause 3.8.1.9). So the DEM stays local, like the NetCDF files.
- **The flood layers we publish are "Value Added Products"** (clause 1.12.3): a flooded/not-flooded mask does not let
  anyone get the elevation values back. These may be shared under our own terms (clause 3.8.2), with the credit
  from clause 4.2.4 (see `DATA_SOURCES.md`).

Not yet checked (to do before the team agrees):

- The DEM-specific "Mission Specific Annex" linked from the page was not read.
- The exact attribution string on the dataset page should be copied from the page itself.
- The page says the datasets "will be maintained until 2026"; confirm they are still available.
- Alternatives (for example an Irish national LiDAR terrain model) have not been checked.

---

## 9. Decisions

Date: 9 November 2026 · Decided by: Artur Romanov. Items marked **(team)** stand unless someone objects by
Thursday 12 November 2026.

**D1. Elevation source (team): Copernicus DEM GLO-90.**
Reason: national coverage, free, and its vertical accuracy (< 4 m) makes GLO-30's extra detail of little value, while
GLO-90 files are 9× smaller. GLO-30 only if a pilot county shows GLO-90 misses obvious coastal features.

**D2. The raw DEM is never committed to the repo.**
Reason: licence clause 3.8.1.9 forbids sharing it with people who have not accepted the licence. Each developer
downloads it locally, like the NetCDF files. CI does not need it: the engine tests use synthetic grids.

**D3. The sea mask is built by the precompute script (CCD-420) from a land/coastline polygon that covers the whole
island, including Northern Ireland.**
Reason: the county boundary files in the repo cover only the 26 counties, so "outside the counties = sea" would mark
Northern Ireland as sea. The polygon source is chosen and recorded in CCD-420.

**D4. No EGM2008 vs Malin Head (OSGM15) datum correction this sprint.**
Reason: keeps this sprint in scope; the limit is stated in §7.

**D5. No tide offset this sprint.**
Reason: keep the first version simple and match the still-water definition in §2. Risk: with 0–2 m of still water and
a 90 m surface model, little land may flood. The precompute script is first run on one pilot county (Cork); if almost
nothing floods, adding a mean-high-water offset is proposed for Sprint 3.

**D6. Flood layer format (team; affects CCD-360 and CCD-169).**
Reason: one fixed layout lets the precompute script, the API and the map be built in parallel.

- Folder: `pipeline/data/processed/flood/<county-slug>/` for the 15 coastal counties, with slugs as in the County table.
- One PNG per level: `level_000.png`, `level_010.png`, …, `level_200.png` (level in centimetres, 21 files).
  RGBA, reprojected to Web Mercator (EPSG:3857) so it lines up with web map tiles.
  Flooded = semi-transparent blue; everything else fully transparent.
- One `index.json` per county with: the county slug; `bounds` as `[[south, west], [north, east]]` in WGS84 lat/lon;
  the source cell size in metres; and a list of `{level_m, file, flooded_cells, flooded_area_km2}`.
- Area figures come from the engine (computed on the ITM grid), not from the PNG.
- The layers are "Value Added Products" under the licence (§8), so they may be committed and served.
- CCD-360 serves `index.json` and the PNGs; a county that is not in the folder returns 404.
