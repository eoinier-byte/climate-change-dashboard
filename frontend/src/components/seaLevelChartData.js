// Helper functions for the sea-level chart (CCD-407).
// They take one response from GET /api/sea-level/{slug}/ and turn it into what the chart needs.
// Kept separate from the component so they are easy to test.
import { ALL_SCENARIOS, SCENARIO_COLORS, SCENARIO_LABELS } from '../styles/scenarioColors';
import { LINE_STYLES } from './chartData';

// True when there is something to draw: a coastal county with at least one series
export function hasSeaLevelData(data) {
  return Boolean(data && data.has_coastline && data.series && Object.keys(data.series).length > 0);
}

// The scenarios to draw: those in the data AND ticked in "Show scenarios" (CCD-158, CCD-165),
// in the usual order (RCP2.6, RCP4.5, RCP8.5)
function scenariosToShow(data, selected) {
  return ALL_SCENARIOS.filter((scenario) => data.series[scenario] && selected.includes(scenario));
}

// Builds the { labels, datasets } object that Chart.js expects.
// Labels are the years (2020, 2030 ... 2100); one line per scenario.
export function buildSeaLevelChartData(data, selected = ALL_SCENARIOS) {
  const datasets = scenariosToShow(data, selected).map((scenario) => ({
    label: SCENARIO_LABELS[scenario],
    // The API sends numbers as strings, so turn each one into a real number
    data: data.series[scenario].values.map((value) => Number(value)),
    borderColor: SCENARIO_COLORS[scenario],
    backgroundColor: SCENARIO_COLORS[scenario],
    borderDash: LINE_STYLES[scenario] || [], // solid, dashed, dotted: colour is not the only cue
    tension: 0, // straight lines between points, no smoothing
  }));

  return { labels: data.years.map(String), datasets };
}

// Builds a one-sentence summary of the last year, e.g.
// "By 2100, compared with 1981-2000: RCP2.6 +42.7 cm, RCP4.5 +52.7 cm, RCP8.5 +75.4 cm."
// Screen readers read this, because they cannot see the chart.
export function buildSeaLevelSummary(data, selected = ALL_SCENARIOS) {
  const lastIndex = data.years.length - 1;
  const lastYear = data.years[lastIndex];

  const parts = scenariosToShow(data, selected).map((scenario) => {
    // One decimal place is plenty for centimetres
    const rise = Number(data.series[scenario].values[lastIndex]).toFixed(1);
    const sign = Number(rise) > 0 ? '+' : ''; // a fall would already have a minus sign
    return `${SCENARIO_LABELS[scenario]} ${sign}${rise} ${data.unit}`;
  });

  return `By ${lastYear}, compared with ${data.baseline_period}: ${parts.join(', ')}.`;
}