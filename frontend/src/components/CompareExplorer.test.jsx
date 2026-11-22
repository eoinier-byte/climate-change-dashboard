// Tests for the Compare section: the controls, the highlights, the charts, the scatterplot and the table.
// The API is a fake that answers with Cork's mock rows (and, for Kerry, a copy with different numbers).
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CompareExplorer from './CompareExplorer';
import * as api from '../services/api';
import { mockApiLoading, mockApiSuccess } from '../test/mockApi';
import { kerryRows } from '../test/compareRows';
import { currentLocation, renderWithRouter } from '../test/renderWithRouter';

vi.mock('../services/api');

const open = (url = '/compare') => renderWithRouter(<CompareExplorer />, { url });

describe('CompareExplorer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiSuccess(api);
  });

  it('says Loading while the projections load', () => {
    mockApiLoading(api);
    open();
    expect(screen.getByRole('status').textContent).toMatch(/Loading projections/);
  });

  it('opens on Cork with the baseline and each scenario at the end of the century, asking the API for Cork once', async () => {
    open();
    await screen.findByText(/In Cork, .* warmer on average than Baseline 1976–2005/);

    expect(api.getProjections).toHaveBeenCalledTimes(1);
    expect(api.getProjections.mock.calls[0][0]).toEqual({ county: 'cork' });
    for (const name of ['Baseline', 'RCP2.6 · end', 'RCP4.5 · end', 'RCP8.5 · end']) {
      expect(screen.getByRole('checkbox', { name }).checked).toBe(true);
    }
    expect(screen.getByRole('checkbox', { name: 'RCP8.5 · mid' }).checked).toBe(false);
  });

  it('shows the warmest and wettest season', async () => {
    open();
    await screen.findByText('Warmest season');
    expect(screen.getByText('Summer · 17.3 °C')).toBeTruthy(); // RCP8.5, end of century
    expect(screen.getByText('Winter · 529 mm')).toBeTruthy();
  });

  it('says what warming and rainfall do together, without claiming one causes the other', async () => {
    open();
    const note = await screen.findByText(/Does more warming bring more rain\?/);
    expect(note.textContent).toMatch(/correlation r = -?\d\.\d\d/);
    expect(screen.getByText('Warming vs rainfall')).toBeTruthy();
  });

  it('draws a dot chart for temperature and one for rainfall, with a row for each season', async () => {
    open();
    await screen.findByText('Warmest season');
    for (const title of ['Temperature change', 'Rainfall change']) {
      const panel = screen.getByRole('group', { name: title });
      for (const season of ['Winter', 'Spring', 'Summer', 'Autumn']) {
        expect(within(panel).getByText(season)).toBeTruthy();
      }
    }
    expect(screen.getByRole('img', { name: 'RCP8.5, 2071–2100: +3.4 °C' })).toBeTruthy(); // autumn temperature change
  });

  it('draws a point for each season of each thing compared, named with its values', async () => {
    open();
    await screen.findByText('Warmest season');
    expect(screen.getByRole('button', { name: 'Summer, RCP8.5, 2071–2100: 17.3 °C, 230 mm' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /°C, \d+ mm$/ })).toHaveLength(16); // 4 things x 4 seasons
  });

  it('shows a tip with the values when a point is hovered', async () => {
    open();
    const point = await screen.findByRole('button', { name: /^Winter, RCP8.5/ });
    fireEvent.mouseEnter(point);
    expect(screen.getByText('Winter · RCP8.5, 2071–2100')).toBeTruthy();
    expect(screen.getByText('8.3 °C · 529 mm')).toBeTruthy();
  });

  it('highlights one season when its button is pressed, and clears it when pressed again', async () => {
    open();
    await screen.findByText('Warmest season');
    const button = screen.getByRole('button', { name: 'W · Winter' });
    fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /^Summer, RCP8.5/ }).style.opacity).toBe('0.15');
    fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: /^Summer, RCP8.5/ }).style.opacity).toBe('1');
  });

  it('has a table with every number, with the change from the baseline', async () => {
    open();
    await screen.findByText('Warmest season');
    const table = screen.getByRole('table', { name: /Temperature and rainfall by season/ });
    const row = within(table).getByRole('row', { name: /RCP8.5, 2071–2100 Winter/ });
    expect(within(row).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'Winter',
      '8.3 °C',
      '+2.63 °C',
      '529 mm',
      '+22.1%',
    ]);
  });

  it('writes what is ticked to the address, and keeps at least one thing ticked', async () => {
    open('/compare?set=base');
    await screen.findByText('Warmest season');

    fireEvent.click(screen.getByRole('checkbox', { name: 'RCP8.5 · end' }));
    expect(currentLocation()).toBe('/compare?set=base%2C85-end');
    expect(screen.getByRole('checkbox', { name: 'RCP8.5 · end' }).checked).toBe(true);

    fireEvent.click(screen.getByRole('checkbox', { name: 'RCP8.5 · end' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Baseline' }));
    expect(screen.getByRole('checkbox', { name: 'Baseline' }).checked).toBe(true);
  });

  it('does not ask again for the same county when only the choices change', async () => {
    open();
    await screen.findByText('Warmest season');
    fireEvent.click(screen.getByRole('checkbox', { name: 'RCP4.5 · mid' }));
    expect(api.getProjections).toHaveBeenCalledTimes(1);
  });

  it('asks for the other county when one is chosen', async () => {
    open();
    await screen.findByText('Warmest season');
    fireEvent.change(screen.getByLabelText('County'), { target: { value: 'kerry' } });
    await waitFor(() => expect(api.getProjections).toHaveBeenCalledWith({ county: 'kerry' }, expect.anything()));
    expect(currentLocation()).toBe('/compare?county=kerry');
  });

  it('says so when the projections cannot be loaded', async () => {
    api.getProjections.mockRejectedValue(new Error('boom'));
    open();
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  describe('two counties', () => {
    beforeEach(() => {
      api.getProjections.mockImplementation(async ({ county }) => (county === 'kerry' ? kerryRows() : (await import('../mocks/countyRows')).mockCorkRows));
    });

    it('shows both counties under one scenario and period, and how much more one warms', async () => {
      open('/compare?mode=counties&county=cork&county2=kerry');
      await screen.findByText(/Under RCP8.5, by end of century \(2071–2100\), Kerry warms 0.40 °C more than Cork\./);
      expect(api.getProjections).toHaveBeenCalledTimes(2);
      expect(screen.getByLabelText('Second county').value).toBe('kerry');
      expect(screen.getByRole('radio', { name: /RCP8.5: If nothing is done/ }).checked).toBe(true);
    });

    it('changes the scenario and period, and writes them to the address', async () => {
      open('/compare?mode=counties&county=cork&county2=kerry');
      await screen.findByText('Warmest season');
      fireEvent.click(screen.getByRole('radio', { name: /RCP4.5: Middle path/ }));
      expect(currentLocation()).toContain('rcp=45');
      fireEvent.click(screen.getByRole('radio', { name: /Mid-century/ }));
      expect(currentLocation()).toContain('period=2021-2050');
    });

    it('switches between the two ways of comparing', async () => {
      open();
      await screen.findByText('Warmest season');
      expect(screen.queryByLabelText('Second county')).toBeNull();
      await act(async () => fireEvent.click(screen.getByRole('radio', { name: 'Two counties, one scenario' })));
      expect(screen.getByLabelText('Second county')).toBeTruthy();
      expect(currentLocation()).toBe('/compare?mode=counties');
    });
  });
});
