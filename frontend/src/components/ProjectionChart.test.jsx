// Tests for the projection chart (CCD-161 / CCD-168).
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProjectionChart from './ProjectionChart';
import { buildChartData, buildLabels, buildSummary } from './chartData';
import { mockPrecipitation, mockTemperature } from '../mocks/projections';
import { SCENARIO_COLORS } from '../styles/scenarioColors';

// The test browser (jsdom) cannot draw on a <canvas>, so swap the real chart
// for a simple placeholder. The tests check our data, not Chart.js itself.
vi.mock('react-chartjs-2', () => ({
  Line: (props) => <div data-testid="line-chart" aria-label={props['aria-label']} />,
}));

describe('buildChartData', () => {
  it('puts the baseline first, then each period', () => {
    expect(buildLabels(mockTemperature)).toEqual(['1976-2005 (baseline)', '2021-2050', '2071-2100']);
  });

  it('makes one line per scenario with the shared scenario colours', () => {
    const { datasets } = buildChartData(mockTemperature);
    expect(datasets.map((d) => d.label)).toEqual(['RCP2.6', 'RCP4.5', 'RCP8.5']);
    expect(datasets[2].borderColor).toBe(SCENARIO_COLORS.rcp85);
  });

  it('turns the API strings into numbers', () => {
    const { datasets } = buildChartData(mockTemperature);
    expect(datasets[0].data).toEqual([9.815, 10.527, 10.545]);
  });
});

describe('buildSummary', () => {
  it('describes the temperature change in °C', () => {
    expect(buildSummary(mockTemperature)).toBe(
      'By 2071-2100, compared with 1976-2005: RCP2.6 +0.73 °C, RCP4.5 +1.47 °C, RCP8.5 +2.71 °C.',
    );
  });

  it('describes the precipitation change in %', () => {
    expect(buildSummary(mockPrecipitation)).toContain('RCP8.5 +8%');
  });
});

describe('ProjectionChart', () => {
  it('shows the chart, the summary and the source', () => {
    render(<ProjectionChart data={mockTemperature} />);
    expect(screen.getByTestId('line-chart').getAttribute('aria-label')).toBe(
      'Temperature in Cork (annual), °C',
    );
    expect(screen.getByText(/RCP8.5 \+2.71 °C/)).toBeTruthy();
    expect(screen.getByText(/Source: Climate Ireland TRANSLATE/)).toBeTruthy();
  });

  it('shows a message instead of an empty chart when there is no data', () => {
    render(<ProjectionChart data={{ ...mockTemperature, scenarios: {} }} />);
    expect(screen.getByText('No projection data is available for this selection.')).toBeTruthy();
  });
});