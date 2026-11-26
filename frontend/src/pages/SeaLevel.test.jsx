// Tests for the flood page at /sea-level (CCD-152, CCD-174, CCD-175).
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SeaLevel from './SeaLevel';
import { getSeaLevel } from '../services/api';
import { mockSeaLevelCork } from '../mocks/seaLevel';
import { ROUTES } from '../routes';
import { SCENARIO_LABELS } from '../styles/scenarioColors';
import { currentLocation, renderWithRouter } from '../test/renderWithRouter';

// Replace the real API call with a fake, so the tests never need the backend
vi.mock('../services/api', () => ({
  getSeaLevel: vi.fn(),
}));

// The test browser (jsdom) cannot draw on a <canvas>, so swap the chart for a placeholder
// that keeps its title as its label and lists the lines it would draw
vi.mock('react-chartjs-2', () => ({
  Line: (props) => (
    <div
      data-testid="line-chart"
      aria-label={props['aria-label']}
      data-lines={props.data.datasets.map((d) => d.label).join(',')}
    />
  ),
}));

// Opens the page at an address, e.g. openPage('/sea-level?county=cork')
function openPage(url = ROUTES.seaLevel) {
  return renderWithRouter(<SeaLevel />, { url, path: ROUTES.seaLevel });
}

describe('SeaLevel page', () => {
  beforeEach(() => {
    vi.mocked(getSeaLevel).mockReset();
    vi.mocked(getSeaLevel).mockResolvedValue(mockSeaLevelCork);
  });

  it('shows the loading message, then the 2050 and 2100 cards and the chart', async () => {
    openPage('/sea-level?county=cork');

    expect(screen.getByText('Loading sea-level data…')).toBeTruthy();
    expect(await screen.findByRole('article', { name: 'Cork, by 2050' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Cork, by 2100' })).toBeTruthy();
    expect(screen.getByLabelText("Sea-level rise at Cork's coast, cm")).toBeTruthy();
    expect(getSeaLevel).toHaveBeenCalledWith('cork');
  });

  it('opens on the first coastal county when the URL names none', async () => {
    openPage();
    await screen.findByRole('article', { name: 'Cork, by 2050' });
    expect(getSeaLevel).toHaveBeenCalledWith('clare');
    expect(screen.getByLabelText('Coastal county').value).toBe('clare');
  });

  it('ignores an inland or unknown county in the URL', async () => {
    openPage('/sea-level?county=kildare');
    await screen.findByRole('article', { name: 'Cork, by 2050' });
    expect(getSeaLevel).toHaveBeenCalledWith('clare');
  });

    it('only offers the 15 coastal counties', async () => {
    openPage();
    // Wait for the data, so the page has finished updating before the test ends
    await screen.findByRole('article', { name: 'Cork, by 2050' });
    const options = within(screen.getByLabelText('Coastal county')).getAllByRole('option');
    expect(options).toHaveLength(15);
    expect(options.map((option) => option.value)).not.toContain('kildare');
  });

  it('loads a new county and keeps it in the URL when one is picked', async () => {
    const user = userEvent.setup();
    openPage('/sea-level?county=cork');
    await screen.findByRole('article', { name: 'Cork, by 2050' });

    await user.selectOptions(screen.getByLabelText('Coastal county'), 'kerry');

    expect(currentLocation()).toContain('county=kerry');
    expect(getSeaLevel).toHaveBeenLastCalledWith('kerry');
  });

  it('hides an unticked scenario from the cards and the chart, and keeps it in the URL', async () => {
    const user = userEvent.setup();
    openPage('/sea-level?county=cork');
    const card2050 = await screen.findByRole('article', { name: 'Cork, by 2050' });
    expect(within(card2050).getByText('+24.4 cm')).toBeTruthy(); // RCP4.5 in 2050

    // The tick box's name starts with the scenario's label, e.g. "RCP4.5 (some climate action)"
    await user.click(screen.getByRole('checkbox', { name: new RegExp(SCENARIO_LABELS.rcp45.replace('.', '\\.')) }));

    expect(within(screen.getByRole('article', { name: 'Cork, by 2050' })).queryByText('+24.4 cm')).toBeNull();
    expect(screen.getByTestId('line-chart').getAttribute('data-lines')).toBe(
      `${SCENARIO_LABELS.rcp26},${SCENARIO_LABELS.rcp85}`,
    );
    expect(currentLocation()).toContain('rcp=');
  });

  it('opens with the scenarios from the URL', async () => {
    openPage('/sea-level?county=cork&rcp=85');
    const card2100 = await screen.findByRole('article', { name: 'Cork, by 2100' });
    expect(within(card2100).getByText('+75.4 cm')).toBeTruthy();
    expect(within(card2100).queryByText('+42.7 cm')).toBeNull();
  });

  it('shows an error with Retry, and loads again when Retry is pressed', async () => {
    const user = userEvent.setup();
    vi.mocked(getSeaLevel).mockRejectedValueOnce({ name: 'ApiError', status: 500 });
    openPage('/sea-level?county=cork');

    const retry = await screen.findByRole('button', { name: /retry|try again/i });
    await user.click(retry);

    expect(await screen.findByRole('article', { name: 'Cork, by 2050' })).toBeTruthy();
    expect(getSeaLevel).toHaveBeenCalledTimes(2);
  });

  it('keeps a space for the flood map and links to the county page', async () => {
    openPage('/sea-level?county=cork');
    await screen.findByRole('article', { name: 'Cork, by 2050' });
    expect(screen.getByRole('heading', { level: 2, name: 'Flood map' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See all climate projections for County Cork' }).getAttribute('href')).toBe(
      '/county/cork',
    );
  });
});