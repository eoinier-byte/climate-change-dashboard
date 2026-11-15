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

// Rounds to 3 decimal places (the precision the API stores), so 12.525 - 10.545 gives 1.98 and not
// 1.9800000000000004
const tidy = (number) => Math.round(number * 1000) / 1000;

// The row for one variable, season, scenario and period, or undefined if the API has none
const findRow = (rows, variable, season, scenario, period) =>
  rows.find(
    (row) => row.variable === variable && row.season === season && row.scenario === scenario && row.period === period,
  );

// What one scenario projects, in numbers: { value, change }, or null if the API has no row for it
function projected(row) {
  if (!row) return null;
  return { value: Number(row.value), change: Number(row.change) };
}

// B minus A for every measure, for one period.
//   rows   - the rows from the projections API for one county
//   a, b   - the two scenarios, e.g. 'rcp26' and 'rcp85'
//   period - e.g. '2071-2100'
// Gives back one object per measure:
//   { variable, season, unit, changeUnit, baseline, a: { value, change }, b: { value, change }, difference }
// where unit is the symbol people see ('°C', 'mm'), changeUnit is the unit of "change" ('°C' for
// temperature, '%' for rainfall), and difference is b.value - a.value in "unit". A scenario with no row
// is null, and then so is the difference, so the page can say "No data" instead of showing a wrong number.
export function compareScenarios(rows, a, b, period) {
  const measures = [];

  VARIABLES.forEach((variable) => {
    SEASONS.forEach((season) => {
      const baselineRow = findRow(rows, variable, season, 'baseline', BASELINE_PERIOD);
      const rowA = findRow(rows, variable, season, a, period);
      const rowB = findRow(rows, variable, season, b, period);
      const first = projected(rowA);
      const second = projected(rowB);

      // Nothing at all for this measure (e.g. no seasonal rows for this period): leave it out
      if (!baselineRow && !rowA && !rowB) return;

      // The baseline comes from its own row when the API sends one. Every scenario row also carries the
      // baseline it was measured against (baseline_value), so that is used when there is no baseline row.
      const baseline = baselineRow ?? rowA ?? rowB;
      const baselineValue = baselineRow ? baselineRow.value : (rowA ?? rowB).baseline_value;
      const units = baseline.units;
      const unit = UNIT_LABELS[units] || units;

      measures.push({
        variable,
        season,
        unit,
        changeUnit: variable === 'precipitation' ? '%' : unit,
        baseline: baselineValue === undefined || baselineValue === null ? null : Number(baselineValue),
        a: first,
        b: second,
        difference: first && second ? tidy(second.value - first.value) : null,
      });
    });
  });

  return measures;
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
