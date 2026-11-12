# Flood engine: format, method and limits (CCD-396, CCD-401)

· Owner: Artur Romanov · Parent story: CCD-395 · Last updated: 12 November 2026

This document is the contract between four parts of the project:

| Part | Ticket | Role |
|---|---|---|
| C++ flood engine (`flood_engine/`) | CCD-395 | Computes which land cells flood for one sea level |
| Python binding (pybind11) | CCD-419 | Calls the engine from Python |
| Precompute script (`pipeline/flood_precompute.py`) | CCD-420 (CCD-400) | Prepares one national elevation grid and sea mask, calls the engine for every sea level, cuts out each coastal county and saves the flood layers (§11) |
| Django endpoint | CCD-360 | Serves the saved flood layers to the frontend |

All four must use the format below. If a change is needed, change this file first.

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
  **Pilot result: not run yet** (the land polygon for the sea mask, D3, is still to be chosen).
- **Sea mask from a land polygon.** Which cells count as sea depends on the land/coastline polygon (D3). Its coastline
  detail limits where the sea starts. Lakes and loughs inside the polygon are treated as land, never as sea.
- **County totals can miss coastal cells.** A flooded cell is counted for a county only if its centre is inside the
  county outline (`counties_tailte_eireann_2019.geojson`, generalised to 20 m). Low cells just outside that outline but
  inside the land polygon flood on the map grid but are not counted, so county areas may be slightly too low.

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

---

## 10. Python binding (CCD-399)

The pybind11 module `flood_engine_py` calls the engine from Python (for the precompute script, CCD-420).
It is built only when `FLOOD_ENGINE_BUILD_PYTHON=ON` (default `OFF`). CMake downloads pybind11 **v3.1.0** on the
first configure. It needs Python 3 with its development headers (`python3-dev` on Debian/Ubuntu).

**Build and test** (from the repository root; `numpy` and `pytest` must be installed in that Python):

```bash
cmake -S flood_engine -B flood_engine/build -DFLOOD_ENGINE_BUILD_PYTHON=ON
cmake --build flood_engine/build -j
ctest --test-dir flood_engine/build --output-on-failure
FLOOD_ENGINE_PY_DIR=flood_engine/build/python python -m pytest flood_engine/tests/python -v
```

If several Pythons are installed, choose one with `-DPython_EXECUTABLE=$(which python)`; the module only imports in
that Python version. Add `-DFLOOD_ENGINE_BUILD_TESTS=OFF` to build the module without Catch2.

**Import.** The module is the file `flood_engine/build/python/flood_engine_py.cpython-<version>-<platform>.so`.
There is no package to install: put its directory on `sys.path` (or `PYTHONPATH`). The tests read the directory from
the environment variable `FLOOD_ENGINE_PY_DIR` and skip if it is not set.

```python
import numpy as np
import flood_engine_py  # with flood_engine/build/python on sys.path or PYTHONPATH

elev = np.array([[0.0, 0.5, 3.0], [0.0, 0.8, 0.3]])  # metres, shape (rows, cols)
sea = np.array([[1, 0, 0], [1, 0, 0]], dtype=bool)  # column 0 is sea
r = flood_engine_py.compute_flood(elev, sea, cell_size_m=1000.0, sea_level_m=1.0)
print(r["flooded"], r["flooded_cells"], r["flooded_area_km2"])
# [[0 1 0]
#  [0 1 1]] 3 3.0
```

**Signature:** `compute_flood(elevation_m, is_sea, cell_size_m, sea_level_m, nodata=-9999.0) -> dict`

| Argument | Python value | Passed to the engine as |
|---|---|---|
| `elevation_m` | 2-D array-like, metres | `float32`, C-contiguous (row-major), copied into `FloodInput.elevation_m` |
| `is_sea` | 2-D array-like, same shape (bool or int) | `is_sea != 0` as `uint8`, copied into `FloodInput.is_sea` |
| `cell_size_m` | float, metres | `cell_size_m` |
| `sea_level_m` | float, metres, 0.0 to 2.0 | `sea_level_m` |
| `nodata` | float | `nodata` (as `float`) |

Shape `(rows, cols)` gives `height = rows` and `width = cols`. A C-contiguous numpy array is row-major, so
`array[r, c]` is at index `r * width + c`, the layout in §2.

**Return value:** a `dict` with

| Key | Type | Meaning |
|---|---|---|
| `flooded` | `numpy.ndarray`, `uint8`, shape `(rows, cols)` | `1` = flooded land cell, `0` = not flooded (§4) |
| `flooded_cells` | `int` | number of `1` values in `flooded` |
| `flooded_area_km2` | `float` | flooded area in km² |

**Errors.** The binding checks the shapes itself and raises `ValueError` (before calling the engine) if an input is
not 2-D or the two shapes differ. Engine errors (§6) become Python exceptions with the message
`"<Code>: <engine message>"`, for example `ValueError: InvalidSeaLevel: sea_level_m = 2.5 is outside [0.0, 2]`.

| Engine `FloodErrorCode` | Python exception |
|---|---|
| `EmptyGrid` | `ValueError` |
| `SizeOverflow` | `ValueError` |
| `ElevationSizeMismatch` | `ValueError` |
| `SeaMaskSizeMismatch` | `ValueError` |
| `InvalidCellSize` | `ValueError` |
| `InvalidSeaLevel` | `ValueError` |
| `NonFiniteElevation` | `ValueError` |
| `AllocationFailed` | `MemoryError` |

An input numpy cannot convert to a float array (for example strings) raises `TypeError`.

**GIL.** The input is copied into the engine's own vectors while the GIL is held; the GIL is released only while
the engine computes, so other Python threads can run meanwhile.

---

## 11. Precompute method and rebuilding the layers (CCD-400)

Script: `pipeline/flood_precompute.py`. Tests: `pipeline/tests/test_flood_precompute.py`.

### Inputs

| Input | Where | Notes |
|---|---|---|
| Elevation | `data/dem/glo90/ireland_glo90.vrt` (Copernicus GLO-90 mosaic, §8) | Local only, never committed (D2). How to download: `DATA_SOURCES.md` §7 |
| Land polygon | path given with `--land` | Whole island incl. Northern Ireland (D3). Outside = sea. **Source not chosen yet**: options are listed in CCD-420 |
| County boundaries | `pipeline/data/boundaries/counties_tailte_eireann_2019.geojson` | Tailte Éireann, CC BY 4.0; name column `ENGLISH` |
| Engine | `flood_engine_py` (§10) | Directory given by `FLOOD_ENGINE_PY_DIR` |

### Method

1. **One national grid.** The DEM is reprojected once to an ITM (EPSG:2157) grid with square cells (default 90 m),
   using **bilinear** resampling because elevation varies smoothly. The grid covers the land polygon plus 3 cells of
   sea on every side, so the grid edge is always sea (§5). Cells with no DEM value and any NaN become `-9999.0` (§3).
2. **Sea mask.** The land polygon is rasterised on the same grid (cell centre inside = land). Everything else is sea.
   Holes in the polygon (enclosed lakes) are filled, so inland lakes are land.
3. **Engine.** For each level `k / 10.0`, `k = 0..20` (§3), the engine runs **once on the whole national grid**.
   Running per county would cut off water at the crop edge.
4. **Per county.** Each coastal county is rasterised on the same grid. Only flooded cells inside it are counted:
   `flooded_area_km2 = flooded_cells × cell_size² / 1e6`, from the ITM grid, not from the PNG (D6).
   The county's flooded mask is reprojected to Web Mercator (EPSG:3857) with **nearest** resampling (the mask is 0/1;
   bilinear would invent half-flooded pixels), cropped to the county and saved as an RGBA PNG.
5. **Output** (D6) in `pipeline/data/processed/flood/<slug>/`: `level_000.png` … `level_200.png` and `index.json` with
   `slug`, `bounds` (`[[south, west], [north, east]]`, WGS84, the PNG's own corners), `cell_size_m`, `levels`
   (`level_m`, `file`, `flooded_cells`, `flooded_area_km2`), `attribution` (`DATA_SOURCES.md` §7) and `model_limits` (§7).

An unknown or non-coastal county slug, or a missing input file, stops the script with a message that names it.

### Rebuilding the layers

From the repository root:

```bash
cmake -S flood_engine -B flood_engine/build -DFLOOD_ENGINE_BUILD_PYTHON=ON -DPython_EXECUTABLE="$(which python)"
cmake --build flood_engine/build -j
pip install -r pipeline/requirements.txt
FLOOD_ENGINE_PY_DIR=flood_engine/build/python python pipeline/flood_precompute.py \
    --dem data/dem/glo90/ireland_glo90.vrt --land <land polygon> \
    --counties pipeline/data/boundaries/counties_tailte_eireann_2019.geojson \
    --out pipeline/data/processed/flood --county cork
```

Leave out `--county` to build all 15 coastal counties (only after the Cork pilot, D5). The script prints a table of
flooded cells and area per level.

**Tests** use tiny synthetic inputs, never the DEM: `cd pipeline && python -m pytest tests/test_flood_precompute.py -v`.
The real-engine end-to-end test runs only when `FLOOD_ENGINE_PY_DIR` is set (in CI: the `cpp` job).
