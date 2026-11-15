// Helpers for the Compare page (CCD-207). They turn the rows of GET /api/projections/?county=cork
// into the table the page shows: for each measure, the baseline, what each of two scenarios projects,
// and the difference between them.
//
// The difference is always B minus A, worked out from the stored values only (never from the rounded
// numbers on screen, and never estimated). Kept separate from the page so it is easy to test.
import { UNIT_LABELS } from './countyChartData';

// The measures in the table, in the order they appear: temperature then rainfall, the whole year then
// each season (winter first, the same order as the seasonal charts)
const SEASONS = ['annual', 'winter', 'spring', 'summer', 'autumn'];
const VARIABLES = ['temperature', 'precipitation'];

export const SEASON_NAMES = {
  annual: 'Whole year',
  winter: 'Winter',
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
};

export const VARIABLE_NAMES = {
  temperature: 'Temperature',
  precipitation: 'Rainfall',
};

const BASELINE_PERIOD = '1976-2005';

// The two colours for the two counties in the county comparison (CCD-378): the chart bars and the table
// headings. They are not the scenario colours, which mean scenarios everywhere else on the site.
export const COUNTY_COLOURS = { first: '#0b5d4b', second: '#1d4ed8' };

// Rounds to 3 decimal places (the precision the API stores), so 12.525 - 10.545 gives 1.98 and not
// 1.9800000000000004
const tidy = (number) => Math.round(number * 1000) / 1000;

// The row for one variable, season, scenario and period, or undefined if the API has none
const findRow = (rows, variable, season, scenario, period) =>
  rows.find(
    (row) => row.variable === variable && row.season === season && row.scenario === scenario && row.period === period,
  );

// What one side projects, in numbers: { value, change }, or null if the API has no row for it
function projected(row) {
  if (!row) return null;
  return { value: Number(row.value), change: Number(row.change) };
}

// Everything the table needs about one side (one scenario of one county) for one measure
function sideData(side, variable, season, period) {
  const baselineRow = findRow(side.rows, variable, season, 'baseline', BASELINE_PERIOD);
  const row = findRow(side.rows, variable, season, side.scenario, period);
  // The baseline comes from its own row when the API sends one. Every scenario row also carries the
  // baseline it was measured against (baseline_value), so that is used when there is no baseline row.
  const raw = baselineRow ? baselineRow.value : row?.baseline_value;
  return {
    baselineRow,
    row,
    baseline: raw === undefined || raw === null ? null : Number(raw),
    projected: projected(row),
  };
}

// B minus A for every measure. Each side is { rows, scenario }: the rows of one county and the scenario
// to read from them. The two sides can share their rows (two scenarios of one county) or not (one
// scenario of two counties).
function buildMeasures(sideA, sideB, period, sameBaseline) {
  const measures = [];

  VARIABLES.forEach((variable) => {
    SEASONS.forEach((season) => {
      const first = sideData(sideA, variable, season, period);
      const second = sideData(sideB, variable, season, period);
      const found = [first.baselineRow, first.row, second.baselineRow, second.row].filter(Boolean);

      // Nothing at all for this measure (e.g. no seasonal rows for this period): leave it out
      if (found.length === 0) return;

      const units = found[0].units;
      const unit = UNIT_LABELS[units] || units;
      // Two scenarios of one county are measured against the same baseline
      const baseline = sameBaseline ? (first.baseline ?? second.baseline) : first.baseline;
      const baselineB = sameBaseline ? baseline : second.baseline;

      measures.push({
        variable,
        season,
        unit,
        changeUnit: variable === 'precipitation' ? '%' : unit,
        baseline,
        baselineB,
        a: first.projected,
        b: second.projected,
        difference: first.projected && second.projected ? tidy(second.projected.value - first.projected.value) : null,
      });
    });
  });

  return measures;
}

// B minus A for two scenarios of one county, for one period.
//   rows   - the rows from the projections API for one county
//   a, b   - the two scenarios, e.g. 'rcp26' and 'rcp85'
//   period - e.g. '2071-2100'
// Gives back one object per measure:
//   { variable, season, unit, changeUnit, baseline, baselineB, a: { value, change }, b: { value, change }, difference }
// where unit is the symbol people see ('°C', 'mm'), changeUnit is the unit of "change" ('°C' for
// temperature, '%' for rainfall), and difference is b.value - a.value in "unit". A side with no row is
// null, and then so is the difference, so the page can say "No data" instead of showing a wrong number.
export function compareScenarios(rows, a, b, period) {
  return buildMeasures({ rows, scenario: a }, { rows, scenario: b }, period, true);
}

// The same, for one scenario in two counties (CCD-378): "a" is the first county and "b" the second.
// Each county has its own baseline (baseline for the first, baselineB for the second).
export function compareCounties(rowsA, rowsB, scenario, period) {
  return buildMeasures({ rows: rowsA, scenario }, { rows: rowsB, scenario }, period, false);
}

// Plain-language sentences for the headline measures (the whole-year temperature and rainfall), e.g.
//   "Over the whole year, RCP8.5 is 1.98 °C warmer than RCP2.6 in County Cork."
//   "Over the whole year, RCP8.5 has 38 mm more rain than RCP2.6 in County Cork."
// Uses the same numbers as the table, so the two can never disagree.
export function summaryLines(measures, labelA, labelB, countyName) {
  const lines = [];

  measures
    .filter((measure) => measure.season === 'annual' && measure.difference !== null)
    .forEach((measure) => {
      const size = Math.abs(measure.difference);
      const places = measure.variable === 'temperature' ? 2 : 0;
      const amount = `${size.toLocaleString('en-IE', { minimumFractionDigits: places, maximumFractionDigits: places })} ${measure.unit}`;
      const rounded = Number(size.toFixed(places));

      if (rounded === 0) {
        const thing = measure.variable === 'temperature' ? 'temperature' : 'rainfall';
        lines.push(`Over the whole year, ${labelA} and ${labelB} give the same ${thing} in County ${countyName}.`);
        return;
      }

      const higher = measure.difference > 0;
      const phrase =
        measure.variable === 'temperature'
          ? `${amount} ${higher ? 'warmer' : 'cooler'} than ${labelA}`
          : `${amount} ${higher ? 'more' : 'less'} rain than ${labelA}`;
      const verb = measure.variable === 'temperature' ? 'is' : 'has';
      lines.push(`Over the whole year, ${labelB} ${verb} ${phrase} in County ${countyName}.`);
    });

  return lines;
}

// Sentences about two counties under one scenario (CCD-378), from the stored changes of the whole year:
//   "Under RCP8.5, Donegal warms 0.4 °C more than Kerry."
//   "Under RCP8.5, annual rainfall changes by +8.0% in Donegal and +5.2% in Kerry."
// "Warms more" compares how much each county warms from its own baseline, not which county is warmer.
export function countySummaryLines(measures, scenarioLabel, nameA, nameB) {
  const lines = [];
  const annualTemperature = measures.find((m) => m.variable === 'temperature' && m.season === 'annual');
  const annualRain = measures.find((m) => m.variable === 'precipitation' && m.season === 'annual');

  if (annualTemperature?.a && annualTemperature?.b) {
    const gap = tidy(annualTemperature.b.change - annualTemperature.a.change);
    const size = group(Math.abs(gap), 2);
    if (Number(Math.abs(gap).toFixed(2)) === 0) {
      lines.push(`Under ${scenarioLabel}, ${nameA} and ${nameB} warm by the same amount.`);
    } else {
      lines.push(`Under ${scenarioLabel}, ${nameB} warms ${size} °C ${gap > 0 ? 'more' : 'less'} than ${nameA}.`);
    }
  }

  if (annualRain?.a && annualRain?.b) {
    lines.push(
      `Under ${scenarioLabel}, annual rainfall changes by ${formatChange(annualRain.b.change, annualRain)} in ${nameB} and ${formatChange(annualRain.a.change, annualRain)} in ${nameA}.`,
    );
  }

  return lines;
}

// How the page writes numbers. A sign is always shown for a change or a difference, so "+0.73 °C" and
// "-1.2 °C" are clear; a rounded zero has no sign.
const group = (number, places) =>
  number.toLocaleString('en-IE', { minimumFractionDigits: places, maximumFractionDigits: places });

// 10.545 -> "10.5 °C", 1439.906 -> "1,440 mm"
export function formatValue(number, measure) {
  if (number === null) return 'No data';
  return `${group(number, measure.variable === 'temperature' ? 1 : 0)} ${measure.unit}`;
}

function signed(number, places, unit, joiner = ' ') {
  const text = group(Math.abs(number), places);
  const shown = Number(Math.abs(number).toFixed(places));
  if (shown === 0) return `0${joiner}${unit}`;
  return `${number > 0 ? '+' : '-'}${text}${joiner}${unit}`;
}

// 0.73 -> "+0.73 °C", 5.2 -> "+5.2%"
export function formatChange(number, measure) {
  if (number === null) return 'No data';
  return measure.variable === 'temperature'
    ? signed(number, 2, measure.changeUnit)
    : signed(number, 1, measure.changeUnit, '');
}

// 1.98 -> "+1.98 °C", 38.4 -> "+38 mm"
export function formatDifference(number, measure) {
  if (number === null) return 'No data';
  return signed(number, measure.variable === 'temperature' ? 2 : 0, measure.unit);
}
