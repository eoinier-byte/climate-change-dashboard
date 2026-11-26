// Tests for the 2050 / 2100 sea-level card (CCD-171, CCD-172, CCD-175).
// The values are Cork's real UKCP18 numbers from the mock, so the card is checked against the data.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SeaLevelCard from './SeaLevelCard';
import { mockSeaLevelCork, mockSeaLevelInland } from '../mocks/seaLevel';
import { SCENARIO_LABELS } from '../styles/scenarioColors';

// The card for one year, found by its heading, e.g. "Cork, by 2050"
const card = (name) => screen.getByRole('article', { name });

describe('SeaLevelCard', () => {
  it('names the county and the year in its title', () => {
    render(<SeaLevelCard data={mockSeaLevelCork} year={2050} />);
    expect(card('Cork, by 2050')).toBeTruthy();
  });

  it("shows each scenario's 2050 value from the data, with its unit", () => {
    render(<SeaLevelCard data={mockSeaLevelCork} year={2050} />);
    const box = card('Cork, by 2050');
    // 2050 in the mock: RCP2.6 22.827, RCP4.5 24.419, RCP8.5 28.634 (cm)
    expect(within(box).getByText('+22.8 cm')).toBeTruthy();
    expect(within(box).getByText('+24.4 cm')).toBeTruthy();
    expect(within(box).getByText('+28.6 cm')).toBeTruthy();
    expect(within(box).getByText(SCENARIO_LABELS.rcp85)).toBeTruthy();
  });

  it("shows each scenario's 2100 value from the data", () => {
    render(<SeaLevelCard data={mockSeaLevelCork} year={2100} />);
    const box = card('Cork, by 2100');
    // 2100 in the mock: RCP2.6 42.702, RCP4.5 52.676, RCP8.5 75.404 (cm)
    expect(within(box).getByText('+42.7 cm')).toBeTruthy();
    expect(within(box).getByText('+52.7 cm')).toBeTruthy();
    expect(within(box).getByText('+75.4 cm')).toBeTruthy();
  });

  it('only shows the ticked scenarios', () => {
    render(<SeaLevelCard data={mockSeaLevelCork} year={2100} selected={['rcp85']} />);
    const box = card('Cork, by 2100');
    expect(within(box).getByText('+75.4 cm')).toBeTruthy();
    expect(within(box).queryByText(SCENARIO_LABELS.rcp26)).toBeNull();
    expect(within(box).queryByText('+42.7 cm')).toBeNull();
  });

  it('gives the baseline and the source', () => {
    render(<SeaLevelCard data={mockSeaLevelCork} year={2050} />);
    expect(screen.getByText(/compared with the 1981-2000 average/)).toBeTruthy();
    expect(screen.getByText(/Met Office UKCP18/)).toBeTruthy();
  });

  it('says "No coastline" for an inland county', () => {
    render(<SeaLevelCard data={mockSeaLevelInland} year={2050} />);
    expect(screen.getByText('No coastline')).toBeTruthy();
  });

  it('shows a message when the year is not in the data', () => {
    render(<SeaLevelCard data={mockSeaLevelCork} year={2075} />);
    expect(screen.getByText('No sea-level projection is available for 2075.')).toBeTruthy();
  });

  it('says "no value" when one value is missing', () => {
    // A copy of Cork with RCP8.5's 2050 value removed
    const missing = {
      ...mockSeaLevelCork,
      series: {
        ...mockSeaLevelCork.series,
        rcp85: { ...mockSeaLevelCork.series.rcp85, values: mockSeaLevelCork.series.rcp85.values.map((v, i) => (i === 3 ? null : v)) },
      },
    };
    render(<SeaLevelCard data={missing} year={2050} />);
    expect(within(card('Cork, by 2050')).getByText('no value')).toBeTruthy();
  });
});