// Tests for the county dashboard helpers (CCD-149).
import { describe, expect, it } from 'vitest';
import { buildSeries, seasonalRows } from './countyChartData';
import { mockCorkRows } from '../mocks/countyRows';
import { mockTemperature, mockPrecipitation } from '../mocks/projections';

describe('buildSeries', () => {
  it('builds the same temperature series the chart mock uses', () => {
    const series = buildSeries(mockCorkRows, 'Cork', 'temperature');

    expect(series.county).toBe('Cork');
    expect(series.unit).toBe('°C');
    expect(series.change_unit).toBe('°C');
    expect(series.baseline_period).toBe('1976-2005');
    expect(series.periods).toEqual(['2021-2050', '2071-2100']);
    // Same values and changes as the hand-written mock in mocks/projections.js
    expect(series.scenarios.rcp45.values).toEqual(mockTemperature.scenarios.rcp45.values);
    expect(series.scenarios.rcp85.change).toEqual(mockTemperature.scenarios.rcp85.change);
  });

  it('shows rainfall change in % and keeps the unit in mm', () => {
    const series = buildSeries(mockCorkRows, 'Cork', 'precipitation');

    expect(series.unit).toBe('mm');
    expect(series.change_unit).toBe('%');
    expect(series.scenarios.rcp26.values).toEqual(mockPrecipitation.scenarios.rcp26.values);
  });

  it('gives the scenarios in order with their labels', () => {
    const series = buildSeries(mockCorkRows, 'Cork', 'temperature');
    const labels = Object.values(series.scenarios).map((s) => s.label);
    expect(labels).toEqual(['RCP2.6', 'RCP4.5', 'RCP8.5']);
  });

  it('uses a readable source name', () => {
    expect(buildSeries(mockCorkRows, 'Cork', 'temperature').source).toBe('Climate Ireland TRANSLATE');
  });

  it('returns null when there is no baseline row', () => {
    const noBaseline = mockCorkRows.filter((row) => row.scenario !== 'baseline');
    expect(buildSeries(noBaseline, 'Cork', 'temperature')).toBeNull();
  });

  it('leaves a gap (null) when a scenario row is missing', () => {
    const missing = mockCorkRows.filter(
      (row) => !(row.variable === 'temperature' && row.scenario === 'rcp26' && row.period === '2071-2100'),
    );
    const series = buildSeries(missing, 'Cork', 'temperature');
    expect(series.scenarios.rcp26.values[2]).toBeNull();
  });
});

describe('seasonalRows', () => {
  it('keeps only the 12 seasonal rainfall rows for 2071-2100', () => {
    const rows = seasonalRows(mockCorkRows);

    expect(rows).toHaveLength(12); // 3 scenarios x 4 seasons
    rows.forEach((row) => {
      expect(row.variable).toBe('precipitation');
      expect(row.period).toBe('2071-2100');
      expect(row.season).not.toBe('annual');
      expect(row.scenario).not.toBe('baseline');
    });
  });

  it('can pick the seasonal temperature rows instead (CCD-157)', () => {
    const rows = seasonalRows(mockCorkRows, 'temperature');

    expect(rows).toHaveLength(12);
    rows.forEach((row) => expect(row.variable).toBe('temperature'));
  });
});