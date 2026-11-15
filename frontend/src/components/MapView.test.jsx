// Tests for the county map (CCD-379, CCD-380). Leaflet is replaced by a stand-in in src/test/setup.jsx,
// and the API by a fake, so nothing here needs a browser or the backend.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MapView from './MapView';
import { getMap } from '../services/api';
import { fakeMap } from '../test/fakeLeafletMap';

vi.mock('../services/api', () => ({ getMap: vi.fn() }));

// A short answer in the shape of GET /api/map/ (the real one has 26 results)
const mapAnswer = {
  variable: 'temperature',
  scenario: 'rcp85',
  period: '2071-2100',
  season: 'annual',
  unit: 'degC',
  min: '10.000',
  max: '12.000',
  results: [{ county: { name: 'Cork', slug: 'cork', has_coastline: true }, value: '11.000', unit: 'degC' }],
};

// Looks like the error services/api.js throws
const serverError = Object.assign(new Error('API error 500 for /map/'), { name: 'ApiError', status: 500 });

describe('MapView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMap.mockReturnValue(new Promise(() => {})); // by default the answer never arrives
  });

  it('draws a map with the outlines of all 26 counties', () => {
    render(<MapView />);
    expect(screen.getByTestId('map')).toBeTruthy();
    expect(screen.getByTestId('county-outlines').dataset.counties).toBe('26');
  });

  it('credits Tailte Éireann for the boundaries, as the licence requires', () => {
    render(<MapView />);
    expect(screen.getByText(/Tailte Éireann/)).toBeTruthy();
    expect(screen.getByText(/CC BY 4\.0/)).toBeTruthy();
  });

  it('re-measures the map and zooms to fit the whole of Ireland', () => {
    render(<MapView />);
    expect(fakeMap.invalidateSize).toHaveBeenCalled();
    const [bounds] = fakeMap.fitBounds.mock.calls[0];
    expect(bounds).toEqual([
      [51.35, -10.75],
      [55.5, -5.9],
    ]);
  });

  describe('loading the county values (CCD-380)', () => {
    it('asks the API for the default choice: end-of-century temperature under RCP8.5', () => {
      render(<MapView />);
      expect(getMap).toHaveBeenCalledTimes(1);
      expect(getMap.mock.calls[0][0]).toEqual({
        variable: 'temperature',
        scenario: 'rcp85',
        period: '2071-2100',
        season: 'annual',
      });
    });

    it('asks for another choice when it is given one', () => {
      render(<MapView variable="precipitation" scenario="rcp45" period="2021-2050" season="winter" />);
      expect(getMap.mock.calls[0][0]).toEqual({
        variable: 'precipitation',
        scenario: 'rcp45',
        period: '2021-2050',
        season: 'winter',
      });
    });

    it('shows the shared Loading message until the values arrive, then removes it', async () => {
      getMap.mockResolvedValue(mapAnswer);
      render(<MapView />);

      expect(screen.getByRole('status').textContent).toBe('Loading map data…');
      await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('keeps the county outlines on screen while it loads', () => {
      render(<MapView />);
      expect(screen.getByRole('status')).toBeTruthy();
      expect(screen.getByTestId('county-outlines').dataset.counties).toBe('26');
    });

    it('shows the shared ErrorMessage with a Retry button when the request fails', async () => {
      getMap.mockRejectedValue(serverError);
      render(<MapView />);

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('The server had a problem');
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
      expect(screen.queryByRole('status')).toBeNull();
      // The outlines stay, so the map is still useful
      expect(screen.getByTestId('county-outlines')).toBeTruthy();
    });

    it('asks again when Retry is clicked, and clears the error when it works', async () => {
      const user = userEvent.setup();
      getMap.mockRejectedValueOnce(serverError).mockResolvedValueOnce(mapAnswer);
      render(<MapView />);

      await user.click(await screen.findByRole('button', { name: 'Retry' }));

      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
      expect(getMap).toHaveBeenCalledTimes(2);
    });
  });
});
