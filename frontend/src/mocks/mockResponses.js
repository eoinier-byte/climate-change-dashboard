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
// and the map and analogue numbers are made up to show the shape. The impacts are Cork's
// real figures too (./impacts.js).
import { COUNTIES } from '../data/counties';
import { mockCork, mockCorkRows } from './countyRows';
import { mockImpactsCork } from './impacts';
import { mockSeaLevelCork, mockSeaLevelInland } from './seaLevel';

import { mockFlood } from './flood';

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

export const mockFavourites = mockCounties
  .filter((county) => ['cork', 'galway'].includes(county.slug))
  .map(({ name, slug, has_coastline }) => ({ name, slug, has_coastline }));

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

// GET /counties/{slug}/impacts/?scenario=&period= (CCD-364, CCD-367, Taras): everyday indicators
// (frost days, summer days, heating degree days, growing season length) as a flat list like
// /projections/. Both filters are optional. Every row has its baseline, projected value and change.
// A choice the API does not know is a 400 that names the field, like the real endpoint's.
const IMPACT_SCENARIOS = ['baseline', 'rcp26', 'rcp45', 'rcp85'];
const IMPACT_PERIODS = ['1976-2005', '2021-2050', '2071-2100'];

function impacts(county, params) {
  const checks = [
    ['scenario', IMPACT_SCENARIOS],
    ['period', IMPACT_PERIODS],
  ];
  const errors = {};
  checks.forEach(([field, valid]) => {
    const value = params.get(field);
    if (value && !valid.includes(value)) {
      errors[field] = [`Select a valid choice. ${value} is not one of the available choices.`];
    }
  });
  if (Object.keys(errors).length > 0) return { status: 400, body: errors };

  const rows = mockImpactsCork
    .filter((row) => !params.get('scenario') || row.scenario === params.get('scenario'))
    .filter((row) => !params.get('period') || row.period === params.get('period'))
    .map((row) => ({ ...row, county: county.slug }));
  return { status: 200, body: rows };
}

// GET /counties/{slug}/analogues/?scenario=&period= (CCD-358, Artur): the three European cities
// whose present climate (WorldClim 1970-2000) is closest to the county's projected climate, ordered
// by rank. Both parameters are required; baseline is not a valid scenario. The numbers are made up.
const ANALOGUE_SCENARIOS = ['rcp26', 'rcp45', 'rcp85'];
const ANALOGUE_PERIODS = ['2021-2050', '2071-2100'];
const ANALOGUE_CITIES = [
  // [city, country, latitude, longitude, similarity, summer degC, winter degC, annual mm]
  ['Brest', 'France', '48.390', '-4.486', '0.812', '16.200', '7.300', '1210.000'],
  ['Plymouth', 'United Kingdom', '50.376', '-4.143', '0.745', '15.700', '6.400', '1010.000'],
  ['Quimper', 'France', '47.996', '-4.102', '0.701', '16.600', '6.900', '1420.000'],
];

function analogues(county, params) {
  const checks = [
    ['scenario', ANALOGUE_SCENARIOS],
    ['period', ANALOGUE_PERIODS],
  ];
  const errors = {};
  checks.forEach(([field, valid]) => {
    const value = params.get(field);
    if (!value) errors[field] = ['This field is required.'];
    else if (!valid.includes(value)) {
      errors[field] = [`Select a valid choice. ${value} is not one of the available choices.`];
    }
  });
  if (Object.keys(errors).length > 0) return { status: 400, body: errors };

  const rows = ANALOGUE_CITIES.map(([city, country, latitude, longitude, similarity, summer, winter, precip], index) => ({
    county: county.slug,
    scenario: params.get('scenario'),
    period: params.get('period'),
    rank: index + 1,
    city,
    country,
    latitude,
    longitude,
    similarity,
    city_summer_temp: summer,
    city_winter_temp: winter,
    city_annual_precip: precip,
    county_summer_temp: '16.020',
    county_winter_temp: '7.110',
    county_annual_precip: '1352.400',
    temperature_unit: 'degC',
    precipitation_unit: 'mm',
    city_baseline_period: '1970-2000',
    change_baseline_period: '1976-2005',
    source: 'worldclim',
  }));
  return { status: 200, body: rows };
}

// GET /agent/commentary/{slug}/{scenario}/ (CCD-197, Taras): the AI-written summary of a county for one scenario.
// Cork's wording and figures with the county's own name; the sea-level line is null for an inland county.
// Like the real endpoint, baseline or an unknown scenario is a 400 and an unknown county a 404. The text is an
// example, not written by an AI.
const COMMENTARY_SCENARIOS = ['rcp26', 'rcp45', 'rcp85'];
const COMMENTARY_FUTURES = { rcp26: 'low', rcp45: 'medium', rcp85: 'high' };

function commentary(county, scenario) {
  if (!COMMENTARY_SCENARIOS.includes(scenario)) {
    return { status: 400, body: { detail: `Invalid scenario: ${scenario}. Valid scenarios are: ${COMMENTARY_SCENARIOS.join(', ')}` } };
  }
  return {
    status: 200,
    body: {
      commentary: {
        summary: `Under the ${COMMENTARY_FUTURES[scenario]} emissions future, ${county.name} is projected to get warmer and wetter by the end of the century. This is example text for mock mode.`,
        temperature: 'By the end of the century the annual temperature is projected to rise by 1.5 °C, with summer warming the most.',
        precipitation: 'By the end of the century annual rainfall is projected to rise by 4.0%, with the biggest change in winter.',
        scenarios: 'The annual temperature rise is projected to be higher than under the low future (0.7 °C) and lower than under the high future (2.7 °C).',
        analogue: "By the end of the century, the county's projected climate is closest to Brest in France.",
        sea_level: county.has_coastline ? 'Sea level is projected to rise by 59 cm by the end of the century.' : null,
      },
    },
  };
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
  if (url.pathname === '/auth/favourites/') return { status: 200, body: mockFavourites };

  const detail = url.pathname.match(/^\/counties\/([^/]+)\/$/);
  if (detail) {
    const county = bySlug(detail[1]);
    return county ? { status: 200, body: countyDetail(county) } : notFound();
  }

  const impactsMatch = url.pathname.match(/^\/counties\/([^/]+)\/impacts\/$/);
  if (impactsMatch) {
    const county = bySlug(impactsMatch[1]);
    return county ? impacts(county, params) : notFound();
  }

  const analoguesMatch = url.pathname.match(/^\/counties\/([^/]+)\/analogues\/$/);
  if (analoguesMatch) {
    const county = bySlug(analoguesMatch[1]);
    return county ? analogues(county, params) : notFound();
  }

  const commentaryMatch = url.pathname.match(/^\/agent\/commentary\/([^/]+)\/([^/]+)\/$/);
  if (commentaryMatch) {
    const county = bySlug(commentaryMatch[1]);
    return county ? commentary(county, commentaryMatch[2]) : notFound();
  }

  const sea = url.pathname.match(/^\/sea-level\/([^/]+)\/$/);
  if (sea) {
    const county = bySlug(sea[1]);
    return county ? { status: 200, body: seaLevel(county) } : notFound();
  }


  // Flood map (CCD-360): only coastal counties have one, so an inland county is a 404
  const flood = url.pathname.match(/^\/flood\/([^/]+)\/$/);
  if (flood) {
    const county = bySlug(flood[1]);
    return county?.has_coastline ? { status: 200, body: mockFlood(county.slug) } : notFound();
  }

  // These need ?county=slug: 400 if it is missing, 404 if there is no such county
  const needsCounty = {
    '/projections/': (county) => projectionRows(county, params),
  }[url.pathname];
  if (needsCounty) {
    if (!params.get('county')) return { status: 400, body: { county: 'This query parameter is required.' } };
    const county = bySlug(params.get('county'));
    return county ? { status: 200, body: needsCounty(county) } : notFound();
  }

  return notFound();
}
