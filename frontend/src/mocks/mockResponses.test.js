// Tests for the mock API answers (CCD-405): the routes, the error cases,
// and that docs/api-examples.md and the mocks have the same shape.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mockCork } from './countyRows';
import { mockCounties, mockGet, mockMeta, mockReportRequest, mockReportResponse } from './mockResponses';

const MAP = '/map/?variable=temperature&scenario=rcp45&period=2021-2050&season=annual';
const ANALOGUES = '/counties/cork/analogues/?scenario=rcp45&period=2071-2100';
const body = (path) => mockGet(path).body;

describe('docs/api-examples.md and the mocks agree', () => {
  // Read the doc straight from disk and pick out each <!-- example: name --> JSON block
  const docPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'docs', 'api-examples.md');
  // On Windows, Git may give the file Windows line endings (\r\n), so turn them into plain \n first
  const doc = readFileSync(docPath, 'utf8').replace(/\r\n/g, '\n');
  const examples = Object.fromEntries(
    [...doc.matchAll(/<!-- example: (\w+) -->\s*```json\n([\s\S]*?)```/g)].map((match) => [match[1], JSON.parse(match[2])]),
  );

  // The names and types of every field, ignoring the values and how long each list is
  function shape(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return value.length > 0 ? [shape(value[0])] : [];
    if (typeof value === 'object') return Object.fromEntries(Object.keys(value).map((key) => [key, shape(value[key])]));
    return typeof value;
  }

  // [example name in the doc, the mock path that answers it]
  const pairs = [
    ['counties', '/counties/'],
    ['county', '/counties/cork/'],
    ['meta', '/meta/'],
    ['projections', '/projections/?county=cork'],
    ['seaLevel', '/sea-level/cork/'],
    ['seaLevelInland', '/sea-level/kildare/'],
    ['map', MAP],
    ['impacts', '/counties/cork/impacts/'],
    ['analogues', ANALOGUES],
    ['flood', '/flood/cork/'],
  ];

  it.each(pairs)('the "%s" example has the same shape as the mock answer', (name, path) => {
    expect(examples[name]).toBeDefined();
    expect(shape(examples[name])).toEqual(shape(body(path)));
  });

  it('the report request and response examples match the mocks', () => {
    expect(examples.reportRequest).toEqual(mockReportRequest);
    expect(examples.reportResponse).toEqual(mockReportResponse);
  });

  it('has no example that is not checked here', () => {
    const checked = [...pairs.map(([name]) => name), 'reportRequest', 'reportResponse'];
    expect(Object.keys(examples).sort()).toEqual(checked.sort());
  });
});

describe('counties', () => {
  it('lists the 26 counties, alphabetical, with unique ids', () => {
    const list = body('/counties/');
    expect(list).toHaveLength(26);
    expect(list.map((county) => county.name)).toEqual([...list.map((county) => county.name)].sort());
    expect(new Set(list.map((county) => county.id)).size).toBe(26);
  });

  it('marks the 15 coastal counties', () => {
    const coastal = mockCounties.filter((county) => county.has_coastline).map((county) => county.slug);
    expect(coastal).toHaveLength(15);
    expect(coastal).toContain('cork');
    expect(coastal).not.toContain('kildare');
  });

  it('lists two favourite counties by name, without ids', () => {
    expect(body('/auth/favourites/')).toEqual([
      { name: 'Cork', slug: 'cork', has_coastline: true },
      { name: 'Galway', slug: 'galway', has_coastline: true },
    ]);
  });

  it('gives Cork exactly the county the dashboard tests use', () => {
    expect(body('/counties/cork/')).toEqual(mockCork);
  });

  it('gives another county its own name, slug and coastline flag', () => {
    const kildare = body('/counties/kildare/');
    expect(kildare.name).toBe('Kildare');
    expect(kildare.slug).toBe('kildare');
    expect(kildare.has_coastline).toBe(false);
    expect(Object.keys(kildare)).toEqual(Object.keys(mockCork));
  });
});

describe('not found and missing parameters', () => {
  it.each([
    '/counties/atlantis/',
    '/sea-level/atlantis/',
    '/projections/?county=atlantis',
    '/counties/atlantis/impacts/',
    '/counties/atlantis/analogues/?scenario=rcp45&period=2071-2100',
    '/nothing-here/',
  ])('%s is a 404', (path) => {
    expect(mockGet(path).status).toBe(404);
  });

  it.each(['/projections/'])('%s without ?county= is a 400', (path) => {
    expect(mockGet(path).status).toBe(400);
  });
});

describe('projections, sea level and meta', () => {
  it('labels the rows with the county asked for', () => {
    const rows = body('/projections/?county=kerry');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.county === 'kerry')).toBe(true);
  });

  it('filters the rows like the real endpoint does', () => {
    const rows = body('/projections/?county=cork&variable=temperature&season=annual&scenario=rcp85');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.variable === 'temperature' && row.season === 'annual' && row.scenario === 'rcp85')).toBe(true);
  });

  it('gives a coastal county one series per scenario and an inland county none', () => {
    expect(Object.keys(body('/sea-level/cork/').series)).toEqual(['rcp26', 'rcp45', 'rcp85']);

    const inland = body('/sea-level/kildare/');
    expect(inland.has_coastline).toBe(false);
    expect(inland.series).toEqual({});
    expect(inland.years).toEqual([]);
  });

  it('lists the choices the map accepts', () => {
    expect(mockMeta.variables).toEqual(['precipitation', 'temperature']);
    expect(mockMeta.scenarios).toEqual(['baseline', 'rcp26', 'rcp45', 'rcp85']);
    expect(mockMeta.periods).toEqual(['1976-2005', '2021-2050', '2071-2100']);
  });
});

describe('map', () => {
  it('gives one value for each of the 26 counties, with the unit, min and max for the legend', () => {
    const map = body(MAP);
    expect(map.results).toHaveLength(26);
    expect(map.results.map((result) => result.county.slug)).toEqual(mockCounties.map((county) => county.slug));
    expect(map.unit).toBe('degC');

    const values = map.results.map((result) => Number(result.value));
    expect(Number(map.min)).toBe(Math.min(...values));
    expect(Number(map.max)).toBe(Math.max(...values));
    expect(Number(map.max)).toBeGreaterThan(Number(map.min)); // so the map has a range of colours
  });

  it('sends decimal strings, as the real API does', () => {
    const map = body(MAP);
    expect(map.results.every((result) => /^-?\d+\.\d{3}$/.test(result.value))).toBe(true);
    expect(map.min).toMatch(/^-?\d+\.\d{3}$/);
  });

  it('uses mm for precipitation', () => {
    expect(body('/map/?variable=precipitation&scenario=rcp45&period=2021-2050&season=annual').unit).toBe('mm');
  });

  it('shows more warming under RCP8.5 than RCP2.6', () => {
    const value = (scenario) =>
      Number(body(`/map/?variable=temperature&scenario=${scenario}&period=2071-2100&season=annual`).results[0].value);
    expect(value('rcp85')).toBeGreaterThan(value('rcp26'));
  });

  it('lists every bad choice, and shows a missing one as None', () => {
    const answer = mockGet('/map/?variable=wind&scenario=rcp45&period=2021-2050');
    expect(answer.status).toBe(400);
    expect(answer.body.variable).toBe('Invalid variable: wind. Valid variables are: precipitation, temperature');
    expect(answer.body.season).toMatch(/^Invalid season: None\. Valid seasons are: annual, autumn/);
    expect(answer.body.scenario).toBeUndefined();
    expect(answer.body.period).toBeUndefined();
  });

  it('answers 200 with no results for a combination that has no rows', () => {
    const answer = mockGet('/map/?variable=temperature&scenario=baseline&period=2071-2100&season=annual');
    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ results: [], unit: null, min: null, max: null });
  });

  it('has rows for the baseline in the baseline period', () => {
    const answer = body('/map/?variable=temperature&scenario=baseline&period=1976-2005&season=annual');
    expect(answer.results).toHaveLength(26);
  });
});

describe('impacts (built: GET /counties/{slug}/impacts/)', () => {
  it('is a flat list with the four indicators, each with a baseline row and a row per scenario and period', () => {
    const rows = body('/counties/cork/impacts/');
    expect(rows).toHaveLength(28); // 4 indicators x (baseline + 3 scenarios x 2 periods)
    expect([...new Set(rows.map((row) => row.indicator))].sort()).toEqual([
      'frost_days', 'growing_season_length', 'heating_degree_days', 'summer_days',
    ]);
    expect(rows.filter((row) => row.indicator === 'frost_days')).toHaveLength(7);
  });

  it('has the fields of a projections row, plus the indicator', () => {
    const [row] = body('/counties/cork/impacts/');
    expect(Object.keys(row).sort()).toEqual([
      'baseline_period', 'baseline_value', 'change', 'county', 'indicator', 'period',
      'projected_value', 'scenario', 'season', 'source', 'units', 'value',
    ]);
    expect(typeof row.change).toBe('number');
    expect(row.baseline_value).toMatch(/^-?\d+\.\d{3}$/); // decimals are strings
  });

  it('every change is the projected value minus the baseline', () => {
    body('/counties/cork/impacts/').forEach((row) => {
      expect(Number(row.projected_value) - Number(row.baseline_value)).toBeCloseTo(row.change, 1);
    });
  });

  it('gives another county its own slug', () => {
    const rows = body('/counties/kerry/impacts/');
    expect(rows.every((row) => row.county === 'kerry')).toBe(true);
  });

  it('filters by scenario and period, like the real endpoint', () => {
    const rows = body('/counties/cork/impacts/?scenario=rcp85&period=2071-2100');
    expect(rows.map((row) => row.indicator).sort()).toEqual([
      'frost_days', 'growing_season_length', 'heating_degree_days', 'summer_days',
    ]);
    expect(rows.every((row) => row.scenario === 'rcp85' && row.period === '2071-2100')).toBe(true);
  });

  it.each([
    ['scenario', 'rcp60'],
    ['period', '2000-2001'],
  ])('a %s the API does not know (%s) is a 400 that names the field', (field, value) => {
    const answer = mockGet(`/counties/cork/impacts/?${field}=${value}`);
    expect(answer.status).toBe(400);
    expect(answer.body[field]).toBeDefined();
  });
});

describe('analogues (proposed: GET /counties/{slug}/analogues/)', () => {
  it('gives three cities ordered by rank, for the county, scenario and period asked for', () => {
    const rows = body('/counties/kerry/analogues/?scenario=rcp85&period=2021-2050');
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 3]);
    expect(rows.every((row) => row.county === 'kerry' && row.scenario === 'rcp85' && row.period === '2021-2050')).toBe(true);
    expect(rows.every((row) => row.city && row.country)).toBe(true);
  });

  it('puts the most similar city first', () => {
    const similarity = body(ANALOGUES).map((row) => Number(row.similarity));
    expect(similarity).toEqual([...similarity].sort((a, b) => b - a));
  });

  it('sends decimal strings and names both baseline periods', () => {
    const [row] = body(ANALOGUES);
    expect(row.city_summer_temp).toMatch(/^-?\d+\.\d{3}$/);
    expect(row.county_annual_precip).toMatch(/^-?\d+\.\d{3}$/);
    expect(row).toMatchObject({
      temperature_unit: 'degC', precipitation_unit: 'mm',
      city_baseline_period: '1970-2000', change_baseline_period: '1976-2005', source: 'worldclim',
    });
  });

  it.each([
    ['scenario', 'scenario=baseline&period=2071-2100'],
    ['scenario', 'scenario=rcp60&period=2071-2100'],
    ['period', 'scenario=rcp45&period=1976-2005'],
    ['scenario', 'period=2071-2100'],
    ['period', 'scenario=rcp45'],
  ])('a missing or invalid %s (%s) is a 400 that names the field', (field, query) => {
    const answer = mockGet(`/counties/cork/analogues/?${query}`);
    expect(answer.status).toBe(400);
    expect(answer.body[field]).toBeDefined();
  });
});

describe('commentary (built: GET /agent/commentary/{slug}/{scenario}/)', () => {
  it('has the six texts, and a sea-level line for a coastal county', () => {
    const { commentary } = body('/agent/commentary/cork/rcp45/');
    expect(Object.keys(commentary)).toEqual(['summary', 'temperature', 'precipitation', 'scenarios', 'analogue', 'sea_level']);
    expect(commentary.summary).toContain('Cork');
    expect(commentary.sea_level).toMatch(/sea level/i);
  });

  it('has no sea-level line (null) for an inland county', () => {
    expect(body('/agent/commentary/offaly/rcp45/').commentary.sea_level).toBeNull();
  });

  it.each(['baseline', 'rcp60'])('a scenario of %s is a 400', (scenario) => {
    expect(mockGet(`/agent/commentary/cork/${scenario}/`).status).toBe(400);
  });

  it('an unknown county is a 404', () => {
    expect(mockGet('/agent/commentary/atlantis/rcp45/').status).toBe(404);
  });
});
