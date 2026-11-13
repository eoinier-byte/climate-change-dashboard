// Tests for the sea-level chart (CCD-407).
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SeaLevelChart from './SeaLevelChart';
import { buildSeaLevelChartData, buildSeaLevelSummary, hasSeaLevelData } from './seaLevelChartData';
import { mockSeaLevelCork, mockSeaLevelInland } from '../mocks/seaLevel';
import { SCENARIO_COLORS } from '../styles/scenarioColors';

// The test browser (jsdom) cannot draw on a <canvas>, so swap the real line chart
// for a simple placeholder. It copies the side (y) axis title into data-y-title
// so a test can check it.
vi.mock('react-chartjs-2', () => ({
  Line: (props) => (
    <div
      data-testid="line-chart"
      aria-label={props['aria-label']}
      data-y-title={props.options.scales.y.title.text}
    />
  ),
}));

describe('buildSeaLevelChartData', () => {
  it('puts the years along the bottom', () => {
    const { labels } = buildSeaLevelChartData(mockSeaLevelCork);
    expect(labels).toEqual(['2020', '2030', '2040', '2050', '2060', '2070', '2080', '2090', '2100']);
  });

  it('makes one line per scenario, with the shared colours and line styles', () => {
    const { datasets } = buildSeaLevelChartData(mockSeaLevelCork);
    expect(datasets.map((d) => d.label)).toEqual(['RCP2.6', 'RCP4.5', 'RCP8.5']);
    expect(datasets[2].borderColor).toBe(SCENARIO_COLORS.rcp85);
    expect(datasets[1].borderDash).toEqual([8, 4]); // RCP4.5 is dashed, as on the other charts
  });

  it('turns the value strings into numbers', () => {
    const { datasets } = buildSeaLevelChartData(mockSeaLevelCork);
    expect(datasets[2].data[8]).toBe(75.404); // RCP8.5 in 2100
  });

  it('only draws the ticked scenarios (CCD-158, CCD-165)', () => {
    const { datasets } = buildSeaLevelChartData(mockSeaLevelCork, ['rcp26', 'rcp85']);
    expect(datasets.map((d) => d.label)).toEqual(['RCP2.6', 'RCP8.5']);
  });
});

describe('buildSeaLevelSummary', () => {
  it('gives the rise by 2100 for each scenario', () => {
    expect(buildSeaLevelSummary(mockSeaLevelCork)).toBe(
      'By 2100, compared with 1981-2000: RCP2.6 +42.7 cm, RCP4.5 +52.7 cm, RCP8.5 +75.4 cm.',
    );
  });

  it('leaves out hidden scenarios', () => {
    expect(buildSeaLevelSummary(mockSeaLevelCork, ['rcp45'])).toBe('By 2100, compared with 1981-2000: RCP4.5 +52.7 cm.');
  });
});

describe('hasSeaLevelData', () => {
  it('is true for a coastal county with data', () => {
    expect(hasSeaLevelData(mockSeaLevelCork)).toBe(true);
  });

  it('is false for an inland county or no data', () => {
    expect(hasSeaLevelData(mockSeaLevelInland)).toBe(false);
    expect(hasSeaLevelData(null)).toBe(false);
  });
});

describe('SeaLevelChart', () => {
  it('shows the chart with units, baseline, summary and source', () => {
    render(<SeaLevelChart data={mockSeaLevelCork} />);
    const chart = screen.getByTestId('line-chart');

    expect(chart.getAttribute('aria-label')).toBe("Sea-level rise at Cork's coast, cm");
    expect(chart.getAttribute('data-y-title')).toBe('cm rise since 1981-2000');
    expect(screen.getByText(/RCP8.5 \+75.4 cm/)).toBeTruthy();
    expect(screen.getByText(/Source: Met Office UKCP18/)).toBeTruthy();
  });

  it('explains why there is no chart for an inland county', () => {
    render(<SeaLevelChart data={mockSeaLevelInland} />);
    expect(screen.getByText('County Kildare has no coastline, so there is no sea-level projection for it.')).toBeTruthy();
    expect(screen.queryByTestId('line-chart')).toBeNull();
  });

  it('shows a message when no data came back', () => {
    render(<SeaLevelChart data={null} />);
    expect(screen.getByText('No sea-level data is available for this county.')).toBeTruthy();
  });
});