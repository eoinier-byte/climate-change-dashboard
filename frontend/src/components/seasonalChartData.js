// Helper functions for the seasonal precipitation chart (CCD-162).
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

// Finds the one row for a scenario and season, or undefined if it is missing
function findRow(rows, scenario, season) {
  return rows.find((row) => row.scenario === scenario && row.season === season);
}

// Builds the { labels, datasets } object that Chart.js expects for a bar chart.
// One group of bars per season, and one bar per scenario inside each group.
export function buildSeasonalChartData(rows) {
  const labels = SEASONS.map((season) => SEASON_LABELS[season]);

  const datasets = SCENARIOS.map((scenario) => ({
    label: SCENARIO_LABELS[scenario],
    // The API sends numbers as strings, so turn each one into a real number.
    // A missing row becomes null, so Chart.js leaves a gap instead of drawing 0.
    data: SEASONS.map((season) => {
      const row = findRow(rows, scenario, season);
      return row ? Number(row.change) : null;
    }),
    backgroundColor: SCENARIO_COLORS[scenario],
  }));

  return { labels, datasets };
}

// Builds a short text summary for one scenario (RCP8.5 by default), e.g.
// "Under RCP8.5, by 2071-2100 compared with 1976-2005: Winter +22.1%, ... Wetter: Winter, ... Drier: Summer."
// Screen readers read this, because they cannot see the chart.
export function buildSeasonalSummary(rows, scenario = 'rcp85') {
  const first = rows[0];
  const parts = [];
  const wetter = [];
  const drier = [];

  SEASONS.forEach((season) => {
    const row = findRow(rows, scenario, season);
    if (!row) return; // skip a season with no data

    const change = Number(row.change);
    const sign = change > 0 ? '+' : ''; // negative numbers already have a minus sign
    parts.push(`${SEASON_LABELS[season]} ${sign}${change}%`);

    if (change > 0) wetter.push(SEASON_LABELS[season]);
    if (change < 0) drier.push(SEASON_LABELS[season]);
  });

  let summary = `Under ${SCENARIO_LABELS[scenario]}, by ${first.period} compared with ${first.baseline_period}: ${parts.join(', ')}.`;
  if (wetter.length > 0) summary += ` Wetter: ${wetter.join(', ')}.`;
  if (drier.length > 0) summary += ` Drier: ${drier.join(', ')}.`;
  return summary;
}