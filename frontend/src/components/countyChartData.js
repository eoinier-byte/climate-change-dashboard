// Helper functions for the county dashboard (CCD-149).
// The projections API (GET /api/projections/?county=cork) sends a flat list of rows,
// one row per variable, scenario, period and season. These functions pick out the
// rows each chart needs and put them in the shape the charts expect.
// Kept separate from the page so they are easy to test.
import { SCENARIO_LABELS } from '../styles/scenarioColors';

// The future scenarios, from lowest to highest emissions
const SCENARIOS = ['rcp26', 'rcp45', 'rcp85'];

// The API sends unit codes; these are the symbols people should see
export const UNIT_LABELS = {
  degC: '°C',
  mm: 'mm',
};

// The API only sends the source's short code, so map it to a readable name
const SOURCE_NAMES = {
  translate: 'Climate Ireland TRANSLATE',
};

// The period the seasonal rainfall chart shows (the end of the century)
export const SEASONAL_PERIOD = '2071-2100';

// Turns the list of rows into the object ProjectionChart expects (see mocks/projections.js),
// for one variable and one season, e.g. annual temperature.
// Returns null if there is no baseline row, because then there is nothing to compare with.
export function buildSeries(rows, countyName, variable, season = 'annual') {
  // Only the rows for this variable and season
  const picked = rows.filter((row) => row.variable === variable && row.season === season);

  // The baseline row holds the present-day value (1976-2005)
  const baseline = picked.find((row) => row.scenario === 'baseline');
  if (!baseline) return null;

  // The future periods, oldest first, e.g. ['2021-2050', '2071-2100'].
  // new Set(...) removes duplicates, because each period appears once per scenario.
  const futureRows = picked.filter((row) => row.scenario !== 'baseline');
  const periods = [...new Set(futureRows.map((row) => row.period))].sort();

  // One entry per scenario. "values" and "change" start with the baseline,
  // then have one entry per future period (the same layout as the mock data).
  const scenarios = {};
  SCENARIOS.forEach((scenario) => {
    const values = [baseline.value];
    const change = [0];

    periods.forEach((period) => {
      const row = futureRows.find((r) => r.scenario === scenario && r.period === period);
      // A missing row becomes null, so the chart leaves a gap instead of drawing 0
      values.push(row ? row.value : null);
      change.push(row ? row.change : null);
    });

    scenarios[scenario] = { label: SCENARIO_LABELS[scenario], values, change };
  });

  const unit = UNIT_LABELS[baseline.units] || baseline.units;

  return {
    county: countyName,
    variable,
    season,
    unit,
    // The backend works out rainfall change in %, and temperature change in °C
    change_unit: variable === 'precipitation' ? '%' : unit,
    baseline_period: baseline.baseline_period,
    periods,
    scenarios,
    source: SOURCE_NAMES[baseline.source] || baseline.source,
  };
}

// The rows SeasonalChart needs: rainfall for each season in one future period.
// The baseline rows are left out because SeasonalChart only shows the scenarios.
export function seasonalRows(rows, period = SEASONAL_PERIOD) {
  return rows.filter(
    (row) =>
      row.variable === 'precipitation' &&
      row.period === period &&
      row.season !== 'annual' &&
      row.scenario !== 'baseline',
  );
}