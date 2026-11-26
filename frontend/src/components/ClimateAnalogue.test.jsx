// Tests for the climate analogue block (CCD-151, CCD-373): match, no-match, error and loading.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClimateAnalogue from './ClimateAnalogue';
import { getAnalogues } from '../services/api';
import { SCENARIO_LABELS } from '../styles/scenarioColors';
import { analogueRows } from '../test/analogueRows';
import { renderWithRouter } from '../test/renderWithRouter';

// Replace the real API call with a fake, so the tests never need the backend
vi.mock('../services/api', () => ({
  getAnalogues: vi.fn(),
}));

// Draws the block for Cork, by default with every scenario ticked and the end-of-century period
function renderBlock(selected = ['rcp26', 'rcp45', 'rcp85'], period = '2071-2100') {
  return renderWithRouter(<ClimateAnalogue slug="cork" countyName="Cork" selected={selected} period={period} />);
}

describe('ClimateAnalogue', () => {
  beforeEach(() => {
    vi.mocked(getAnalogues).mockReset();
    vi.mocked(getAnalogues).mockResolvedValue(analogueRows);
  });

  it('shows "Finding a match…" while it loads', () => {
    vi.mocked(getAnalogues).mockReturnValue(new Promise(() => {})); // never finishes
    renderBlock();
    expect(screen.getByText('Finding a match…')).toBeTruthy();
  });

  it('asks the API for the highest ticked scenario and the chosen period', async () => {
    renderBlock(['rcp26', 'rcp45'], '2021-2050');
    await screen.findByText(/most like/);
    expect(getAnalogues).toHaveBeenCalledWith('cork', { scenario: 'rcp45', period: '2021-2050' }, expect.anything());
    expect(screen.getByText(new RegExp(`Under ${SCENARIO_LABELS.rcp45.replace('.', '\\.')}`))).toBeTruthy();
  });

  it('names the best match with a similarity word and bar', async () => {
    renderBlock();
    const headline = await screen.findByText(/most like/);
    expect(within(headline).getByText('Brest, France')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Similarity: High' })).toBeTruthy();
  });

  it("compares the county's projected climate with the city today", async () => {
    renderBlock();
    const table = await screen.findByRole('table');
    const summer = within(table).getByRole('row', { name: /Summer temperature/ });
    expect(within(summer).getByText('16.0 °C')).toBeTruthy();
    expect(within(summer).getByText('16.2 °C')).toBeTruthy();
    expect(within(summer).getByText('+0.2 °C')).toBeTruthy();
    expect(within(table).getByRole('row', { name: /Rainfall per year/ }).textContent).toContain('-142 mm');
  });

  it('lists the next two cities with their similarity word', async () => {
    renderBlock();
    const others = await screen.findByText(/Also close/);
    expect(others.textContent).toContain('Plymouth, United Kingdom (moderate match)');
    expect(others.textContent).toContain('Lorient, France (moderate match)');
  });

  it('uses the closest city even if the API sends them out of order', async () => {
    vi.mocked(getAnalogues).mockResolvedValue([...analogueRows].reverse());
    renderBlock();
    const headline = await screen.findByText(/most like/);
    expect(within(headline).getByText('Brest, France')).toBeTruthy();
  });

  it('says there is no close analogue when no city comes back', async () => {
    vi.mocked(getAnalogues).mockResolvedValue([]);
    renderBlock();
    expect(await screen.findByRole('heading', { name: 'No close analogue available' })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows an error with Retry, and loads again when Retry is pressed', async () => {
    const user = userEvent.setup();
    vi.mocked(getAnalogues).mockRejectedValueOnce({ name: 'ApiError', status: 500 });
    renderBlock();

    await user.click(await screen.findByRole('button', { name: /retry|try again/i }));

    expect(await screen.findByText(/most like/)).toBeTruthy();
    expect(getAnalogues).toHaveBeenCalledTimes(2);
  });

  it('links to the method on the About page', async () => {
    renderBlock();
    await screen.findByText(/most like/);
    expect(screen.getByRole('link', { name: 'Read the method' }).getAttribute('href')).toBe('/about');
  });
});