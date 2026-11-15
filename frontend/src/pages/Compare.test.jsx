// Tests for the Compare page (CCD-207): the table of two scenarios and their difference, and the choices
// kept in the URL. The API is a fake that answers with Cork's mock rows.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Compare from './Compare';
import * as api from '../services/api';
import { ROUTES } from '../routes';
import { mockApiLoading, mockApiSuccess } from '../test/mockApi';
import { currentLocation, renderWithRouter } from '../test/renderWithRouter';

vi.mock('../services/api');

const open = (url = ROUTES.compare) => renderWithRouter(<Compare />, { url });

// The text of every cell in a row of the table, found by the row's heading
function rowCells(name) {
  const row = within(screen.getByRole('table')).getByRole('row', { name: new RegExp(`^${name}`) });
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
}

describe('Compare page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiSuccess(api);
  });

  it('has a Compare heading and says Loading while the projections load', () => {
    mockApiLoading(api);
    open();
    expect(screen.getByRole('heading', { level: 1, name: 'Compare' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/Loading projections/);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('opens on Cork, RCP2.6 against RCP8.5 at the end of the century, and asks the API for Cork once', async () => {
    open();
    await screen.findByRole('table');

    expect(api.getProjections).toHaveBeenCalledTimes(1);
    expect(api.getProjections.mock.calls[0][0]).toEqual({ county: 'cork' });
    expect(
      screen.getByRole('heading', { level: 2, name: 'Cork: RCP2.6 compared with RCP8.5, end of century (2071-2100)' }),
    ).toBeTruthy();
  });

  it('shows the baseline, both scenarios with their change, and the difference, with units', async () => {
    open();
    await screen.findByRole('table');

    expect(rowCells('Temperature, whole year')).toEqual([
      '9.8 °C',
      '10.5 °C+0.73 °C from baseline',
      '12.5 °C+2.71 °C from baseline',
      '+1.98 °C',
    ]);
    expect(rowCells('Rainfall, whole year')).toEqual([
      '1,369 mm',
      '1,440 mm+5.2% from baseline',
      '1,478 mm+8.0% from baseline',
      '+38 mm',
    ]);
    expect(rowCells('Rainfall, summer')[3]).toBe('-29 mm');
  });

  it('has a row for the whole year and each season, for temperature and rainfall', async () => {
    open();
    await screen.findByRole('table');
    const headings = within(screen.getByRole('table'))
      .getAllByRole('rowheader')
      .map((cell) => cell.textContent);
    expect(headings).toEqual([
      'Temperature, whole year',
      'Temperature, winter',
      'Temperature, spring',
      'Temperature, summer',
      'Temperature, autumn',
      'Rainfall, whole year',
      'Rainfall, winter',
      'Rainfall, spring',
      'Rainfall, summer',
      'Rainfall, autumn',
    ]);
  });

  it('names both scenarios and the difference in the column headings', async () => {
    open();
    await screen.findByRole('table');
    const columns = within(screen.getByRole('table'))
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(columns).toEqual([
      'Measure',
      'Baseline (1976-2005)',
      'RCP2.6',
      'RCP8.5',
      'Difference (RCP8.5 minus RCP2.6)',
    ]);
  });

  it('writes the difference in words above the table', async () => {
    open();
    await screen.findByRole('table');
    expect(screen.getByText('Over the whole year, RCP8.5 is 1.98 °C warmer than RCP2.6 in County Cork.')).toBeTruthy();
    expect(screen.getByText('Over the whole year, RCP8.5 has 38 mm more rain than RCP2.6 in County Cork.')).toBeTruthy();
  });

  describe('the choices in the URL', () => {
    it('opens the comparison in the address, and asks the API for that county', async () => {
      open('/compare?county=kerry&a=45&b=85&period=2021-2050');
      await screen.findByRole('table');

      expect(api.getProjections.mock.calls[0][0]).toEqual({ county: 'kerry' });
      expect(
        screen.getByRole('heading', { level: 2, name: 'Kerry: RCP4.5 compared with RCP8.5, mid-century (2021-2050)' }),
      ).toBeTruthy();
      expect(screen.getByLabelText('County').value).toBe('kerry');
      expect(screen.getByLabelText('First scenario').value).toBe('rcp45');
      expect(screen.getByLabelText('Second scenario').value).toBe('rcp85');
      expect(screen.getByRole('radio', { name: /Mid-century/ }).checked).toBe(true);
      // 10.718 - 10.620 for temperature, from the stored values
      expect(rowCells('Temperature, whole year')[3]).toBe('+0.10 °C');
    });

    it('writes a changed scenario to the address without asking the API again', async () => {
      const user = userEvent.setup();
      open();
      await screen.findByRole('table');

      await user.selectOptions(screen.getByLabelText('First scenario'), 'rcp45');

      expect(currentLocation()).toBe('/compare?a=45');
      expect(api.getProjections).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('columnheader', { name: 'RCP4.5' })).toBeTruthy();
      expect(rowCells('Temperature, whole year')[3]).toBe('+1.24 °C'); // 12.525 - 11.282
    });

    it('swaps the scenarios when the same one is chosen twice', async () => {
      const user = userEvent.setup();
      open();
      await screen.findByRole('table');

      await user.selectOptions(screen.getByLabelText('First scenario'), 'rcp85');

      expect(screen.getByLabelText('First scenario').value).toBe('rcp85');
      expect(screen.getByLabelText('Second scenario').value).toBe('rcp26');
      expect(currentLocation()).toBe('/compare?a=85&b=26');
      expect(rowCells('Temperature, whole year')[3]).toBe('-1.98 °C');
    });

    it('writes the period to the address and shows the rows that period has', async () => {
      const user = userEvent.setup();
      open();
      await screen.findByRole('table');

      await user.click(screen.getByRole('radio', { name: /Mid-century/ }));

      expect(currentLocation()).toBe('/compare?period=2021-2050');
      // The mock has seasonal rows for the end of the century only
      expect(within(screen.getByRole('table')).getAllByRole('rowheader')).toHaveLength(2);
      expect(rowCells('Temperature, whole year')[3]).toBe('+0.19 °C');
    });

    it('loads the other county when one is chosen, and does not show the old one meanwhile', async () => {
      const user = userEvent.setup();
      open();
      await screen.findByRole('table');
      api.getProjections.mockImplementation(() => new Promise(() => {}));

      await user.selectOptions(screen.getByLabelText('County'), 'kerry');

      expect(currentLocation()).toBe('/compare?county=kerry');
      expect(api.getProjections.mock.calls[1][0]).toEqual({ county: 'kerry' });
      expect(screen.getByRole('status').textContent).toMatch(/Loading projections/);
      expect(screen.queryByRole('table')).toBeNull();
    });
  });

  describe('when something goes wrong', () => {
    it('says so, and tries again when Retry is pressed', async () => {
      const user = userEvent.setup();
      api.getProjections.mockRejectedValueOnce(new Error('API error 500'));
      open();

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toMatch(/Something went wrong/);
      expect(screen.queryByRole('table')).toBeNull();

      await user.click(within(alert).getByRole('button', { name: /Retry/ }));

      await screen.findByRole('table');
      expect(api.getProjections).toHaveBeenCalledTimes(2);
    });

    it('still works when the county list cannot be loaded', async () => {
      api.getCounties.mockRejectedValue(new Error('API error 500'));
      open();

      await screen.findByRole('table');
      expect(screen.queryByLabelText('County')).toBeNull();
      expect(screen.getByRole('heading', { level: 2, name: /^Cork: RCP2\.6/ })).toBeTruthy();
    });

    it('says when there is nothing to compare', async () => {
      mockApiSuccess(api, { projections: [] });
      open();

      await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/no projections to compare/i));
      expect(screen.queryByRole('table')).toBeNull();
    });
  });
});
