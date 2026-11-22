// Small helpers for the home page maps. No React here, so they are easy to test.
// The API sends numbers as text ("9.400"), so they are turned into numbers here, for the colours and the averages.

// { slug: number } for every county in an answer of GET /map/. Counties without a usable value are left out.
export function valuesBySlug(answer) {
  const values = {};
  for (const { county, value } of answer?.results ?? []) {
    const number = value === null || value === undefined || value === '' ? NaN : Number(value);
    if (Number.isFinite(number)) values[county.slug] = number;
  }
  return values;
}

// The mean of the county values of an answer, or null when there are none. It is a plain mean of the
// counties (a large county counts the same as a small one), so the maps call it the "county average".
export function countyAverage(answer) {
  const numbers = Object.values(valuesBySlug(answer));
  if (numbers.length === 0) return null;
  return numbers.reduce((sum, number) => sum + number, 0) / numbers.length;
}

// 10.14 -> "10.1 °C" (with a proper minus sign for negative values)
export function formatDegrees(value) {
  return `${value.toFixed(1).replace('-', '−')} °C`;
}
