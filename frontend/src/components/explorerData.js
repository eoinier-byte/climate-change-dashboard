// The sums behind the Compare section (no React here, so they are easy to test).
// It compares up to seven things at once: the 1976-2005 baseline and each scenario at mid-century and at the
// end of the century, or two counties under one scenario. For each one and each season it needs the
// temperature and the rainfall, and how much each changed from the baseline.
//
// Everything is read from the rows of GET /api/projections/?county=... as the API stored them: the value, and
// the stored change from the baseline (in degrees for temperature, in per cent for rainfall). The only
// numbers worked out here are for the summary: which season is highest, and how strongly the temperature
// changes and the rainfall changes move together across the seasons (a correlation coefficient, r).
import { SCENARIO_COLORS, SCENARIO_LABELS } from '../styles/scenarioColors';
import { COUNTY_COLOURS } from './compareData';

export const SEASONS = ['winter', 'spring', 'summer', 'autumn'];
export const SEASON_NAMES = { winter: 'Winter', spring: 'Spring', summer: 'Summer', autumn: 'Autumn' };
export const SEASON_LETTERS = { winter: 'W', spring: 'Sp', summer: 'Su', autumn: 'Au' };

export const BASELINE_PERIOD = '1976-2005';
export const PERIOD_OF = { mid: '2021-2050', end: '2071-2100' };
export const PERIOD_NAMES = { '2021-2050': 'mid-century (2021–2050)', '2071-2100': 'end of century (2071–2100)' };
const BASELINE_COLOUR = '#1b2a24';

// The seven things that can be compared in "two scenarios in one county" mode, in the order they are listed.
// key is also what is written in the URL: base, 26-mid, 26-end, 45-mid, ...
export const COMBOS = [
  { key: 'base', scenario: 'baseline', period: BASELINE_PERIOD, label: 'Baseline', long: 'Baseline 1976–2005' },
  ...['26', '45', '85'].flatMap((number) =>
    ['mid', 'end'].map((when) => {
      const scenario = `rcp${number}`;
      return {
        key: `${number}-${when}`,
        scenario,
        period: PERIOD_OF[when],
        label: `${SCENARIO_LABELS[scenario]} · ${when === 'mid' ? 'mid' : 'end'}`,
        long: `${SCENARIO_LABELS[scenario]}, ${PERIOD_OF[when].replace('-', '–')}`,
      };
    }),
  ),
];
export const COMBO_KEYS = COMBOS.map((combo) => combo.key);
export const DEFAULT_COMBOS = ['base', '26-end', '45-end', '85-end'];

// "base,26-end" -> ['base', '26-end'] in list order; nothing valid -> the defaults
export function parseCombos(text) {
  const wanted = (text ?? '').split(',').map((part) => part.trim());
  const found = COMBO_KEYS.filter((key) => wanted.includes(key));
  return found.length > 0 ? found : DEFAULT_COMBOS;
}
export const combosToText = (keys) => COMBO_KEYS.filter((key) => keys.includes(key)).join(',');

// What is drawn: one entry for each thing compared.
//   { key, rowsOf: 'first' | 'second', scenario, period, label, long, colour, fill, slice }
// fill is white for the mid-century choices, so they are hollow rings and the end-of-century ones are solid.
export function buildItems({ mode, combos, scenario, period, nameFirst, nameSecond }) {
  if (mode === 'counties') {
    const long = (name) => `${name}, ${SCENARIO_LABELS[scenario]} ${period.replace('-', '–')}`;
    return [
      { key: 'first', rowsOf: 'first', scenario, period, label: nameFirst, long: long(nameFirst), colour: COUNTY_COLOURS.first, fill: COUNTY_COLOURS.first },
      { key: 'second', rowsOf: 'second', scenario, period, label: nameSecond, long: long(nameSecond), colour: COUNTY_COLOURS.second, fill: COUNTY_COLOURS.second },
    ];
  }
  return COMBOS.filter((combo) => combos.includes(combo.key)).map((combo) => {
    const isBase = combo.scenario === 'baseline';
    const colour = isBase ? BASELINE_COLOUR : SCENARIO_COLORS[combo.scenario];
    const mid = combo.period === PERIOD_OF.mid;
    return { key: combo.key, rowsOf: 'first', scenario: combo.scenario, period: combo.period, label: combo.label, long: combo.long, colour, fill: mid ? '#ffffff' : colour, baseline: isBase };
  });
}

const numberOrNull = (text) => (text === undefined || text === null || text === '' ? null : Number(text));

function findRow(rows, variable, season, scenario, period) {
  return rows?.find((row) => row.variable === variable && row.season === season && row.scenario === scenario && row.period === period);
}

// { value, change, unit } for one item, variable ('temperature' or 'precipitation') and season, or null
// when the API has no row for it. The baseline has a change of 0 by definition.
export function readMeasure(rows, item, variable, season) {
  let row = findRow(rows, variable, season, item.scenario, item.period);
  let value = numberOrNull(row?.value);
  let unit = row?.units;
  if (item.scenario === 'baseline' && value === null) {
    // Not every response has baseline rows for the seasons, but every scenario row carries the baseline it was
    // measured against (baseline_value), so that is used instead
    row = rows?.find((entry) => entry.variable === variable && entry.season === season && entry.baseline_value !== undefined && entry.baseline_value !== null);
    value = numberOrNull(row?.baseline_value);
    unit = row?.units;
  }
  if (value === null) return null;
  const change = item.scenario === 'baseline' ? 0 : numberOrNull(row.change);
  return { value, change, unit };
}

// One point for every item and season: { item, season, t, p, dt, dp } where t is the temperature (°C), p the
// rainfall (mm), dt the temperature change (°C) and dp the rainfall change (%). Points with missing data are left out.
export function buildPoints(items, rowsByWho) {
  const points = [];
  items.forEach((item) => {
    const rows = rowsByWho[item.rowsOf];
    SEASONS.forEach((season) => {
      const temperature = readMeasure(rows, item, 'temperature', season);
      const rain = readMeasure(rows, item, 'precipitation', season);
      if (!temperature || !rain) return;
      points.push({ id: `${item.key}|${season}`, item, season, t: temperature.value, p: rain.value, dt: temperature.change, dp: rain.change });
    });
  });
  return points;
}

// The whole-year change for each item, used for the one-line headline
export function annualChange(rows, item) {
  return readMeasure(rows, item, 'temperature', 'annual')?.change ?? null;
}

const best = (list, pick) => list.reduce((top, entry) => (pick(entry) > pick(top) ? entry : top));

// Pearson's r between two lists of numbers, or null when it cannot be worked out (fewer than 3 pairs, or no spread)
export function correlation(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((sum, x) => sum + x, 0) / n;
  const my = ys.reduce((sum, y) => sum + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  xs.forEach((x, i) => {
    sxy += (x - mx) * (ys[i] - my);
    sxx += (x - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  });
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export const strengthOf = (r) => (Math.abs(r) >= 0.7 ? 'strong' : Math.abs(r) >= 0.4 ? 'moderate' : 'weak');

const sign = (number, places) => `${number >= 0 ? '+' : '−'}${Math.abs(number).toFixed(places)}`;

// The highlights above the charts, and the sentence about whether warming and rainfall go together.
// Returns { tiles: [{ label, value, detail }], link: { text, r, strength } | null, note }
export function buildSummary(points) {
  if (points.length === 0) return { tiles: [], link: null, note: '' };
  const hot = best(points, (point) => point.t);
  const wet = best(points, (point) => point.p);
  const tiles = [
    { label: 'Warmest season', value: `${SEASON_NAMES[hot.season]} · ${hot.t.toFixed(1)} °C`, detail: hot.item.long },
    { label: 'Wettest season', value: `${SEASON_NAMES[wet.season]} · ${Math.round(wet.p)} mm`, detail: wet.item.long },
  ];

  const future = points.filter((point) => !point.item.baseline && point.dt !== null && point.dp !== null);
  let link = null;
  let note = 'Tick at least one future scenario to see how warming and rainfall change together.';
  if (future.length > 0) {
    const warming = best(future, (point) => point.dt);
    const rainChange = best(future, (point) => Math.abs(point.dp));
    tiles.push(
      { label: 'Most warming', value: `${SEASON_NAMES[warming.season]} · ${sign(warming.dt, 1)} °C`, detail: warming.item.long },
      { label: 'Biggest rainfall change', value: `${SEASON_NAMES[rainChange.season]} · ${sign(rainChange.dp, 1)}%`, detail: rainChange.item.long },
    );
  }
  if (future.length >= 3) {
    const r = correlation(future.map((point) => point.dt), future.map((point) => point.dp));
    if (r !== null) {
      const strength = strengthOf(r);
      const clear = Math.abs(r) >= 0.4;
      link = { r, strength, clear };
      note = clear
        ? `Does more warming bring more rain? Across these ${future.length} season results, the seasons that warm more tend to get ${r > 0 ? 'wetter' : 'drier'} (correlation r = ${r.toFixed(2)}, ${strength}). A correlation shows the two move together; it does not prove that the warming causes the rainfall change.`
        : `Does more warming bring more rain? Across these ${future.length} season results there is no clear link between how much a season warms and how its rainfall changes (correlation r = ${r.toFixed(2)}, ${strength}).`;
      tiles.push({
        label: 'Warming vs rainfall',
        value: `r = ${r.toFixed(2)}`,
        detail: clear ? `${strength[0].toUpperCase()}${strength.slice(1)} link: more warming, ${r > 0 ? 'more' : 'less'} rain` : 'No clear link',
      });
    }
  }
  return { tiles, link, note };
}

// The headline sentence above the charts
export function buildHeadline({ mode, items, rowsByWho, countyNames, scenario, period, sameCounty }) {
  if (mode === 'counties') {
    if (sameCounty) return 'Pick two different counties to compare.';
    const [a, b] = items.map((item) => annualChange(rowsByWho[item.rowsOf], item));
    if (a === null || b === null) return '';
    const gap = b - a;
    return `Under ${SCENARIO_LABELS[scenario]}, by ${PERIOD_NAMES[period]}, ${items[1].label} warms ${Math.abs(gap).toFixed(2)} °C ${gap >= 0 ? 'more' : 'less'} than ${items[0].label}.`;
  }
  const changes = items.map((item) => ({ item, change: annualChange(rowsByWho.first, item) })).filter((entry) => entry.change !== null);
  if (changes.length === 0) return '';
  if (changes.length === 1) return `${countyNames.first}: ${changes[0].item.long}. Tick more options to compare.`;
  const low = best(changes, (entry) => -entry.change);
  const high = best(changes, (entry) => entry.change);
  return `In ${countyNames.first}, ${high.item.long} is ${(high.change - low.change).toFixed(2)} °C warmer on average than ${low.item.long}.`;
}

// The dot chart of one variable's change: one row for each season, a dot for each item, on one scale with a line at 0.
// variable is 'temperature' (change in °C) or 'precipitation' (change in %).
export function buildChangePanel(points, items, variable) {
  const key = variable === 'temperature' ? 'dt' : 'dp';
  const places = 1;
  const unit = variable === 'temperature' ? ' °C' : '%';
  const all = points.map((point) => point[key]).filter((value) => value !== null).concat(0);
  let low = Math.min(...all);
  let high = Math.max(...all);
  const pad = (high - low) * 0.08 || 1;
  low -= pad;
  high += pad;
  const position = (value) => ((value - low) / (high - low)) * 100;
  const rows = SEASONS.map((season) => {
    const dots = items
      .map((item) => points.find((point) => point.item.key === item.key && point.season === season))
      .filter((point) => point && point[key] !== null)
      .map((point) => ({ item: point.item, value: point[key], left: position(point[key]), text: `${point.item.long}: ${sign(point[key], places)}${unit}` }));
    const values = dots.map((dot) => dot.value);
    const gap = values.length > 1 ? Math.max(...values) - Math.min(...values) : null;
    return {
      season,
      dots,
      gap: gap === null ? (values.length === 1 ? `${sign(values[0], places)}${unit}` : '') : `${gap.toFixed(places)}${unit}`,
    };
  });
  return { rows, zero: position(0), low: `${sign(low, places)}${unit}`, high: `${sign(high, places)}${unit}`, hasGap: items.length > 1 };
}

// The scatterplot: temperature across, rainfall up, one point for each item and season.
// A line joins each season's baseline point to the same season in each future item, when the baseline is shown.
// Positions are percentages of the chart's width and height.
export function buildScatter(points, items) {
  if (points.length === 0) return { points: [], lines: [], xTicks: [], yTicks: [] };
  const xs = points.map((point) => point.t);
  const ys = points.map((point) => point.p);
  let x0 = Math.min(...xs);
  let x1 = Math.max(...xs);
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  const padX = (x1 - x0) * 0.08 || 1;
  const padY = (y1 - y0) * 0.1 || 10;
  x0 -= padX;
  x1 += padX;
  y0 -= padY;
  y1 += padY;
  const X = (x) => ((x - x0) / (x1 - x0)) * 100;
  const Y = (y) => 100 - ((y - y0) / (y1 - y0)) * 100;

  const baseItem = items.find((item) => item.baseline);
  const lines = baseItem
    ? points
        .filter((point) => point.item.key !== baseItem.key)
        .map((point) => {
          const from = points.find((other) => other.item.key === baseItem.key && other.season === point.season);
          return from ? { id: `${point.id}-line`, season: point.season, colour: point.item.colour, x1: X(from.t), y1: Y(from.p), x2: X(point.t), y2: Y(point.p) } : null;
        })
        .filter(Boolean)
    : [];

  const ticks = [0, 1, 2, 3];
  return {
    points: points.map((point) => ({ ...point, left: X(point.t), top: Y(point.p) })),
    lines,
    xTicks: ticks.map((k) => {
      const value = x0 + ((x1 - x0) * (k + 0.5)) / 4;
      return { left: X(value), label: `${value.toFixed(1)} °C` };
    }),
    yTicks: ticks.map((k) => {
      const value = y0 + ((y1 - y0) * (k + 0.5)) / 4;
      return { top: Y(value), label: `${Math.round(value)} mm` };
    }),
  };
}

// The numbers behind the charts, as rows for a table: one row for each item and season
export function buildTableRows(points) {
  return points.map((point) => ({
    id: point.id,
    item: point.item,
    season: point.season,
    t: point.t,
    dt: point.dt,
    p: point.p,
    dp: point.dp,
  }));
}
