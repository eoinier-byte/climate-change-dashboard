// Tests for the seasonal precipitation chart (CCD-162).
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SeasonalChart from './SeasonalChart';
import { buildSeasonalChartData, buildSeasonalSummary } from './seasonalChartData';
import { mockPrecipitationSeasonal, mockTemperatureSeasonal } from '../mocks/projections';
import { SCENARIO_COLORS } from '../styles/scenarioColors';

// The test browser (jsdom) cannot draw on a <canvas>, so swap the real bar chart
// for a simple placeholder. It copies the side (y) axis title into data-y-title
// so a test can check it.
vi.mock('react-chartjs-2', () => ({
  Bar: (props) => (
    <div
      data-testid="bar-chart"
      aria-label={props['aria-label']}
      data-y-title={props.options.scales.y.title.text}
    />
  ),
}));

describe('buildSeasonalChartData', () => {
  it('puts the seasons in calendar order', () => {
    const { labels } = buildSeasonalChartData(mockPrecipitationSeasonal);
    expect(labels).toEqual(['Winter', 'Spring', 'Summer', 'Autumn']);
  });

  it('makes one set of bars per scenario with the shared colours', () => {
    const { datasets } = buildSeasonalChartData(mockPrecipitationSeasonal);
    expect(datasets.map((d) => d.label)).toEqual(['RCP2.6', 'RCP4.5', 'RCP8.5']);
    expect(datasets[2].backgroundColor).toBe(SCENARIO_COLORS.rcp85);
  });

  it('turns the % change strings into numbers, season by season', () => {
    const { datasets } = buildSeasonalChartData(mockPrecipitationSeasonal);
    // RCP8.5: Winter, Spring, Summer, Autumn
    expect(datasets[2].data).toEqual([22.1, 5.6, -10, 5.8]);
  });

  it('leaves a gap (null) when a season is missing', () => {
    const withoutSummer = mockPrecipitationSeasonal.filter((row) => row.season !== 'summer');
    const { datasets } = buildSeasonalChartData(withoutSummer);
    expect(datasets[2].data).toEqual([22.1, 5.6, null, 5.8]);
  });
});

describe('buildSeasonalSummary', () => {
  it('describes each season and says which get wetter or drier', () => {
    expect(buildSeasonalSummary(mockPrecipitationSeasonal)).toBe(
      'Under RCP8.5, by 2071-2100 compared with 1976-2005: Winter +22.1%, Spring +5.6%, Summer -10%, Autumn +5.8%.' +
        ' Wetter: Winter, Spring, Autumn. Drier: Summer.',
    );
  });

  it('can describe another scenario', () => {
    expect(buildSeasonalSummary(mockPrecipitationSeasonal, 'rcp26')).toContain('Winter +10.5%');
  });

  it('describes temperature in °C and says which season warms the most (CCD-157)', () => {
    expect(buildSeasonalSummary(mockTemperatureSeasonal)).toBe(
      'Under RCP8.5, by 2071-2100 compared with 1976-2005: Winter +2.63 °C, Spring +1.93 °C, Summer +2.81 °C, Autumn +3.43 °C.' +
        ' Biggest rise: Autumn.',
    );
  });
});

describe('SeasonalChart', () => {
  it('shows the chart, the summary and the source', () => {
    render(<SeasonalChart rows={mockPrecipitationSeasonal} countyName="Cork" />);
    const chart = screen.getByTestId('bar-chart');

    expect(chart.getAttribute('aria-label')).toBe('Change in precipitation by season in Cork, 2071-2100 (%)');
    expect(chart.getAttribute('data-y-title')).toBe('% change from 1976-2005');
    expect(screen.getByText(/Drier: Summer/)).toBeTruthy();
    expect(screen.getByText(/Source: Climate Ireland TRANSLATE/)).toBeTruthy();
  });

  it('uses a temperature title and a °C axis for temperature rows (CCD-157)', () => {
    render(<SeasonalChart rows={mockTemperatureSeasonal} countyName="Cork" />);
    const chart = screen.getByTestId('bar-chart');

    expect(chart.getAttribute('aria-label')).toBe('Change in temperature by season in Cork, 2071-2100 (°C)');
    expect(chart.getAttribute('data-y-title')).toBe('°C change from 1976-2005');
    expect(screen.getByText(/Biggest rise: Autumn/)).toBeTruthy();
  });

  it('shows a message instead of an empty chart when there is no data', () => {
    render(<SeasonalChart rows={[]} countyName="Cork" />);
    expect(screen.getByText('No seasonal data is available for this selection.')).toBeTruthy();
  });
});