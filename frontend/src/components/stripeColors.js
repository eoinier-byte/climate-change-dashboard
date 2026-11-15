// Colours and rows for the warming stripes (CCD-391).
// All the number work lives here, so WarmingStripes.jsx only draws what it is given
// and this file is easy to test.

// The usual warming-stripes colours, from the coolest value (blue) to the warmest (red).
// Plain colours, not CSS variables, because the stripes are worked out here in JavaScript.
// NOTE: red here means "warmer", not the RCP8.5 scenario. Each row is named in text.
export const STRIPE_RAMP = ['#2166ac', '#67a9cf', '#d1e5f0', '#f7f7f7', '#fddbc7', '#ef8a62', '#b2182b'];

// "#2166ac" -> [33, 102, 172]
function hexToRgb(hex) {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

// [33, 102, 172] -> "#2166ac"
function rgbToHex(rgb) {
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

// The colour for one value, given the coolest (min) and warmest (max) value being shown.
// min gets the first blue, max gets the last red, values between get a mix of the two nearest colours.
export function stripeColor(value, min, max) {
  const last = STRIPE_RAMP.length - 1;
  // If every value is the same there is no range, so use the middle colour
  const position = max === min ? last / 2 : Math.min(Math.max((value - min) / (max - min), 0), 1) * last;

  const lower = Math.floor(position);
  const upper = Math.min(lower + 1, last);
  const share = position - lower;

  const from = hexToRgb(STRIPE_RAMP[lower]);
  const to = hexToRgb(STRIPE_RAMP[upper]);
  return rgbToHex(from.map((channel, i) => channel + (to[i] - channel) * share));
}

// Turns a temperature series from buildSeries() into what WarmingStripes draws.
//   series   - the UNFILTERED series, so colours do not change when a scenario is ticked or unticked
//   selected - the scenarios ticked on the page, e.g. ['rcp26', 'rcp85']
// Returns null when there is no series. Otherwise:
//   { county, unit, source, periods: [...], range: { min, max, minText, maxText }, rows: [{ key, label, stripes }] }
// Each stripe is { period, text, color }. color is null when the API had no value for that period.
export function buildStripes(series, selected) {
  if (!series) return null;

  // Every period, oldest first: the baseline, then the future periods
  const periods = [series.baseline_period, ...series.periods];
  const unit = series.unit;

  const entries = Object.entries(series.scenarios);
  const allValues = entries
    .flatMap(([, scenario]) => scenario.values)
    .filter((value) => value !== null)
    .map(Number);
  if (allValues.length === 0) return null;

  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const show = (number) => `${number.toFixed(1)} ${unit}`;

  const rows = entries
    .filter(([key]) => selected.includes(key))
    .map(([key, scenario]) => ({
      key,
      label: scenario.label,
      stripes: periods.map((period, i) => {
        const value = scenario.values[i];
        if (value === null || value === undefined) return { period, text: 'no data', color: null };
        return { period, text: show(Number(value)), color: stripeColor(Number(value), min, max) };
      }),
    }));

  return {
    county: series.county,
    unit,
    source: series.source,
    periods,
    range: { min, max, minText: show(min), maxText: show(max) },
    rows,
  };
}

