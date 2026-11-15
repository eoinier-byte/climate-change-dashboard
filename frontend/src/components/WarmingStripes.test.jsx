// Tests for the warming stripes (CCD-391).
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import WarmingStripes from './WarmingStripes';
import { buildSeries } from './countyChartData';
import { mockCorkRows } from '../mocks/countyRows';

const series = buildSeries(mockCorkRows, 'Cork', 'temperature');
const ALL = ['rcp26', 'rcp45', 'rcp85'];

describe('WarmingStripes', () => {
  it('draws one bar for the baseline and each future period, for every ticked scenario', () => {
    render(<WarmingStripes series={series} selected={ALL} />);
    expect(screen.getAllByRole('img')).toHaveLength(9); // 3 scenarios x (baseline + 2 periods)
  });

  it('only draws the ticked scenarios', () => {
    render(<WarmingStripes series={series} selected={['rcp85']} />);
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getByText('RCP8.5')).toBeTruthy();
    expect(screen.queryByText('RCP2.6')).toBeNull();
  });

  it('labels the county, the scenario, each period and the data source', () => {
    render(<WarmingStripes series={series} selected={['rcp85']} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Warming stripes for Cork' })).toBeTruthy();
    expect(screen.getByText('RCP8.5')).toBeTruthy();
    ['1976-2005', '2021-2050', '2071-2100'].forEach((period) => expect(screen.getByText(period)).toBeTruthy());
    expect(screen.getByText('Source: Climate Ireland TRANSLATE.')).toBeTruthy();
  });

  it('gives each bar a text label with the value, for screen readers', () => {
    render(<WarmingStripes series={series} selected={['rcp85']} />);
    expect(screen.getByRole('img', { name: 'RCP8.5, 1976-2005: 9.8 °C' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'RCP8.5, 2071-2100: 12.5 °C' })).toBeTruthy();
  });

  it('colours the coolest bar blue and the warmest red', () => {
    render(<WarmingStripes series={series} selected={['rcp85']} />);
    const coolest = screen.getByRole('img', { name: /1976-2005/ });
    const warmest = screen.getByRole('img', { name: /2071-2100/ });
    expect(coolest.style.backgroundColor).toBe('rgb(33, 102, 172)'); // #2166ac
    expect(warmest.style.backgroundColor).toBe('rgb(178, 24, 43)'); // #b2182b
  });

  it('explains that colour shows temperature, not the scenario', () => {
    render(<WarmingStripes series={series} selected={['rcp85']} />);
    expect(screen.getByText(/Colour shows temperature, not the scenario/)).toBeTruthy();
    expect(screen.getByText(/blue is 9\.8 °C, red is 12\.5 °C/)).toBeTruthy();
  });

  it('shows nothing when there is no temperature data', () => {
    const { container } = render(<WarmingStripes series={null} selected={ALL} />);
    expect(container.firstChild).toBeNull();
  });
});
