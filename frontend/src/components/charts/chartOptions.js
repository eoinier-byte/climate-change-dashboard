// Shared Chart.js settings for every chart on the site (CCD-160, CCD-167),
// so all charts use the same font, text colour, legend and tooltip format.
// Each chart calls buildChartOptions() instead of writing its own settings.
import { Chart as ChartJS } from 'chart.js';

// Chart.js draws on a <canvas>, which can't read CSS variables,
// so these copy theme.css. Keep them the same as --font-body and --color-text-muted.
// theme.test.js checks they match, so the test fails if one is changed without the other.
export const FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
export const TEXT_COLOR = '#4a5a53';

// Set once for every chart: the site's font, and muted text for axes and legends
ChartJS.defaults.font.family = FONT_FAMILY;
ChartJS.defaults.color = TEXT_COLOR;

// Writes a number with its unit, the same way everywhere:
// "%" sits next to the number ("+5.2%"); other units get a space ("10.53 °C", "42.70 cm").
// Rounded to 2 decimal places, so tooltips don't show long numbers like 10.527000001.
export function formatValue(value, unit) {
  const rounded = Number(Number(value).toFixed(2));
  if (!unit) return `${rounded}`;
  return unit === '%' ? `${rounded}%` : `${rounded} ${unit}`;
}

// The text in the box that appears when you hover over a point or bar,
// e.g. "RCP4.5: 11.28 °C". Kept separate so it can be tested.
export function tooltipLabel(context, unit) {
  return `${context.dataset.label}: ${formatValue(context.parsed.y, unit)}`;
}

// Builds the Chart.js "options" object.
//   yTitle - text on the side axis, e.g. "°C" or "% change from 1976-2005"
//   unit   - unit shown in the tooltip, e.g. "°C", "%", "mm" or "cm"
// The chart's title is shown by ChartCard above the chart (as real text people and
// screen readers can read), so Chart.js's own title is turned off.
export function buildChartOptions({ yTitle, unit }) {
  return {
    // responsive: redraw the chart whenever its box changes size (phone <-> laptop).
    // maintainAspectRatio: false: fill the box's height from charts.css, instead of keeping
    // a fixed width:height shape. Without it, charts squash on phones and can stay the
    // wrong size after the window is resized (CCD-180).
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: { display: false },
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (context) => tooltipLabel(context, unit),
        },
      },
    },
    scales: {
      y: { title: { display: true, text: yTitle } },
    },
  };
}