// Turning a sea-level projection into a flood map level (CCD-377).
//
// The two endpoints measure from different starting points:
//   GET /sea-level/{slug}/  cm above the 1981–2000 average, every 10 years from 2020 to 2100
//   GET /flood/{slug}/      metres above TODAY's sea level, 0 to 2 m in 0.1 m steps
// So "today" is taken as the first projection (2020), and the rise by a year is that year's
// value minus the 2020 value (Taras's note in docs/api.md, Flood maps).

// How many cm the sea is projected to rise above today by "year" under "scenario",
// e.g. riseAboveToday(cork, 'rcp45', 2100) -> 43.1. Gives null if that scenario or year is missing.
export function riseAboveToday(seaLevel, scenario, year) {
  const values = seaLevel?.series?.[scenario]?.values;
  const index = seaLevel?.years?.indexOf(year) ?? -1;
  if (!values || index < 0) return null;
  // The values come as strings, e.g. "52.676", so turn them into numbers first
  return Number(values[index]) - Number(values[0]);
}

// The flood level closest to a rise in cm, as a slider position: 0 = 0 m, 1 = 0.1 m, ...
// e.g. 43 cm -> 4 (0.4 m), 65 cm -> 7 (0.7 m). Never below 0 or above the top level.
export function levelIndexForRise(riseCm, levelCount) {
  const index = Math.round(riseCm / 10); // 10 cm per step
  return Math.min(Math.max(index, 0), levelCount - 1);
}