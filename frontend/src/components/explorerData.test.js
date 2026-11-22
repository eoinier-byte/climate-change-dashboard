// Tests for the sums behind the Compare section: what is compared, the points for each season, the highlights,
// the correlation and the chart positions.
import { describe, expect, it } from 'vitest';
import {
  COMBOS,
  DEFAULT_COMBOS,
  buildChangePanel,
  buildHeadline,
  buildItems,
  buildPoints,
  buildScatter,
  buildSummary,
  combosToText,
  correlation,
  parseCombos,
  readMeasure,
  strengthOf,
} from './explorerData';

// A row in the shape of GET /api/projections/
const row = (variable, scenario, period, season, value, baseline, change) => ({
  variable,
  scenario,
  period,
  season,
  units: variable === 'temperature' ? 'degC' : 'mm',
  value: String(value),
  baseline_value: String(baseline),
  change: String(change),
});

// Winter and summer only, for the baseline and RCP8.5 at the end of the century. The baseline has no rows of its own.
const ROWS = [
  row('temperature', 'rcp85', '2071-2100', 'winter', 8, 6, 2),
  row('temperature', 'rcp85', '2071-2100', 'summer', 17, 14, 3),
  row('precipitation', 'rcp85', '2071-2100', 'winter', 550, 500, 10),
  row('precipitation', 'rcp85', '2071-2100', 'summer', 200, 250, -20),
];

const items = buildItems({ mode: 'scenarios', combos: ['base', '85-end'] });

describe('the seven things to compare', () => {
  it('has the baseline and each scenario at mid-century and at the end of the century', () => {
    expect(COMBOS.map((combo) => combo.key)).toEqual(['base', '26-mid', '26-end', '45-mid', '45-end', '85-mid', '85-end']);
    expect(COMBOS[0]).toMatchObject({ scenario: 'baseline', period: '1976-2005' });
    expect(COMBOS[6]).toMatchObject({ scenario: 'rcp85', period: '2071-2100' });
  });

  it('reads the choice from the URL in list order, and falls back to the defaults', () => {
    expect(parseCombos('85-end,base,nonsense')).toEqual(['base', '85-end']);
    expect(parseCombos('nonsense')).toEqual(DEFAULT_COMBOS);
    expect(parseCombos(null)).toEqual(DEFAULT_COMBOS);
    expect(combosToText(['85-end', 'base'])).toBe('base,85-end');
  });

  it('draws mid-century as hollow rings and the end of the century solid', () => {
    const [mid, end] = buildItems({ mode: 'scenarios', combos: ['85-mid', '85-end'] });
    expect(mid.fill).toBe('#ffffff');
    expect(end.fill).toBe(end.colour);
  });

  it('makes two items for two counties, both for the one scenario and period', () => {
    const pair = buildItems({ mode: 'counties', scenario: 'rcp45', period: '2021-2050', nameFirst: 'Cork', nameSecond: 'Kerry' });
    expect(pair.map((item) => [item.label, item.rowsOf, item.scenario, item.period])).toEqual([
      ['Cork', 'first', 'rcp45', '2021-2050'],
      ['Kerry', 'second', 'rcp45', '2021-2050'],
    ]);
    expect(pair[0].long).toBe('Cork, RCP4.5 2021–2050');
  });
});

describe('readMeasure', () => {
  const [baseline, future] = items;

  it('reads the value and the stored change', () => {
    expect(readMeasure(ROWS, future, 'temperature', 'winter')).toEqual({ value: 8, change: 2, unit: 'degC' });
  });

  it('takes the baseline from the baseline_value of the other rows when it has no rows of its own, with a change of 0', () => {
    expect(readMeasure(ROWS, baseline, 'temperature', 'winter')).toEqual({ value: 6, change: 0, unit: 'degC' });
  });

  it('is null when the API has nothing for it', () => {
    expect(readMeasure(ROWS, future, 'temperature', 'autumn')).toBeNull();
    expect(readMeasure(null, future, 'temperature', 'winter')).toBeNull();
  });
});

describe('buildPoints', () => {
  it('has a point for each item and season that has both a temperature and a rainfall', () => {
    const points = buildPoints(items, { first: ROWS });
    expect(points.map((point) => point.id)).toEqual(['base|winter', 'base|summer', '85-end|winter', '85-end|summer']);
    expect(points[2]).toMatchObject({ t: 8, p: 550, dt: 2, dp: 10 });
    expect(points[0]).toMatchObject({ t: 6, p: 500, dt: 0, dp: 0 });
  });
});

describe('correlation', () => {
  it('is 1 for a straight line up, -1 for a straight line down', () => {
    expect(correlation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(correlation([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1);
  });

  it('is null for fewer than three pairs, or when one of them never changes', () => {
    expect(correlation([1, 2], [1, 2])).toBeNull();
    expect(correlation([1, 2, 3], [5, 5, 5])).toBeNull();
  });

  it('calls it strong, moderate or weak', () => {
    expect(strengthOf(0.8)).toBe('strong');
    expect(strengthOf(-0.5)).toBe('moderate');
    expect(strengthOf(0.1)).toBe('weak');
  });
});

describe('buildSummary', () => {
  it('names the warmest and wettest season of everything shown', () => {
    const { tiles } = buildSummary(buildPoints(items, { first: ROWS }));
    expect(tiles[0]).toMatchObject({ label: 'Warmest season', value: 'Summer · 17.0 °C' });
    expect(tiles[1]).toMatchObject({ label: 'Wettest season', value: 'Winter · 550 mm' });
  });

  it('adds the most warming and the biggest rainfall change for the future items', () => {
    const { tiles } = buildSummary(buildPoints(items, { first: ROWS }));
    expect(tiles[2]).toMatchObject({ label: 'Most warming', value: 'Summer · +3.0 °C' });
    expect(tiles[3]).toMatchObject({ label: 'Biggest rainfall change', value: 'Summer · −20.0%' });
  });

  it('only talks about warming and rainfall moving together with three or more future results', () => {
    const summary = buildSummary(buildPoints(items, { first: ROWS })); // two future results
    expect(summary.link).toBeNull();
    expect(summary.tiles.some((tile) => tile.label === 'Warming vs rainfall')).toBe(false);
  });

  it('says there is a clear link, but not that one causes the other, when warming and rainfall go together', () => {
    const three = buildItems({ mode: 'scenarios', combos: ['26-end', '45-end', '85-end'] });
    const rows = [];
    three.forEach((item, index) => {
      ['winter', 'spring', 'summer', 'autumn'].forEach((season) => {
        const warming = index + 1;
        rows.push(row('temperature', item.scenario, item.period, season, 10 + warming, 10, warming));
        rows.push(row('precipitation', item.scenario, item.period, season, 100 + warming * 5, 100, warming * 5));
      });
    });
    const { link, note } = buildSummary(buildPoints(three, { first: rows }));
    expect(link.r).toBeCloseTo(1);
    expect(link.clear).toBe(true);
    expect(note).toMatch(/tend to get wetter/);
    expect(note).toMatch(/does not prove/);
  });

  it('says what to do when only the baseline is shown', () => {
    const only = buildItems({ mode: 'scenarios', combos: ['base'] });
    expect(buildSummary(buildPoints(only, { first: ROWS })).note).toMatch(/Tick at least one future scenario/);
  });

  it('has nothing to say without points', () => {
    expect(buildSummary([])).toEqual({ tiles: [], link: null, note: '' });
  });
});

describe('buildHeadline', () => {
  it('says how much warmer the warmest thing is than the coolest, for one county', () => {
    const text = buildHeadline({ mode: 'scenarios', items, rowsByWho: { first: [...ROWS, row('temperature', 'rcp85', '2071-2100', 'annual', 12.5, 9.8, 2.71)] }, countyNames: { first: 'Cork' } });
    expect(text).toBe('In Cork, RCP8.5, 2071–2100 is 2.71 °C warmer on average than Baseline 1976–2005.');
  });

  it('asks for two different counties when the same one is chosen twice', () => {
    const pair = buildItems({ mode: 'counties', scenario: 'rcp85', period: '2071-2100', nameFirst: 'Cork', nameSecond: 'Cork' });
    expect(buildHeadline({ mode: 'counties', items: pair, rowsByWho: {}, scenario: 'rcp85', period: '2071-2100', sameCounty: true })).toBe(
      'Pick two different counties to compare.',
    );
  });

  it('says how much more or less one county warms than the other', () => {
    const pair = buildItems({ mode: 'counties', scenario: 'rcp85', period: '2071-2100', nameFirst: 'Cork', nameSecond: 'Kerry' });
    const first = [row('temperature', 'rcp85', '2071-2100', 'annual', 12, 10, 2.0)];
    const second = [row('temperature', 'rcp85', '2071-2100', 'annual', 13, 10, 2.5)];
    expect(buildHeadline({ mode: 'counties', items: pair, rowsByWho: { first, second }, scenario: 'rcp85', period: '2071-2100', sameCounty: false })).toBe(
      'Under RCP8.5, by end of century (2071–2100), Kerry warms 0.50 °C more than Cork.',
    );
  });
});

describe('buildChangePanel', () => {
  const points = buildPoints(items, { first: ROWS });

  it('has a row for each season and puts the 0 line between the lowest and highest change', () => {
    const panel = buildChangePanel(points, items, 'temperature');
    expect(panel.rows.map((entry) => entry.season)).toEqual(['winter', 'spring', 'summer', 'autumn']);
    expect(panel.zero).toBeGreaterThan(0);
    expect(panel.zero).toBeLessThan(100);
    expect(panel.hasGap).toBe(true);
  });

  it('gives the gap between the lowest and highest dot of a season, and none for a season without data', () => {
    const panel = buildChangePanel(points, items, 'temperature');
    expect(panel.rows[0].gap).toBe('2.0 °C'); // winter: 0 and +2
    expect(panel.rows[2].gap).toBe('3.0 °C'); // summer: 0 and +3
    expect(panel.rows[1].gap).toBe(''); // spring has no data
  });

  it('uses per cent for rainfall', () => {
    expect(buildChangePanel(points, items, 'precipitation').rows[0].gap).toBe('10.0%');
  });
});

describe('buildScatter', () => {
  const points = buildPoints(items, { first: ROWS });

  it('puts warmer points further right and wetter points higher up, inside the chart', () => {
    const scatter = buildScatter(points, items);
    const winterBase = scatter.points.find((point) => point.id === 'base|winter');
    const summerFuture = scatter.points.find((point) => point.id === '85-end|summer');
    expect(summerFuture.left).toBeGreaterThan(winterBase.left);
    expect(winterBase.top).toBeLessThan(summerFuture.top); // 500 mm is higher up than 200 mm
    scatter.points.forEach((point) => {
      expect(point.left).toBeGreaterThan(0);
      expect(point.left).toBeLessThan(100);
      expect(point.top).toBeGreaterThan(0);
      expect(point.top).toBeLessThan(100);
    });
  });

  it('joins each season of the baseline to the same season of each future item', () => {
    const scatter = buildScatter(points, items);
    expect(scatter.lines.map((line) => line.season).sort()).toEqual(['summer', 'winter']);
  });

  it('draws no lines without the baseline', () => {
    const future = buildItems({ mode: 'scenarios', combos: ['85-end'] });
    expect(buildScatter(buildPoints(future, { first: ROWS }), future).lines).toEqual([]);
  });

  it('has four ticks on each axis, and nothing for no points', () => {
    expect(buildScatter(points, items).xTicks).toHaveLength(4);
    expect(buildScatter(points, items).yTicks).toHaveLength(4);
    expect(buildScatter([], items).points).toEqual([]);
  });
});
