// Colours and wording for the county map (CCD-381). No React here, so it is easy to test.
// d3-scale does the sums that turn a value into a colour; this file decides which colours and words.
//
// The values are split into 7 equal steps between the lowest and highest county. Steps (not a smooth
// blend) make the legend easy to read and mean two counties in the same step share a colour.
// Colour is never the only way to read the map: the legend gives the number range for each colour,
// and the county tooltip (CCD-382) gives the exact number.
import { scaleQuantize } from 'd3-scale';
import { SCENARIO_LABELS } from '../styles/scenarioColors';

// Cooler to warmer (blue, pale yellow, red). 7 steps. Red here means "warmer", not a scenario:
// the scenario colours (green, amber, red) are only used for scenarios.
export const TEMPERATURE_RAMP = ['#4575b4', '#91bfdb', '#e0f3f8', '#ffffbf', '#fee090', '#fc8d59', '#d73027'];

// Drier to wetter (pale to dark purple). Purple, so it is never mistaken for the temperature colours
export const PRECIPITATION_RAMP = ['#f2f0f7', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#4a1486'];

export const RAMPS = { temperature: TEMPERATURE_RAMP, precipitation: PRECIPITATION_RAMP };

// A county with no value. The same pale grey as the plain outlines (MapView.jsx).
export const NO_DATA_COLOUR = '#dfe6e2';

const VARIABLE_NAMES = { temperature: 'Average temperature', precipitation: 'Rainfall' };
const SEASON_NAMES = {
  annual: 'whole year',
  spring: 'spring',
  summer: 'summer',
  autumn: 'autumn',
  winter: 'winter',
};
const UNIT_LABELS = { degC: '°C', mm: 'mm' };
const DEFAULT_UNITS = { temperature: 'degC', precipitation: 'mm' };

const EN_DASH = '–';

// "2071-2100" -> "2071–2100"
function periodText(period) {
  return period.replace('-', EN_DASH);
}

// The legend title for one choice, e.g. "Average temperature, whole year, RCP8.5, 2071–2100 (°C)"
export function describeChoice({ variable, scenario, period, season, unit }) {
  const unitLabel = UNIT_LABELS[unit ?? DEFAULT_UNITS[variable]] ?? unit ?? '';
  const scenarioText = scenario === 'baseline' ? 'Baseline' : (SCENARIO_LABELS[scenario] ?? scenario);
  const parts = [
    VARIABLE_NAMES[variable] ?? variable,
    SEASON_NAMES[season] ?? season,
    scenarioText,
    periodText(period),
  ];
  return `${parts.join(', ')}${unitLabel ? ` (${unitLabel})` : ''}`;
}

// A number for the legend: whole numbers for rain, one decimal for temperature, and two decimals
// when the steps are so small that one decimal would repeat (e.g. 9.4 to 9.4)
export function formatValue(value, variable, step) {
  const decimals = variable === 'precipitation' ? 0 : step < 0.1 ? 2 : 1;
  return value.toFixed(decimals).replace('-', '−');
}

// One county's value for a tooltip, with its unit: "11.2 °C" or "1,369 mm" (as on the county page)
export function formatCountyValue(value, variable, unit) {
  const unitLabel = UNIT_LABELS[unit ?? DEFAULT_UNITS[variable]] ?? unit ?? '';
  const text =
    variable === 'precipitation'
      ? Math.round(value).toLocaleString('en-IE')
      : value.toFixed(1).replace('-', '\u2212');
  return unitLabel ? `${text} ${unitLabel}` : text;
}

// What the tooltip and the screen reader say about one county, e.g. "Cork: 11.2 °C".
// Before the values arrive it is just the name. "colours" is what buildMapColours gave back (or null).
export function countyLabel(name, slug, colours, variable, unit) {
  if (!colours) return name;
  const value = colours.valueFor(slug);
  if (value === undefined) return `${name}: no value`;
  return `${name}: ${formatCountyValue(value, variable, unit)}`;
}

// The API sends numbers as text ("9.400"). Anything that is not a number gives NaN.
function toNumber(value) {
  return value === null || value === undefined || value === '' ? NaN : Number(value);
}

// Everything the map needs to colour itself and draw its legend, from the answer of GET /map/.
// "slugs" are the counties on the map. Returns null until the answer has arrived.
//   colourFor(slug) - the colour for a county ('' value gives NO_DATA_COLOUR)
//   bins            - [{ colour, from, to, label }] for the legend, lowest first
//   valueFor(slug)  - the county's value as a number, or undefined when it has none (for the tooltip)
//   missing         - how many of the counties have no value
//   hasValues       - false when the answer has no results (e.g. an unknown choice has no rows)
export function buildMapColours(answer, slugs) {
  if (!answer) return null;

  const valueBySlug = {};
  for (const { county, value } of answer.results ?? []) {
    const number = toNumber(value);
    if (!Number.isNaN(number)) valueBySlug[county.slug] = number;
  }
  const numbers = Object.values(valueBySlug);
  const missing = slugs.filter((slug) => valueBySlug[slug] === undefined).length;

  if (numbers.length === 0) {
    return { colourFor: () => NO_DATA_COLOUR, valueFor: () => undefined, bins: [], missing, hasValues: false };
  }

  // The API gives the lowest and highest value; use them so the colours match across a choice.
  // If they are missing, take them from the counties.
  const min = Number.isNaN(toNumber(answer.min)) ? Math.min(...numbers) : toNumber(answer.min);
  const max = Number.isNaN(toNumber(answer.max)) ? Math.max(...numbers) : toNumber(answer.max);
  const ramp = RAMPS[answer.variable] ?? TEMPERATURE_RAMP;
  const middle = ramp[Math.floor(ramp.length / 2)];

  // Every county has the same value: nothing to tell apart, so one middle colour and one legend step
  if (!(max > min)) {
    const label = formatValue(min, answer.variable, 1);
    return {
      colourFor: (slug) => (valueBySlug[slug] === undefined ? NO_DATA_COLOUR : middle),
      valueFor: (slug) => valueBySlug[slug],
      bins: [{ colour: middle, from: min, to: max, label }],
      missing,
      hasValues: true,
    };
  }

  const scale = scaleQuantize().domain([min, max]).range(ramp);
  const edges = [min, ...scale.thresholds(), max];
  const step = (max - min) / ramp.length;
  const bins = ramp.map((colour, index) => ({
    colour,
    from: edges[index],
    to: edges[index + 1],
    label: `${formatValue(edges[index], answer.variable, step)}${EN_DASH}${formatValue(edges[index + 1], answer.variable, step)}`,
  }));

  return {
    colourFor: (slug) => (valueBySlug[slug] === undefined ? NO_DATA_COLOUR : scale(valueBySlug[slug])),
    valueFor: (slug) => valueBySlug[slug],
    bins,
    missing,
    hasValues: true,
  };
}
