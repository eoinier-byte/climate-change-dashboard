// Tests for the Compare page's sums and wording (CCD-207): the difference is B minus A, from the stored
// values only. The rows are Cork's mock rows, which have the same shape as the real API's.
import { describe, expect, it } from 'vitest';
import { mockCorkRows } from '../mocks/countyRows';
import {
  compareScenarios,
  formatChange,
  formatDifference,
  formatValue,
  summaryLines,
} from './compareData';

const TEMPERATURE = { variable: 'temperature', unit: '°C', changeUnit: '°C' };
const RAINFALL = { variable: 'precipitation', unit: 'mm', changeUnit: '%' };

// One row in the shape of the API, with only what the helper reads
function row(variable, scenario, period, season, value, change, extra = {}) {
  return {
    variable,
    scenario,
    period,
    season,
    value,
    change,
    units: variable === 'temperature' ? 'degC' : 'mm',
    baseline_value: '10.000',
    ...extra,
  };
}

const find = (measures, variable, season) =>
  measures.find((measure) => measure.variable === variable && measure.season === season);

describe('compareScenarios', () => {
  const measures = compareScenarios(mockCorkRows, 'rcp26', 'rcp85', '2071-2100');

  it('gives temperature then rainfall, the whole year then each season', () => {
    expect(measures.map((measure) => `${measure.variable}/${measure.season}`)).toEqual([
      'temperature/annual',
      'temperature/winter',
      'temperature/spring',
      'temperature/summer',
      'temperature/autumn',
      'precipitation/annual',
      'precipitation/winter',
      'precipitation/spring',
      'precipitation/summer',
      'precipitation/autumn',
    ]);
  });

  it('works out the second scenario minus the first, to the precision the API stores', () => {
    // 12.525 - 10.545 is 1.9800000000000004 in plain arithmetic
    expect(find(measures, 'temperature', 'annual').difference).toBe(1.98);
    expect(find(measures, 'temperature', 'winter').difference).toBe(1.921); // 8.345 - 6.424
    expect(find(measures, 'precipitation', 'annual').difference).toBe(37.9); // 1477.806 - 1439.906
  });

  it('gives a negative difference when the second scenario is lower', () => {
    expect(find(measures, 'precipitation', 'summer').difference).toBe(-29.054); // 229.557 - 258.611
  });

  it('is the opposite sign when the scenarios are swapped', () => {
    const swapped = compareScenarios(mockCorkRows, 'rcp85', 'rcp26', '2071-2100');
    measures.forEach((measure, index) => {
      expect(swapped[index].difference).toBe(-measure.difference);
    });
  });

  it("keeps each scenario's projected value and its change from the baseline, as numbers", () => {
    const annual = find(measures, 'temperature', 'annual');
    expect(annual.a).toEqual({ value: 10.545, change: 0.73 });
    expect(annual.b).toEqual({ value: 12.525, change: 2.71 });
  });

  it('gives the baseline, and the units people see', () => {
    const temperature = find(measures, 'temperature', 'annual');
    expect(temperature.baseline).toBe(9.815);
    expect(temperature.unit).toBe('°C');
    expect(temperature.changeUnit).toBe('°C');

    const rainfall = find(measures, 'precipitation', 'annual');
    expect(rainfall.baseline).toBe(1368.817);
    expect(rainfall.unit).toBe('mm');
    expect(rainfall.changeUnit).toBe('%'); // the API gives rainfall change as a percentage
  });

  it('takes the baseline from the scenario rows when there is no baseline row (the seasons)', () => {
    // The seasonal rows carry baseline_value, and have no baseline row of their own
    expect(mockCorkRows.some((r) => r.scenario === 'baseline' && r.season === 'winter')).toBe(false);
    expect(find(measures, 'precipitation', 'winter').baseline).toBe(433.179);
  });

  it('only has the measures the API has rows for in the chosen period', () => {
    const midCentury = compareScenarios(mockCorkRows, 'rcp26', 'rcp85', '2021-2050');
    expect(midCentury.map((measure) => `${measure.variable}/${measure.season}`)).toEqual([
      'temperature/annual',
      'precipitation/annual',
    ]);
    expect(find(midCentury, 'temperature', 'annual').difference).toBe(0.191); // 10.718 - 10.527
  });

  it('gives null instead of a made-up number when one scenario has no row', () => {
    const rows = [
      row('temperature', 'baseline', '1976-2005', 'annual', '10.000', '0.00'),
      row('temperature', 'rcp26', '2071-2100', 'annual', '10.500', '0.50'),
    ];
    const [measure] = compareScenarios(rows, 'rcp26', 'rcp85', '2071-2100');
    expect(measure.a).toEqual({ value: 10.5, change: 0.5 });
    expect(measure.b).toBeNull();
    expect(measure.difference).toBeNull();
  });

  it('gives nothing when there are no rows', () => {
    expect(compareScenarios([], 'rcp26', 'rcp85', '2071-2100')).toEqual([]);
  });

  it('does not change the rows it is given', () => {
    const copy = JSON.parse(JSON.stringify(mockCorkRows));
    compareScenarios(mockCorkRows, 'rcp26', 'rcp85', '2071-2100');
    expect(mockCorkRows).toEqual(copy);
  });
});

describe('summaryLines', () => {
  const measures = compareScenarios(mockCorkRows, 'rcp26', 'rcp85', '2071-2100');

  it('says in words how much warmer and how much wetter the second scenario is', () => {
    expect(summaryLines(measures, 'RCP2.6', 'RCP8.5', 'Cork')).toEqual([
      'Over the whole year, RCP8.5 is 1.98 °C warmer than RCP2.6 in County Cork.',
      'Over the whole year, RCP8.5 has 38 mm more rain than RCP2.6 in County Cork.',
    ]);
  });

  it('says cooler and drier when the second scenario is lower', () => {
    const lower = compareScenarios(mockCorkRows, 'rcp85', 'rcp26', '2071-2100');
    expect(summaryLines(lower, 'RCP8.5', 'RCP2.6', 'Cork')).toEqual([
      'Over the whole year, RCP2.6 is 1.98 °C cooler than RCP8.5 in County Cork.',
      'Over the whole year, RCP2.6 has 38 mm less rain than RCP8.5 in County Cork.',
    ]);
  });

  it('says so when the two give the same value', () => {
    const rows = [
      row('temperature', 'rcp26', '2071-2100', 'annual', '10.500', '0.50'),
      row('temperature', 'rcp85', '2071-2100', 'annual', '10.501', '0.50'),
    ];
    const same = compareScenarios(rows, 'rcp26', 'rcp85', '2071-2100');
    expect(summaryLines(same, 'RCP2.6', 'RCP8.5', 'Kerry')).toEqual([
      'Over the whole year, RCP2.6 and RCP8.5 give the same temperature in County Kerry.',
    ]);
  });

  it('leaves out a measure that has no difference, and has no lines at all with no data', () => {
    const rows = [row('temperature', 'rcp26', '2071-2100', 'annual', '10.500', '0.50')];
    expect(summaryLines(compareScenarios(rows, 'rcp26', 'rcp85', '2071-2100'), 'RCP2.6', 'RCP8.5', 'Cork')).toEqual([]);
    expect(summaryLines([], 'RCP2.6', 'RCP8.5', 'Cork')).toEqual([]);
  });

  it('only talks about the whole year, not each season', () => {
    expect(summaryLines(measures, 'RCP2.6', 'RCP8.5', 'Cork')).toHaveLength(2);
  });
});

describe('number formats', () => {
  it('shows a value with one decimal for temperature and none for rainfall', () => {
    expect(formatValue(10.545, TEMPERATURE)).toBe('10.5 °C');
    expect(formatValue(1439.906, RAINFALL)).toBe('1,440 mm');
  });

  it('always shows a sign on a change, and a percentage for rainfall', () => {
    expect(formatChange(0.73, TEMPERATURE)).toBe('+0.73 °C');
    expect(formatChange(-0.5, TEMPERATURE)).toBe('-0.50 °C');
    expect(formatChange(5.2, RAINFALL)).toBe('+5.2%');
    expect(formatChange(-10, RAINFALL)).toBe('-10.0%');
  });

  it('always shows a sign on a difference', () => {
    expect(formatDifference(1.98, TEMPERATURE)).toBe('+1.98 °C');
    expect(formatDifference(-29.054, RAINFALL)).toBe('-29 mm');
    expect(formatDifference(37.9, RAINFALL)).toBe('+38 mm');
  });

  it('shows a rounded zero without a sign', () => {
    expect(formatDifference(0.004, TEMPERATURE)).toBe('0 °C');
    expect(formatDifference(-0.2, RAINFALL)).toBe('0 mm');
    expect(formatChange(0, TEMPERATURE)).toBe('0 °C');
  });

  it('says "No data" for a missing number', () => {
    expect(formatValue(null, TEMPERATURE)).toBe('No data');
    expect(formatChange(null, RAINFALL)).toBe('No data');
    expect(formatDifference(null, RAINFALL)).toBe('No data');
  });
});
