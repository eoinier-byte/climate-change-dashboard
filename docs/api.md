# API guide (draft)

Base URL (local): `http://localhost:8000/api`

## GET /counties/
```json
[{ "name": "Cork", "slug": "cork" }]
```

## GET /counties/{slug}/
```json
{
  "county": "Cork",
  "periods": ["1976-2005", "2021-2050", "2071-2100"],
  "units": { "temperature": "°C", "precipitation_change": "%" },
  "temperature": {
    "annual": {
      "baseline": 10.2,
      "series": { "rcp45": { "values": [10.2, 11.0, 11.6], "change": [0, 0.8, 1.4] } }
    }
  },
  "rainfall": { "...": "same shape, change in %" },
  "source": "EPA Research 471 / Climate Ireland"
}
```
404 if the county does not exist. 400 for an invalid `scenario` or `season` query parameter.

## GET /sea-level/
```json
{ "scope": "national", "projections": [{ "scenario": "rcp45", "year": 2100, "rise_m": 0.5 }] }
```
(Example values only.)
