// The colours of the home page maps and the warming stripes: pale orange for the coolest value to dark red
// for the warmest, blended smoothly. No React here, so it is easy to test.
// Red here means "warmer", not a scenario: the scenario colours (green, amber, red) are only used for scenarios.
// Colour is never the only way to read a value: the legend gives the numbers at both ends, and every county's
// value is in its tooltip and its screen reader label.

export const WARM_RAMP = ['#fff4e0', '#fdd49e', '#fc9b5f', '#e5562f', '#b51f24', '#6b0d17'];

// "#fdd49e" -> [253, 212, 158]
function toRgb(hex) {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

// A colour part of the way from colour a to colour b (t from 0 to 1), e.g. mixColours('#000000', '#ffffff', 0.5)
export function mixColours(a, b, t) {
  const from = toRgb(a);
  const to = toRgb(b);
  const parts = from.map((value, index) => Math.round(value + (to[index] - value) * t));
  return `#${parts.map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

// The colour for a value on a scale from min to max. Values outside it take the nearest end colour.
export function warmColour(value, min, max) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return WARM_RAMP[0];
  const position = Math.max(0, Math.min(1, (value - min) / (max - min))) * (WARM_RAMP.length - 1);
  const index = Math.min(WARM_RAMP.length - 2, Math.floor(position));
  return mixColours(WARM_RAMP[index], WARM_RAMP[index + 1], position - index);
}

// The same colours as a CSS gradient, for the legend bar
export const WARM_GRADIENT = `linear-gradient(to right, ${WARM_RAMP.join(', ')})`;

// The ends of the shared scale, rounded outwards to the nearest half degree so the legend reads cleanly.
// Gives null when there is no usable range.
export function legendRange(range) {
  if (!range || !range.every(Number.isFinite) || range[1] <= range[0]) return null;
  return [Math.floor(range[0] * 2) / 2, Math.ceil(range[1] * 2) / 2];
}
