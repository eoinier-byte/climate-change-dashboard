// Helper functions for the seasonal charts: precipitation (CCD-162) and temperature (CCD-157).
// They take the rows from the list endpoint (GET /api/projections/) for one county,
// one variable and one period, and turn them into what the chart needs.
// Kept separate from the component so they are easy to test.
import { SCENARIO_COLORS, SCENARIO_LABELS } from '../styles/scenarioColors';

// The seasons in calendar order, with the name shown on the chart
export const SEASONS = ['winter', 'spring', 'summer', 'autumn'];
export const SEASON_LABELS = {
  winter: 'Winter',
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
};

// The scenarios, from lowest to highest emissions
const SCENARIOS = ['rcp26', 'rcp45', 'rcp85'];

// The backend gives rainfall change in % and temperature change in °C
export function changeUnit(variable) {
  return variable === 'precipitation' ? '%' : '°C';
}

// Writes a change with its sign and unit, e.g. "+22.1%" or "+2.63 °C".
// "%" sits next to the number; °C gets a space, as in the line charts.
function formatChange(change, variable) {
  const sign = change > 0 ? '+' : ''; // negative numbers already have a minus sign
  const unit = changeUnit(variable);
  return unit === '%' ? `${sign}${change}%` : `${sign}${change} ${unit}`;
}

// Finds the one row for a scenario and season, or undefined if it is missing
function findRow(rows, scenario, season) {
  return rows.find((row) => row.scenario === scenario && row.season === season);
}

// The scenarios that have at least one row, in the usual order.
// When some scenarios are hidden with the tick boxes (CCD-158, CCD-165), only the rest are listed.
export function scenariosInRows(rows) {
  return SCENARIOS.filter((scenario) => rows.some((row) => row.scenario === scenario));
}

// The highest-emissions scenario still in the rows (RCP8.5 if it is there),
// which is the one the summary describes
function highestScenario(rows) {
  const present = scenariosInRows(rows);
  return present[present.length - 1];
}

// Builds the { labels, datasets } object that Chart.js expects for a bar chart.
// One group of bars per season, and one bar per scenario inside each group.
// Only scenarios that are in the rows get bars, so hidden scenarios leave no empty space.
export function buildSeasonalChartData(rows) {
  const labels = SEASONS.map((season) => SEASON_LABELS[season]);

  const datasets = scenariosInRows(rows).map((scenario) => ({
    label: SCENARIO_LABELS[scenario],
    // The API may send numbers as strings, so turn each one into a real number.
    // A missing row becomes null, so Chart.js leaves a gap instead of drawing 0.
    data: SEASONS.map((season) => {
      const row = findRow(rows, scenario, season);
      return row ? Number(row.change) : null;
    }),
    backgroundColor: SCENARIO_COLORS[scenario],
  }));

  return { labels, datasets };
}

// Builds a short text summary for one scenario: by default the highest one shown
// (RCP8.5, or RCP4.5 if RCP8.5 is hidden, and so on).
// Screen readers read this, because they cannot see the chart.
// Rainfall:    "... Winter +22.1%, ... Wetter: Winter, ... Drier: Summer."
// Temperature: "... Winter +2.63 °C, ... Biggest rise: Autumn."
export function buildSeasonalSummary(rows, scenario = highestScenario(rows)) {
  const first = rows[0];
  const variable = first.variable;
  const parts = [];
  const wetter = [];
  const drier = [];
  let biggestSeason = null;
  let biggestChange = null;

  SEASONS.forEach((season) => {
    const row = findRow(rows, scenario, season);
    if (!row) return; // skip a season with no data

    const change = Number(row.change);
    parts.push(`${SEASON_LABELS[season]} ${formatChange(change, variable)}`);

    if (change > 0) wetter.push(SEASON_LABELS[season]);
    if (change < 0) drier.push(SEASON_LABELS[season]);

    // Remember the season with the largest change so far
    if (biggestChange === null || change > biggestChange) {
      biggestChange = change;
      biggestSeason = SEASON_LABELS[season];
    }
  });

  let summary = `Under ${SCENARIO_LABELS[scenario]}, by ${first.period} compared with ${first.baseline_period}: ${parts.join(', ')}.`;

  if (variable === 'precipitation') {
    // Rainfall: say which seasons get wetter and which get drier
    if (wetter.length > 0) summary += ` Wetter: ${wetter.join(', ')}.`;
    if (drier.length > 0) summary += ` Drier: ${drier.join(', ')}.`;
  } else if (biggestSeason !== null) {
    // Temperature: every season warms, so say which warms the most
    summary += ` Biggest rise: ${biggestSeason}.`;
  }
  return summary;
}