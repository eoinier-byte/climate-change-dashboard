# Climate analogues: method and limitations (CCD-354)

> "As a member of the public, I want to know which European city my county's future climate will resemble, so that I can picture what the change means."

For each county, scenario (RCP2.6, 4.5, 8.5) and period (2021–2050, 2071–2100) we find the **3 European cities whose present-day climate is closest to the county's projected climate**. The endpoint is `GET /api/counties/{slug}/analogues/?scenario=&period=` ([api-examples.md](api-examples.md)); the tables are in [data-model.md](data-model.md).

| Part | Jira | Where |
|---|---|---|
| WorldClim values for cities and counties | CCD-355 | `pipeline/worldclim_baseline.py`, `pipeline/data/analogue_cities.csv` |
| Tables `CityClimate`, `CountyAnalogue` | CCD-356 | `backend/climate/models.py` |
| Calculation | CCD-357 | `backend/climate/analogues.py`, `manage.py compute_analogues` |
| Endpoint | CCD-358 | `backend/climate/views.py` (`CountyAnalogueListView`) |
| Tests | CCD-359 | `pipeline/tests/test_worldclim_baseline.py`, `backend/climate/tests/test_compute_analogues.py`, `test_views.py` |

## Data

- **Cities:** 49 cities in `pipeline/data/analogue_cities.csv`, mostly Atlantic (Brittany, Normandy, Biscay, Galicia, Asturias, Portugal, Cornwall/Devon, Wales), with cooler places (Scotland, Norway) and some Mediterranean ones for contrast. Coordinates come from Natural Earth populated places, matched by exact name and country ([DATA_SOURCES.md](../DATA_SOURCES.md) §10).
- **Present-day climate:** WorldClim 2.1, monthly averages for 1970–2000 on a 10-minute grid (§9). For both cities and counties we use three variables:
  - summer temperature: mean of June, July, August (the same months as TRANSLATE's JJA)
  - winter temperature: mean of December, January, February (DJF)
  - annual precipitation: total of the 12 months
- A **city** takes the value of the grid cell it is in. A **county** takes the mean of the cells whose centre is inside its Tailte Éireann boundary (4 cells for Carlow and Louth, up to 39 for Cork).
- **Projected change:** our TRANSLATE county projections (`ClimateProjection`), summer, winter and annual rows.

## Method

**1. Why not compare TRANSLATE directly with WorldClim?** They are different datasets (a bias-corrected model vs gridded observations) for different periods (1976–2005 vs 1970–2000). Comparing a TRANSLATE future with a WorldClim city would mix a real change with the difference between datasets. So both sides use WorldClim, and TRANSLATE gives only the **change** (the delta method):

```
temperature:   county future = county WorldClim + (TRANSLATE future − TRANSLATE baseline)
precipitation: county future = county WorldClim × (TRANSLATE future ÷ TRANSLATE baseline)
```

Precipitation uses a ratio, not a difference, because a change in rainfall is relative: +10 % means the same in a wet and a dry county, and a ratio can never give negative rainfall.

**2. Standardise.** Temperatures are in °C and rainfall in hundreds of mm. Without scaling, rainfall would decide everything. Each variable is divided by its standard deviation across the 49 cities, so one standard deviation of summer temperature counts the same as one of winter temperature or rainfall. (The mean usually subtracted in standardising cancels when two values are compared, so it is not needed.)

**3. Distance and similarity.** Euclidean distance between the county's future and each city on the three standardised variables. `similarity = 1 / (1 + distance)`: 1 means identical, and it falls towards 0 as the climates differ. The 3 closest cities are kept; equal distances are ordered by name so the result never changes between runs.

**Worked example** (synthetic numbers, from the test file): cities Cold 13/2/1100, Mild 15/6/1000, Warm 18/8/900, Hot 24/11/600 (summer °C / winter °C / mm). A county with WorldClim 14/5.5/1000 and TRANSLATE baseline 14.5/5.7/1370 that becomes 18.5/8.2/1233 under RCP8.5 changes by +4.0 / +2.5 / ×0.9, so its future is 18/8/900, exactly Warm (similarity 1.000), then Mild (0.479) and Hot (0.299).

## How to run

```bash
python pipeline/worldclim_baseline.py            # downloads to pipeline/data/raw/, writes the two CSVs
cd backend
python manage.py loaddata worldclim_source       # once: the WorldClim DataSource
python manage.py compute_analogues               # replaces all analogue rows (idempotent)
```

`compute_analogues` stops without changing anything if a file, the WorldClim source, a county or a projection is missing.

## Results (real run, 26 November 2026)

49 cities, 468 rows (26 counties × 3 scenarios × 2 periods × 3 ranks).

**Sanity check (CCD-357 AC): warmer scenarios give more southern cities.** Average latitude of the closest city:

| Period | RCP2.6 | RCP4.5 | RCP8.5 |
|---|---|---|---|
| 2021–2050 | 50.73° | 50.19° | 50.19° |
| 2071–2100 | 50.79° | 49.08° | 44.88° |

The near future barely differs between scenarios, as expected: the scenarios split mainly after 2050.

| County | RCP2.6, 2071–2100 | RCP8.5, 2071–2100 |
|---|---|---|
| Cork | Penzance (0.556), Swansea, Brest | San Sebastián (0.668), La Coruña, Santiago de Compostela |
| Dublin | Exeter (0.811), Cherbourg, Plymouth | Lorient (0.807), Oviedo, Brest |
| Donegal | Glasgow (0.389), Santiago de Compostela, Bergen | Vigo (0.480), Santiago de Compostela, Braga |

## Limitations

- **Two baselines.** WorldClim covers 1970–2000; the TRANSLATE change is measured from 1976–2005. Both are centred on the late 1980s, so the shift is small. Cork's WorldClim summer and winter (14.18 / 5.85 °C) are within 0.4 °C of TRANSLATE's baseline (14.52 / 5.72 °C).
- **Coarse cells.** A 10-minute cell is about 12 × 18 km here. A city's value is its cell's average, which can include hills or sea-influenced land around it, and small counties (Carlow, Louth) average only 4 cells.
- **Only three variables.** Summer and winter temperature and annual rainfall. Sunshine, wind, rain in each season and extremes are not compared, so "Cork will feel like San Sebastián" means these three averages are close, nothing more.
- **Equal weights.** Each variable counts the same after standardising. A different choice would change some rankings.
- **The answer depends on the city list.** The closest city is the closest *of these 49*. The standard deviations also come from this list, so adding or removing cities can change rankings slightly. The six cities planned but missing from Natural Earth (Truro, Aberystwyth, Quimper, Saint-Malo, Vannes, Bayonne) were left out.
- **Some counties have no close match.** Donegal's best similarity is 0.38–0.48, against 0.81–0.90 for Dublin, because it is wetter than nearly every city on the list. The frontend should show the similarity (or a word for it) so a weak match is not presented as a strong one. Where to draw "no close analogue" is for the frontend story (CCD-373) to agree.
- **WorldClim terms.** Free for academic, non-commercial use; redistribution needs permission. The two WorldClim CSVs are not committed until permission is confirmed, so the pipeline step must be run before `compute_analogues` ([DATA_SOURCES.md](../DATA_SOURCES.md) §9).
