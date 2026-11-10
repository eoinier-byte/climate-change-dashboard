// Helper functions that turn one projections API response into what the chart needs.
// Kept separate from the component so they are easy to test.
import { SCENARIO_COLORS } from '../styles/scenarioColors';

// Line style per scenario, so colour is not the only way to tell them apart
const LINE_STYLES = {
  rcp26: [], // solid
  rcp45: [8, 4], // dashed
  rcp85: [2, 3], // dotted
};

// Builds the labels along the bottom of the chart:
// the baseline period first, then each future period
export function buildLabels(data) {
  return [`${data.baseline_period} (baseline)`, ...data.periods];
}

// Builds the { labels, datasets } object that Chart.js expects.
// One line per scenario (RCP2.6, RCP4.5, RCP8.5).
export function buildChartData(data) {
  const datasets = Object.entries(data.scenarios).map(([key, scenario]) => ({
    label: scenario.label,
    // The API sends numbers as strings, so turn each one into a real number
    data: scenario.values.map((value) => Number(value)),
    borderColor: SCENARIO_COLORS[key],
    backgroundColor: SCENARIO_COLORS[key],
    borderDash: LINE_STYLES[key] || [],
    tension: 0, // straight lines between points, no smoothing
  }));

  return { labels: buildLabels(data), datasets };
}

// Builds a one-sentence summary of the last period, e.g.
// "By 2071-2100, compared with 1976-2005: RCP2.6 +0.73 °C, RCP4.5 +1.47 °C, RCP8.5 +2.71 °C."
// Screen readers read this, because they cannot see the chart.
export function buildSummary(data) {
  const lastPeriod = data.periods[data.periods.length - 1];

  const parts = Object.values(data.scenarios).map((scenario) => {
    const change = Number(scenario.change[scenario.change.length - 1]);
    const sign = change > 0 ? '+' : ''; // negative numbers already have a minus sign
    // "%" sits next to the number; other units get a space ("+2.71 °C")
    const unit = data.change_unit === '%' ? '%' : ` ${data.change_unit}`;
    return `${scenario.label} ${sign}${change}${unit}`;
  });

  return `By ${lastPeriod}, compared with ${data.baseline_period}: ${parts.join(', ')}.`;
}