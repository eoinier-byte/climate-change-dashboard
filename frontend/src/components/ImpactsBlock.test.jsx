// Tests for the "What this means for you" block (CCD-375)
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImpactsBlock from './ImpactsBlock';
import { getImpacts } from '../services/api';
import { mockImpactsCork } from '../mocks/impacts';

// Replace the real API call with a fake, so the tests never need the backend
vi.mock('../services/api', () => ({
  getImpacts: vi.fn(),
}));

const ALL = ['rcp26', 'rcp45', 'rcp85'];

// Shows the block for Cork, with every scenario and 2071-2100 unless the test says otherwise
function renderBlock({ scenarios = ALL, period = '2071-2100' } = {}) {
  render(<ImpactsBlock slug="cork" scenarios={scenarios} period={period} baselinePeriod="1976-2005" />);
}

describe('ImpactsBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getImpacts.mockResolvedValue(mockImpactsCork);
  });

  it('asks the API for this county', async () => {
    renderBlock();
    await screen.findByRole('heading', { name: 'Frost days' });
    expect(getImpacts).toHaveBeenCalledWith('cork');
  });

  it('shows a loading message until the data arrives', () => {
    getImpacts.mockImplementation(() => new Promise(() => {})); // never answers
    renderBlock();
    expect(screen.getByRole('status').textContent).toBe('Loading everyday impacts…');
  });

  it('shows all four indicators for a full response, in order', async () => {
    renderBlock();
    await screen.findByRole('heading', { name: 'Frost days' });

    const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual(['Hot days', 'Frost days', 'Growing season', 'Heating need']);
  });

  it('states the period and baseline, and writes each scenario with a value and units', async () => {
    renderBlock();
    const frost = await screen.findByRole('article', { name: 'Frost days' });

    expect(screen.getByText(/in 2071-2100, compared with the 1976-2005 average/)).toBeTruthy();
    expect(within(frost).getByText('31 days a year')).toBeTruthy();
    expect(within(frost).getByText('RCP8.5:')).toBeTruthy();
    expect(within(frost).getByText('6 days a year, 25 fewer than today')).toBeTruthy();

    // Heating need is a percentage, never a number of days
    const heating = screen.getByRole('article', { name: 'Heating need' });
    expect(within(heating).getByText('36% less heating needed than today')).toBeTruthy();
  });

  it('only shows the ticked scenarios and the chosen period', async () => {
    renderBlock({ scenarios: ['rcp26'], period: '2021-2050' });
    const frost = await screen.findByRole('article', { name: 'Frost days' });

    expect(within(frost).getByText('22 days a year, 9 fewer than today')).toBeTruthy();
    expect(within(frost).queryByText('RCP8.5:')).toBeNull();
    expect(screen.getByText(/in 2021-2050/)).toBeTruthy();
  });

  it('hides indicators missing from the response instead of showing 0', async () => {
    getImpacts.mockResolvedValue(mockImpactsCork.filter((row) => row.indicator === 'frost_days'));
    renderBlock();
    await screen.findByRole('heading', { name: 'Frost days' });

    expect(screen.queryByRole('heading', { name: 'Hot days' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Heating need' })).toBeNull();
    expect(screen.queryByText(/^0 days/)).toBeNull();
  });

  it('says so when there are no figures at all', async () => {
    getImpacts.mockResolvedValue([]);
    renderBlock();
    expect(await screen.findByText(/No everyday impact figures are available/)).toBeTruthy();
  });

  it('shows a friendly error if the request fails, without the raw error text', async () => {
    getImpacts.mockRejectedValue(new Error('API error 500 for /counties/cork/impacts/'));
    renderBlock();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toMatch(/API error/);
  });
});