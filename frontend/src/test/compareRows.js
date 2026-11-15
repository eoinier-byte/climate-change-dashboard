// Test helper (CCD-378): Kerry's projection rows for the Compare tests, so two counties have different numbers.
// They are Cork's mock rows with every value one higher and each future temperature change 0.4 °C higher.
// Rainfall changes stay the same. Only for tests: the app itself never imports this file.
import { mockCorkRows } from '../mocks/countyRows';

export function kerryRows() {
  return mockCorkRows.map((row) => ({
    ...row,
    county: 'kerry',
    value: (Number(row.value) + 1).toFixed(3),
    baseline_value: (Number(row.baseline_value) + 1).toFixed(3),
    change:
      row.variable === 'temperature' && row.scenario !== 'baseline'
        ? (Number(row.change) + 0.4).toFixed(2)
        : row.change,
  }));
}
