# Data model (draft, finalised in CCD-33)

## County
| Field | Type | Notes |
|---|---|---|
| id | integer PK | |
| name | text, unique | e.g. "Cork" |
| slug | text, unique | e.g. "cork" |

## ClimateProjection
| Field | Type | Notes |
|---|---|---|
| id | integer PK | |
| county_id | FK → County | |
| variable | text | `temperature` / `precipitation` |
| season | text | `annual`, `winter`, `spring`, `summer`, `autumn` |
| scenario | text | `baseline`, `rcp26`, `rcp45`, `rcp85` |
| period | text | `1976-2005`, `2021-2050`, `2071-2100` |
| value | decimal | absolute value for the period |
| unit | text | `°C`, `mm` |

Unique together: (county, variable, season, scenario, period). Change from baseline is calculated in the API.

## SeaLevelProjection
| Field | Type | Notes |
|---|---|---|
| id | integer PK | |
| scenario | text | |
| year | integer | 2050, 2100 |
| rise_m | decimal | metres |
| source | text | |

## User (Sprint 3)
Django's built-in user model (hashed passwords). Store only what is needed: email, name, email-report preference.
