// Mock API answers (CCD-405), so the frontend can be built and demoed without the backend.
//
// Switch them on in frontend/.env with VITE_USE_MOCKS=true (and restart "npm run dev").
// Then services/api.js answers from here and never calls the server. Switch them off
// (remove the line or set it to false) to use the real API again.
//
// The shapes are the ones in docs/api-examples.md. mockResponses.test.js checks the two
// agree, so they cannot drift apart.
//
// THE NUMBERS ARE EXAMPLES, NOT REAL PROJECTIONS. Cork's figures are real (they come from
// ./countyRows.js and ./seaLevel.js), every other county reuses Cork's with its own name,
// and the map, impacts and analogue numbers are made up to show the shape.
import { COUNTIES } from '../data/counties';
import { mockCork, mockCorkRows } from './countyRows';
import { mockSeaLevelCork, mockSeaLevelInland } from './seaLevel';

// The 15 coastal counties (same list as pipeline/flood_precompute.py)
const COASTAL = new Set([
  'clare', 'cork', 'donegal', 'dublin', 'galway', 'kerry', 'leitrim', 'limerick',
  'louth', 'mayo', 'meath', 'sligo', 'waterford', 'wexford', 'wicklow',
]);

// GET /counties/ : the 26 counties, alphabetical. The ids here are placeholders.
export const mockCounties = COUNTIES.map((county, index) => ({
  id: index + 1,
  name: county.name,
  slug: county.slug,
  has_coastline: COASTAL.has(county.slug),
}));

// GET /meta/ : the choices the other endpoints accept
export const mockMeta = {
  scenarios: ['baseline', 'rcp26', 'rcp45', 'rcp85'],
  periods: ['1976-2005', '2021-2050', '2071-2100'],
  seasons: ['annual', 'autumn', 'spring', 'summer', 'winter'],
  variables: ['precipitation', 'temperature'],
  sea_level_years: [2020, 2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100],
  sources: [
    {
      code: 'translate',
      name: 'Climate Ireland — TRANSLATE climate projections',
      organisation:
        "Environmental Protection Agency (Climate Ireland portal); data produced by Met Éireann's TRANSLATE project with ICHEC (University of Galway) and MaREI (UCC)",
      baseline_period: '1976-2005',
      licence: 'Licence name not stated.',
      url: 'https://www.climateireland.ie/data-explorer/',
    },
    {
      code: 'ukcp18',
      name: 'Met Office — UKCP18 sea level projections',
      organisation: 'Met Office (UK)',
      baseline_period: '1981-2000',
      licence: 'Open Government Licence v3.0.',
      url: 'https://opennetzero.org/met-office/time-mean-sea-level-projections-to-2100-cm',
    },
  ],
};

// GET /counties/{slug}/ : Cork's summary with the county's own name
function countyDetail(county) {
  return { ...mockCork, id: county.id, name: county.name, slug: county.slug, has_coastline: county.has_coastline };
}

// GET /projections/?county={slug} : Cork's rows, labelled with the county's slug
function projectionRows(county, filters) {
  return mockCorkRows
    .map((row) => ({ ...row, county: county.slug }))
    .filter((row) => ['variable', 'season', 'scenario', 'period'].every((name) => !filters.get(name) || row[name] === filters.get(name)));
}

// GET /sea-level/{slug}/ : Cork's series for a coastal county, an empty answer for an inland one
function seaLevel(county) {
  const base = county.has_coastline ? mockSeaLevelCork : mockSeaLevelInland;
  return { ...base, county: county.name, slug: county.slug, has_coastline: county.has_coastline };
}

// ---- GET /map/ ----

// How much each scenario changes the baseline by period (Cork's real annual changes)
const TEMPERATURE_CHANGE = {
  rcp26: { '2021-2050': 0.71, '2071-2100': 0.73 },
  rcp45: { '2021-2050': 0.8, '2071-2100': 1.47 },
  rcp85: { '2021-2050': 0.9, '2071-2100': 2.71 },
};
const PRECIPITATION_CHANGE_PERCENT = {
  rcp26: { '2021-2050': 1.5, '2071-2100': 2.5 },
  rcp45: { '2021-2050': 2, '2071-2100': 4 },
  rcp85: { '2021-2050': 3, '2071-2100': 8 },
};
// Where a season sits compared with the annual figure
const SEASON_TEMPERATURE_OFFSET = { annual: 0, autumn: 0, spring: -1, summer: 6, winter: -5 };
const SEASON_PRECIPITATION_SHARE = { annual: 1, autumn: 0.26, spring: 0.21, summer: 0.2, winter: 0.33 };

// One made-up value for one county: each county differs a little so the map has a range of colours
function mapValue(variable, scenario, period, season, index) {
  const future = scenario !== 'baseline';
  if (variable === 'temperature') {
    const baseline = 8.6 + (index % 9) * 0.15;
    const change = future ? TEMPERATURE_CHANGE[scenario][period] : 0;
    return (baseline + change + SEASON_TEMPERATURE_OFFSET[season]).toFixed(3);
  }
  const baseline = 950 + ((index * 137) % 900);
  const change = future ? PRECIPITATION_CHANGE_PERCENT[scenario][period] : 0;
  return ((baseline * (1 + change / 100)) * SEASON_PRECIPITATION_SHARE[season]).toFixed(3);
}

// The backend's message for a bad choice (a missing one shows as "None")
function checkChoice(name, value, allowed, errors) {
  if (!allowed.includes(value)) {
    errors[name] = `Invalid ${name}: ${value ?? 'None'}. Valid ${name}s are: ${allowed.join(', ')}`;
  }
}

function mapResponse(params) {
  const choice = (name) => params.get(name);
  const [variable, scenario, period, season] = ['variable', 'scenario', 'period', 'season'].map(choice);

  const errors = {};
  checkChoice('variable', variable, mockMeta.variables, errors);
  checkChoice('scenario', scenario, mockMeta.scenarios, errors);
  checkChoice('season', season, mockMeta.seasons, errors);
  checkChoice('period', period, mockMeta.periods, errors);
  if (Object.keys(errors).length > 0) return { status: 400, body: errors };

  // Rows exist for the baseline in the baseline period and for each scenario in the future periods
  const hasRows = (scenario === 'baseline') === (period === '1976-2005');
  const unit = variable === 'temperature' ? 'degC' : 'mm';
  const results = hasRows
    ? mockCounties.map((county, index) => ({
        county: { name: county.name, slug: county.slug, has_coastline: county.has_coastline },
        value: mapValue(variable, scenario, period, season, index),
        unit,
      }))
    : [];
  const numbers = results.map((result) => Number(result.value));
  const fixed = (number) => number.toFixed(3);

  return {
    status: 200,
    body: {
      variable,
      scenario,
      period,
      season,
      unit: hasRows ? unit : null,
      min: hasRows ? fixed(Math.min(...numbers)) : null,
      max: hasRows ? fixed(Math.max(...numbers)) : null,
      results,
    },
  };
}

// ---- PROPOSED endpoints (not built yet; the owners confirm the shapes on CCD-405) ----
// Invented example numbers, only to show the shape.

const FUTURE_ROWS = [
  ['rcp26', '2021-2050'], ['rcp26', '2071-2100'],
  ['rcp45', '2021-2050'], ['rcp45', '2071-2100'],
  ['rcp85', '2021-2050'], ['rcp85', '2071-2100'],
];

// GET /impacts/?county={slug} (CCD-367, Taras): everyday indicators instead of raw degrees
const IMPACT_INDICATORS = [
  { code: 'frost_days', label: 'Frost days', unit: 'days per year', baseline: 38, changes: [-7, -9, -9, -14, -10, -22] },
  { code: 'hot_days', label: 'Hot days (25 °C or above)', unit: 'days per year', baseline: 1, changes: [1, 1, 1, 3, 2, 9] },
  { code: 'heating_degree_days', label: 'Heating degree days', unit: 'degree days', baseline: 2650, changes: [-150, -160, -170, -300, -190, -520] },
  { code: 'growing_season', label: 'Growing season length', unit: 'days', baseline: 280, changes: [10, 11, 13, 22, 15, 38] },
];

function impacts(county) {
  return {
    county: county.slug,
    baseline_period: '1976-2005',
    source: 'translate',
    indicators: IMPACT_INDICATORS.map(({ code, label, unit, baseline, changes }) => ({
      code,
      label,
      unit,
      baseline: baseline.toFixed(3),
      projections: FUTURE_ROWS.map(([scenario, period], index) => ({
        scenario,
        period,
        value: (baseline + changes[index]).toFixed(3),
        change: changes[index].toFixed(3),
      })),
    })),
  };
}

// GET /analogues/?county={slug} (CCD-358, Artur): the European city whose present climate
// most closely matches the county's projected future climate
const ANALOGUE_CITIES = [
  ['Brest', 'France', '48.390', '-4.486'], ['Plymouth', 'United Kingdom', '50.376', '-4.143'],
  ['Brest', 'France', '48.390', '-4.486'], ['Bordeaux', 'France', '44.838', '-0.579'],
  ['Nantes', 'France', '47.218', '-1.554'], ['Porto', 'Portugal', '41.150', '-8.611'],
];

function analogues(county) {
  return FUTURE_ROWS.map(([scenario, period], index) => {
    const [city, country, latitude, longitude] = ANALOGUE_CITIES[index];
    return { county: county.slug, scenario, period, city, country, latitude, longitude, source: 'worldclim' };
  });
}

// POST /reports/ (CCD-307, Taras): not routed below, because services/api.js has no POST function yet.
// These are the request and the 202 answer, for when it has.
export const mockReportRequest = { county: 'cork', scenarios: ['rcp45', 'rcp85'], period: '2071-2100' };
export const mockReportResponse = { status: 'queued', county: 'cork' };

// ---- The router ----

const notFound = () => ({ status: 404, body: { detail: 'Not found.' } });

// Looks the way a real answer looks: { status, body }. services/api.js turns a status of
// 400 or more into the same ApiError a real failed request gives.
export function mockGet(path) {
  const url = new URL(path, 'http://mock.invalid');
  const params = url.searchParams;
  const bySlug = (slug) => mockCounties.find((county) => county.slug === slug);

  if (url.pathname === '/counties/') return { status: 200, body: mockCounties };
  if (url.pathname === '/meta/') return { status: 200, body: mockMeta };
  if (url.pathname === '/map/') return mapResponse(params);

  const detail = url.pathname.match(/^\/counties\/([^/]+)\/$/);
  if (detail) {
    const county = bySlug(detail[1]);
    return county ? { status: 200, body: countyDetail(county) } : notFound();
  }

  const sea = url.pathname.match(/^\/sea-level\/([^/]+)\/$/);
  if (sea) {
    const county = bySlug(sea[1]);
    return county ? { status: 200, body: seaLevel(county) } : notFound();
  }

  // These need ?county=slug: 400 if it is missing, 404 if there is no such county
  const needsCounty = {
    '/projections/': (county) => projectionRows(county, params),
    '/impacts/': impacts,
    '/analogues/': analogues,
  }[url.pathname];
  if (needsCounty) {
    if (!params.get('county')) return { status: 400, body: { county: 'This query parameter is required.' } };
    const county = bySlug(params.get('county'));
    return county ? { status: 200, body: needsCounty(county) } : notFound();
  }

  return notFound();
}
