# API examples (CCD-405)

One JSON example for every endpoint the frontend uses or will use, so frontend work does not have to wait for the backend. The base URL is `http://localhost:8000/api`. The full endpoint table, error codes and caching notes are in [api.md](api.md); this file only shows what comes back.

**Status of each endpoint**

| Endpoint | Status | Jira | Confirm with |
|---|---|---|---|
| `GET /counties/` | Built | CCD-61 | Taras |
| `GET /counties/{slug}/` | Built | CCD-62 | Taras |
| `GET /meta/` | Built | CCD-63 | Taras |
| `GET /projections/?county={slug}` | Built | CCD-84 | Taras |
| `GET /sea-level/{slug}/` | Built | CCD-91 | Taras |
| `GET /map/?variable=&scenario=&period=&season=` | Built | CCD-338 | Taras |
| `GET /counties/{slug}/impacts/?scenario=&period=` | Built | CCD-364 / CCD-367 / CCD-368 | Taras |
| `GET /counties/{slug}/analogues/?scenario=&period=` | **Proposed** (not built yet) | CCD-354 / CCD-358 | Artur |
| `POST /reports/` | **Proposed** (not built yet) | CCD-295 / CCD-307 | Taras |

The built endpoints were written from the backend code (`climate/serializers.py`, `climate/views.py`) and the real data. The remaining proposed ones follow the same style as `/projections/`: a flat list or one object per county, selected with `?county=`. The owner confirms or changes each shape in a comment on CCD-405, and this file is then updated.

All decimal numbers are strings (for example `"9.815"`), as Django REST Framework sends them. The frontend formats them and never recalculates them.

**The numbers are examples.** Cork's figures are real, including the impacts. The map and analogue numbers are made up to show the shape, and every other county reuses Cork's figures with its own name.

## Using the mock data in the frontend

The same data is in `frontend/src/mocks/mockResponses.js`. To run the app on it, put this in `frontend/.env` and restart `npm run dev`:

```
VITE_USE_MOCKS=true
VITE_MOCK_DELAY_MS=800
```

`VITE_MOCK_DELAY_MS` is optional. It makes each answer slow, so the Loading state can be seen. Remove both lines (or set `VITE_USE_MOCKS=false`) to use the real API again. A test (`mockResponses.test.js`) checks that the examples below and the mock data have the same shape.

## Built endpoints

### `GET /counties/`

The 26 counties, alphabetical (shortened here to two). 

<!-- example: counties -->
```json
[
  {
    "id": 1,
    "name": "Carlow",
    "slug": "carlow",
    "has_coastline": false
  },
  {
    "id": 2,
    "name": "Cavan",
    "slug": "cavan",
    "has_coastline": false
  }
]
```

### `GET /counties/{slug}/`

One county with its present-day (baseline 1976–2005, annual) summary. 404 for an unknown county.

<!-- example: county -->
```json
{
  "id": 4,
  "name": "Cork",
  "slug": "cork",
  "has_coastline": true,
  "summary": {
    "scenario": "baseline",
    "period": "1976-2005",
    "season": "annual",
    "source": "translate",
    "temperature": {
      "value": "9.815",
      "unit": "°C"
    },
    "precipitation": {
      "value": "1368.817",
      "unit": "mm"
    }
  }
}
```

### `GET /meta/`

The choices the other endpoints accept, read from the database.

<!-- example: meta -->
```json
{
  "scenarios": [
    "baseline",
    "rcp26",
    "rcp45",
    "rcp85"
  ],
  "periods": [
    "1976-2005",
    "2021-2050",
    "2071-2100"
  ],
  "seasons": [
    "annual",
    "autumn",
    "spring",
    "summer",
    "winter"
  ],
  "variables": [
    "precipitation",
    "temperature"
  ],
  "sea_level_years": [
    2020,
    2030,
    2040,
    2050,
    2060,
    2070,
    2080,
    2090,
    2100
  ],
  "sources": [
    {
      "code": "translate",
      "name": "Climate Ireland — TRANSLATE climate projections",
      "organisation": "Environmental Protection Agency (Climate Ireland portal); data produced by Met Éireann's TRANSLATE project with ICHEC (University of Galway) and MaREI (UCC)",
      "baseline_period": "1976-2005",
      "licence": "Licence name not stated.",
      "url": "https://www.climateireland.ie/data-explorer/"
    },
    {
      "code": "ukcp18",
      "name": "Met Office — UKCP18 sea level projections",
      "organisation": "Met Office (UK)",
      "baseline_period": "1981-2000",
      "licence": "Open Government Licence v3.0.",
      "url": "https://opennetzero.org/met-office/time-mean-sea-level-projections-to-2100-cm"
    }
  ]
}
```

### `GET /projections/?county={slug}`

Flat rows, one per variable, scenario, period and season (shortened here to two). Optional filters: `variable`, `season`, `scenario`, `period`. 400 if `county` is missing, 404 for an unknown county.

<!-- example: projections -->
```json
[
  {
    "county": "cork",
    "variable": "precipitation",
    "scenario": "baseline",
    "period": "1976-2005",
    "season": "annual",
    "baseline_period": "1976-2005",
    "units": "mm",
    "source": "translate",
    "value": "1368.817",
    "baseline_value": "1368.817",
    "projected_value": "1368.817",
    "change": "0.0"
  },
  {
    "county": "cork",
    "variable": "precipitation",
    "scenario": "rcp26",
    "period": "2021-2050",
    "season": "annual",
    "baseline_period": "1976-2005",
    "units": "mm",
    "source": "translate",
    "value": "1426.539",
    "baseline_value": "1368.817",
    "projected_value": "1426.539",
    "change": "4.2"
  }
]
```

### `GET /sea-level/{slug}/`

Sea-level rise every 10 years to 2100, one series per scenario (shortened here). 404 for an unknown county.

<!-- example: seaLevel -->
```json
{
  "county": "Cork",
  "slug": "cork",
  "has_coastline": true,
  "unit": "cm",
  "baseline_period": "1981-2000",
  "years": [
    2020,
    2030,
    2040
  ],
  "series": {
    "rcp26": {
      "values": [
        "9.614",
        "14.007",
        "18.447"
      ],
      "provenance": "UKCP18",
      "source": "ukcp18"
    },
    "rcp45": {
      "values": [
        "9.594",
        "14.125",
        "19.026"
      ],
      "provenance": "UKCP18",
      "source": "ukcp18"
    },
    "rcp85": {
      "values": [
        "10.340",
        "15.516",
        "21.618"
      ],
      "provenance": "UKCP18",
      "source": "ukcp18"
    }
  }
}
```

An inland county answers with no data:

<!-- example: seaLevelInland -->
```json
{
  "county": "Kildare",
  "slug": "kildare",
  "has_coastline": false,
  "unit": null,
  "baseline_period": null,
  "years": [],
  "series": {}
}
```

### `GET /map/?variable=&scenario=&period=&season=`

One value for each county, with `unit`, `min` and `max` for the legend (shortened here to two counties). All four parameters are required. A bad or missing one is a 400 that lists the allowed values.

<!-- example: map -->
```json
{
  "variable": "temperature",
  "scenario": "rcp45",
  "period": "2021-2050",
  "season": "annual",
  "unit": "degC",
  "min": "9.400",
  "max": "10.600",
  "results": [
    {
      "county": {
        "name": "Carlow",
        "slug": "carlow",
        "has_coastline": false
      },
      "value": "9.400",
      "unit": "degC"
    },
    {
      "county": {
        "name": "Cavan",
        "slug": "cavan",
        "has_coastline": false
      },
      "value": "9.550",
      "unit": "degC"
    }
  ]
}
```

### `GET /counties/{slug}/impacts/?scenario=&period=` (CCD-364, CCD-367, CCD-368, Taras)

Everyday indicators instead of raw degrees: `frost_days`, `summer_days`, `heating_degree_days` and `growing_season_length`. A flat list like `/projections/`, with one row per indicator, scenario and period, including a `baseline` row for 1976-2005 (shortened here to four rows; the real answer for Cork has 28).

Both `scenario` and `period` are optional filters. An unknown choice is a 400 that names the field, for example `{"scenario": ["Select a valid choice. rcp60 is not one of the available choices."]}`. An unknown county is a 404, and a county with no indicators gives `[]`. As in `/projections/`, `baseline_value` and `projected_value` are strings, and `change` is a number. `units` is `days` or `degC_days`. The frontend function is `getImpacts(slug)` in `services/api.js`.

<!-- example: impacts -->
```json
[
  {
    "scenario": "baseline",
    "baseline_period": "1976-2005",
    "units": "days",
    "source": "translate",
    "value": "30.826",
    "county": "cork",
    "period": "1976-2005",
    "season": "annual",
    "baseline_value": "30.826",
    "projected_value": "30.826",
    "change": 0.0,
    "indicator": "frost_days"
  },
  {
    "scenario": "rcp85",
    "baseline_period": "1976-2005",
    "units": "days",
    "source": "translate",
    "value": "6.417",
    "county": "cork",
    "period": "2071-2100",
    "season": "annual",
    "baseline_value": "30.826",
    "projected_value": "6.417",
    "change": -24.41,
    "indicator": "frost_days"
  },
  {
    "scenario": "baseline",
    "baseline_period": "1976-2005",
    "units": "degC_days",
    "source": "translate",
    "value": "2123.712",
    "county": "cork",
    "period": "1976-2005",
    "season": "annual",
    "baseline_value": "2123.712",
    "projected_value": "2123.712",
    "change": 0.0,
    "indicator": "heating_degree_days"
  },
  {
    "scenario": "rcp85",
    "baseline_period": "1976-2005",
    "units": "degC_days",
    "source": "translate",
    "value": "1359.013",
    "county": "cork",
    "period": "2071-2100",
    "season": "annual",
    "baseline_value": "2123.712",
    "projected_value": "1359.013",
    "change": -764.7,
    "indicator": "heating_degree_days"
  }
]
```

## Proposed endpoints (to be confirmed by their owners)

### `GET /counties/{slug}/analogues/?scenario=&period=` (CCD-358, Artur)

The three European cities whose present-day climate is closest to the county's projected climate for one scenario and period, as a flat list ordered by `rank` (1 = closest). Both parameters are required.

- `scenario`: `rcp26`, `rcp45` or `rcp85`. `baseline` is not accepted, because the county's present climate is not a projection.
- `period`: `2021-2050` or `2071-2100`.
- Errors: **404** for an unknown county; **400** for a missing or invalid `scenario` or `period`, naming the field.

How the numbers are made (CCD-357): `city_*` are WorldClim 2.1 averages for 1970–2000 at the city (`city_baseline_period`). `county_*` are the county's WorldClim 1970–2000 value plus the TRANSLATE change between 1976–2005 (`change_baseline_period`) and the chosen scenario and period: added for temperature, multiplied as a ratio for precipitation. `summer` is June–August and `winter` is December–February; precipitation is the annual total. `similarity` is 1 / (1 + distance) over the three standardised variables, so it is between 0 and 1 and higher is closer.

<!-- example: analogues -->
```json
[
  {
    "county": "cork",
    "scenario": "rcp45",
    "period": "2071-2100",
    "rank": 1,
    "city": "Brest",
    "country": "France",
    "latitude": "48.390",
    "longitude": "-4.486",
    "similarity": "0.812",
    "city_summer_temp": "16.200",
    "city_winter_temp": "7.300",
    "city_annual_precip": "1210.000",
    "county_summer_temp": "16.020",
    "county_winter_temp": "7.110",
    "county_annual_precip": "1352.400",
    "temperature_unit": "degC",
    "precipitation_unit": "mm",
    "city_baseline_period": "1970-2000",
    "change_baseline_period": "1976-2005",
    "source": "worldclim"
  },
  {
    "county": "cork",
    "scenario": "rcp45",
    "period": "2071-2100",
    "rank": 2,
    "city": "Plymouth",
    "country": "United Kingdom",
    "latitude": "50.376",
    "longitude": "-4.143",
    "similarity": "0.745",
    "city_summer_temp": "15.700",
    "city_winter_temp": "6.400",
    "city_annual_precip": "1010.000",
    "county_summer_temp": "16.020",
    "county_winter_temp": "7.110",
    "county_annual_precip": "1352.400",
    "temperature_unit": "degC",
    "precipitation_unit": "mm",
    "city_baseline_period": "1970-2000",
    "change_baseline_period": "1976-2005",
    "source": "worldclim"
  },
  {
    "county": "cork",
    "scenario": "rcp45",
    "period": "2071-2100",
    "rank": 3,
    "city": "Quimper",
    "country": "France",
    "latitude": "47.996",
    "longitude": "-4.102",
    "similarity": "0.701",
    "city_summer_temp": "16.600",
    "city_winter_temp": "6.900",
    "city_annual_precip": "1420.000",
    "county_summer_temp": "16.020",
    "county_winter_temp": "7.110",
    "county_annual_precip": "1352.400",
    "temperature_unit": "degC",
    "precipitation_unit": "mm",
    "city_baseline_period": "1970-2000",
    "change_baseline_period": "1976-2005",
    "source": "worldclim"
  }
]
```

### `POST /reports/` (CCD-307, Taras)

Emails the signed-in user a report for a county. Needs login. Errors: 400, 401 and 429 (too many requests). `services/api.js` has no POST function yet, so this one is not in the mock mode.

Request:

<!-- example: reportRequest -->
```json
{
  "county": "cork",
  "scenarios": [
    "rcp45",
    "rcp85"
  ],
  "period": "2071-2100"
}
```

Response (202 Accepted):

<!-- example: reportResponse -->
```json
{
  "status": "queued",
  "county": "cork"
}
```

## Confirmed shapes

| Endpoint | Confirmed by | Date |
|---|---|---|
| Built endpoints (counties, county, meta, projections, sea-level, map, impacts) | | |
| `/counties/{slug}/analogues/` | | |
| `POST /reports/` | | |
