// Helper functions that turn one projections API response into what the chart needs.
// Kept separate from the component so they are easy to test.
import { SCENARIO_COLORS } from '../styles/scenarioColors';

// Line style per scenario, so colour is not the only way to tell them apart.
// Exported so the sea-level chart (CCD-407) draws its lines the same way.
export const LINE_STYLES = {
  rcp26: [], // solid
  rcp45: [8, 4], // dashed
  rcp85: [2, 3], // dotted
};

// Builds the labels along the bottom of the chart:
// the baseline period first, then each future period
export function buildLabels(data) {
  return [`${data.baseline_period} (baseline)`, ...data.periods];
}

// Below this chart width (in pixels), the baseline label is shortened (CCD-180),
// e.g. on a 375 px phone screen
export const NARROW_CHART_PX = 500;

// On a narrow chart, "1976-2005 (baseline)" is too long and gets cut off at the left edge,
// so it becomes just "1976-2005". The card's subtitle already says the lines start at the baseline.
// Other labels, and wider charts, are left as they are.
export function shortenLabel(label, chartWidth) {
  if (chartWidth < NARROW_CHART_PX) {
    return label.replace(' (baseline)', '');
  }
  return label;
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