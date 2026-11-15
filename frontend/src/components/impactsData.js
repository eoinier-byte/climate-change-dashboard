// Turns the rows from GET /api/counties/{slug}/impacts/ into the cards that the
// "What this means for you" block shows (CCD-375).
//
// Each API row is one indicator, for one scenario and one period, e.g.
//   { indicator: 'frost_days', scenario: 'rcp85', period: '2071-2100',
//     baseline_value: '30.826', projected_value: '6.417', units: 'days', ... }
//
// Rules from the story:
//   - only indicators the API sent are shown, in the order of INDICATORS below
//   - an indicator with no data is left out completely, never shown as 0
import { SCENARIO_LABELS } from '../styles/scenarioColors';

// The indicators we know how to explain, in the order they appear on the page.
//   code     - the "indicator" value the API sends
//   label    - the card heading
//   explain  - one plain-language sentence saying what the number means
//   kind     - "days": show a number of days a year
//              "percent": show the change as a percentage (heating degree days are a sum of
//              degrees, not a number of days, so a percentage is easier to understand)
//   decimals - how many decimal places to show
export const INDICATORS = [
  {
    code: 'summer_days',
    label: 'Hot days',
    explain: 'Days a year when the temperature goes above 25 °C.',
    kind: 'days',
    decimals: 1, // small numbers (about 2 a year today), so keep one decimal
  },
  {
    code: 'frost_days',
    label: 'Frost days',
    explain: 'Days a year when the temperature drops below 0 °C.',
    kind: 'days',
    decimals: 0,
  },
  {
    code: 'growing_season_length',
    label: 'Growing season',
    explain: 'How many days a year the growing season lasts, while it stays above 5 °C.',
    kind: 'days',
    decimals: 0,
  },
  {
    code: 'heating_degree_days',
    label: 'Heating need',
    explain:
      'How much homes need heating: how far each day is below 15.5 °C, added up over the year. ' +
      'Shown as a percentage change, not a number of days.',
    kind: 'percent',
    decimals: 0,
  },
];

// Rounds a number to a number of decimal places, e.g. roundTo(30.826, 0) -> 31
function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// Writes a number for people to read, e.g. 2123.712 with 0 decimals -> "2,124"
function formatNumber(value, decimals) {
  return value.toLocaleString('en-IE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// The "Today" line, e.g. "31 days a year" or "2,124 degree days a year"
function todayText(indicator, baseline) {
  const unit = indicator.kind === 'percent' ? 'degree days' : 'days';
  return `${formatNumber(roundTo(baseline, indicator.decimals), indicator.decimals)} ${unit} a year`;
}

// The line for one scenario, e.g. "6 days a year, 25 fewer than today"
// or "36% less heating needed than today"
function projectionText(indicator, baseline, projected) {
  if (indicator.kind === 'percent') {
    const percent = Math.round(((projected - baseline) / baseline) * 100);
    if (percent === 0) return 'about the same heating need as today';
    const moreOrLess = percent < 0 ? 'less' : 'more';
    return `${Math.abs(percent)}% ${moreOrLess} heating needed than today`;
  }

  // Work out the difference from the ROUNDED numbers, so the sentence always adds up
  // (e.g. "31 today" and "6 in future" says "25 fewer", not "24 fewer")
  const today = roundTo(baseline, indicator.decimals);
  const future = roundTo(projected, indicator.decimals);
  const difference = roundTo(future - today, indicator.decimals);

  const futureText = `${formatNumber(future, indicator.decimals)} days a year`;
  if (difference === 0) return `${futureText}, about the same as today`;

  const fewerOrMore = difference < 0 ? 'fewer' : 'more';
  return `${futureText}, ${formatNumber(Math.abs(difference), indicator.decimals)} ${fewerOrMore} than today`;
}

// Builds the cards for the chosen period and the ticked scenarios.
//   rows      - the list from getImpacts(slug)
//   period    - e.g. '2071-2100'
//   scenarios - the ticked scenarios in order, e.g. ['rcp26', 'rcp85']
// Returns e.g. [{ code, label, explain, today, projections: [{ scenario, scenarioLabel, text }] }]
export function buildImpacts(rows, period, scenarios) {
  const cards = [];

  for (const indicator of INDICATORS) {
    // This indicator's rows for the chosen period. A row without numbers is skipped,
    // so missing data is never shown as 0.
    const periodRows = rows.filter(
      (row) =>
        row.indicator === indicator.code &&
        row.period === period &&
        row.baseline_value != null &&
        row.projected_value != null,
    );

    // One line per ticked scenario, in the same order as the tick boxes
    const projections = [];
    for (const scenario of scenarios) {
      const row = periodRows.find((r) => r.scenario === scenario);
      if (!row) continue; // no data for this scenario: leave the line out

      projections.push({
        scenario,
        scenarioLabel: SCENARIO_LABELS[scenario],
        text: projectionText(indicator, Number(row.baseline_value), Number(row.projected_value)),
      });
    }

    // Nothing to show for this indicator: hide the whole card
    if (projections.length === 0) continue;

    // Every row carries the same baseline (1976-2005 average), so take it from the first one
    cards.push({
      code: indicator.code,
      label: indicator.label,
      explain: indicator.explain,
      today: todayText(indicator, Number(periodRows[0].baseline_value)),
      projections,
    });
  }

  return cards;
}