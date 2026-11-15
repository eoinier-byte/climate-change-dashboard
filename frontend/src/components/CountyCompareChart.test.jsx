// Tests for the chart that shows two counties on the same axes (CCD-378). Chart.js cannot draw in the
// test browser, so Bar is replaced by a stand-in that shows what it was given.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CountyCompareChart from './CountyCompareChart';
import { COUNTY_COLOURS, compareCounties } from './compareData';
import { mockCorkRows } from '../mocks/countyRows';
import { kerryRows } from '../test/compareRows';

vi.mock('react-chartjs-2', () => ({
  Bar: (props) => (
    <div data-testid="bar-chart" role={props.role} aria-label={props['aria-label']} data-chart={JSON.stringify(props.data)} />
  ),
}));

const measures = compareCounties(mockCorkRows, kerryRows(), 'rcp85', '2071-2100');
const chartData = () => JSON.parse(screen.getByTestId('bar-chart').dataset.chart);

function show(variable = 'temperature', list = measures) {
  return render(
    <CountyCompareChart
      measures={list}
      variable={variable}
      nameA="Cork"
      nameB="Kerry"
      scenarioLabel="RCP8.5"
      period="2071-2100"
      source="translate"
    />,
  );
}

describe('CountyCompareChart', () => {
  it('has a title that names both counties, the scenario, the period and the unit', () => {
    show();
    const title = 'Change in temperature by season: Cork and Kerry, RCP8.5, 2071-2100 (°C)';
    expect(screen.getByRole('heading', { level: 3, name: title })).toBeTruthy();
    expect(screen.getByRole('img', { name: title })).toBeTruthy();
  });

  it('draws one bar per county for the whole year and each season, on the same axes', () => {
    show();
    const data = chartData();
    expect(data.labels).toEqual(['Whole year', 'Winter', 'Spring', 'Summer', 'Autumn']);
    expect(data.datasets.map((set) => set.label)).toEqual(['Cork', 'Kerry']);
    expect(data.datasets[0].data).toEqual([2.71, 2.63, 1.93, 2.81, 3.43]);
    expect(data.datasets[1].data).toEqual([3.11, 3.03, 2.33, 3.21, 3.83]);
  });

  it('uses two different colours, neither of them a scenario colour', () => {
    show();
    const [first, second] = chartData().datasets.map((set) => set.backgroundColor);
    expect(first).toBe(COUNTY_COLOURS.first);
    expect(second).toBe(COUNTY_COLOURS.second);
    expect(first).not.toBe(second);
    ['#2e7d32', '#b45309', '#c62828'].forEach((scenario) => expect([first, second]).not.toContain(scenario));
  });

  it('shows rainfall change in percent', () => {
    show('precipitation');
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(
      'Change in rainfall by season: Cork and Kerry, RCP8.5, 2071-2100 (%)',
    );
    expect(chartData().datasets[0].data).toEqual([8, 22.1, 5.6, -10, 5.8]);
  });

  it('says the same numbers in words, for screen readers, with the source', () => {
    const { container } = show();
    const caption = container.querySelector('figcaption').textContent;
    expect(caption).toContain('Cork: whole year +2.71 °C, winter +2.63 °C');
    expect(caption).toContain('Kerry: whole year +3.11 °C, winter +3.03 °C');
    expect(caption).toContain('Source: Climate Ireland TRANSLATE.');
  });

  it('leaves a gap, not a zero, for a county with no value', () => {
    show('temperature', compareCounties(mockCorkRows, [], 'rcp85', '2071-2100'));
    expect(chartData().datasets[1].data).toEqual([null, null, null, null, null]);
  });

  it('says so when there is nothing to draw', () => {
    show('temperature', []);
    expect(screen.queryByTestId('bar-chart')).toBeNull();
    expect(screen.getByText('No data is available for this chart.')).toBeTruthy();
  });
});
