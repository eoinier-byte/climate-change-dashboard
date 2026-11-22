// The year slider on the home page maps. The data has three 30-year averages, not a value for every year, so
// each one is placed at the middle of its 30 years: 1976-2005 at 1990, 2021-2050 at 2035 and 2071-2100 at 2085.
// Between two of them the maps blend the two colours smoothly, so the slider moves gradually. No React here.
// No climate figure is worked out from the blend: the numbers shown are always the nearest average's own.

export const YEAR_MIN = 1990;
export const YEAR_MAX = 2085;
export const SNAPSHOT_YEARS = [1990, 2035, 2085]; // the middle year of each period, in order

// Keeps a year on the slider (whole years from 1990 to 2085)
export function clampYear(year) {
  return Math.min(YEAR_MAX, Math.max(YEAR_MIN, Math.round(year)));
}

// Which two averages a year sits between, and how far along: { lower, upper, fraction, nearest }.
// lower and upper are positions in SNAPSHOT_YEARS (0 to 2), fraction runs from 0 (at lower) to 1 (at upper).
// At an exact snapshot year lower and upper are the same.
export function blendAt(year) {
  const clamped = Math.min(YEAR_MAX, Math.max(YEAR_MIN, year));
  const upper = SNAPSHOT_YEARS.findIndex((snapshot) => snapshot >= clamped);
  if (SNAPSHOT_YEARS[upper] === clamped) return { lower: upper, upper, fraction: 0, nearest: upper };
  const lower = upper - 1;
  const fraction = (clamped - SNAPSHOT_YEARS[lower]) / (SNAPSHOT_YEARS[upper] - SNAPSHOT_YEARS[lower]);
  return { lower, upper, fraction, nearest: fraction < 0.5 ? lower : upper };
}
