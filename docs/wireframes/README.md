# Wireframes (CCD-69)

Low-fidelity wireframes for the four key screens, each at desktop (1280 px) and phone (390 px) width.
Sources used: `README.md`, `docs/data-flow.md`, `docs/api.md`, `docs/county-rules.md`, `docs/react-research.md`.
Status: **draft for team review (CCD-77)**. The meeting notes with the agreed layout direction were not available, so check against them.

## Files

| File | Screen | Jira |
|---|---|---|
| `01-homepage-desktop.png`, `02-homepage-phone.png` | Homepage | CCD-73 |
| `03-county-selection-desktop.png`, `04-county-selection-phone.png` | County selection | CCD-75 |
| `05-dashboard-desktop.png`, `06-dashboard-phone.png` | County dashboard | CCD-74 |
| `07-analogue-match-desktop.png`, `08-analogue-none-desktop.png`, `09-analogue-match-phone.png`, `10-analogue-none-phone.png` | Climate analogue, match found and "no analogue" placeholder | CCD-76 |

## Screens and the elements each must contain (CCD-72)

### 1. Homepage
- Title, 2–3 sentences on what the dashboard shows, "projections, not forecasts"
- "Choose your county" call to action, and a link explaining RCP2.6 / 4.5 / 8.5
- Sample chart (with unit, scenario, period and baseline labels)
- Cards for temperature, rainfall, sea level and climate analogue
- Navigation (phone: menu button) and footer with data sources and attribution

### 2. County selection
- Search box and A–Z list of the 26 counties (`GET /api/counties/`)
- "coast" tag on the 15 coastal counties; `*` on Leitrim and Limerick (sea level estimated from Sligo / Clare)
- Selected-county panel with "View dashboard" button; URL uses the slug (`/county/cork`)
- "No county found" state; optional map shown as a stretch idea (React research marks maps out of scope)
- Phone: one-column list and a sticky "View dashboard" bar

### 3. County dashboard
- County name, change-county link, "projections, not forecasts"
- Filters: scenario (RCP2.6 / 4.5 / 8.5 / compare all), period (2021–2050 / 2071–2100), season (annual, winter, spring, summer, autumn)
- Summary cards: present-day temperature and rainfall (baseline 1976–2005), projected change, sea level rise
- Temperature, rainfall and sea-level sections, one line per scenario
- **Labels next to every number and chart:** unit, scenario, period, baseline, source. Sea level uses baseline 1981–2000, which differs from the 1976–2005 used for temperature and rainfall, so its caption says so
- Seasonal table (2071–2100) and generated commentary, shown as returned by the API
- States: loading, error, "No coastline" (inland county, never 0), "estimated from Sligo / Clare"
- Link to the climate analogue

### 4. Climate analogue
- Selected county, scenario and period, changeable
- Headline sentence, county's projected values vs the analogue's present-day values (units and baseline shown)
- Similarity indicator: word + bar + the real differences
- Short note on how matching works
- **Placeholder state** when no analogue exists, with alternatives (other scenario, earlier period, back to dashboard)

## Fixed rules these wireframes follow (from `docs/data-flow.md`)
- Always show the unit, scenario, period and baseline next to a number
- Say "projections", never "forecasts"
- No maths in React beyond formatting; use what the API returns
- Same scenario colours everywhere (RCP2.6 green, RCP4.5 amber, RCP8.5 red), plus line styles so colour is not the only cue

## Open questions for the team
1. **Analogue pool.** County baselines are 8.7–9.9 °C, but end-century projections are 11–12.5 °C, so no Irish county matches today. Decide whether the pool includes places outside Ireland, and what difference counts as "no analogue". There is no analogue data or endpoint in the repo yet.
2. **Commentary.** Ticket CCD-74 says "AI commentary", but the data-flow doc describes a commentary array shown as-is. Confirm which, so the label is honest.
3. **Seasonal table values** are `[+x.x]` placeholders; real values arrive from `/api/projections/`.
4. **Scenario names.** The data has RCP2.6, 4.5 and 8.5 (not 4.6 or 8.2).
5. **Periods.** The data has baseline 1976–2005, 2021–2050 and 2071–2100 (labelled "by 2050" and "by 2100" in the README).
