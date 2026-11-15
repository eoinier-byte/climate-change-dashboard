// Tests for the county map (CCD-379 to CCD-382). Leaflet is replaced by a stand-in in src/test/setup.jsx,
// and the API by a fake, so nothing here needs a browser or the backend.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MapView from './MapView';
import { getMap } from '../services/api';
import { fakeLayers, fakeMap } from '../test/fakeLeafletMap';
import { NO_DATA_COLOUR, PRECIPITATION_RAMP, TEMPERATURE_RAMP } from './mapColours';

vi.mock('../services/api', () => ({ getMap: vi.fn() }));

// Clicking a county calls navigate; the test only checks where it would go
const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => navigate }));

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

// An answer with the given values, e.g. answerWith({ dublin: 10, cork: 11, donegal: 12 })
function answerWith(values, extra = {}) {
  const numbers = Object.values(values);
  return {
    ...mapAnswer,
    min: Math.min(...numbers).toFixed(3),
    max: Math.max(...numbers).toFixed(3),
    results: Object.entries(values).map(([slug, value]) => ({
      county: { name: slug, slug, has_coastline: true },
      value: value.toFixed(3),
      unit: 'degC',
    })),
    ...extra,
  };
}

const fillOf = (slug) => screen.getByTestId(`county-${slug}`).dataset.fill;

// What the tooltip of a county says right now
const tooltipOf = (slug) => fakeLayers.get(slug).tooltip.content();

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
  describe('colouring the counties (CCD-381)', () => {
    it('leaves every county plain grey until the values arrive', () => {
      render(<MapView />);
      expect(fillOf('cork')).toBe(NO_DATA_COLOUR);
      expect(fillOf('dublin')).toBe(NO_DATA_COLOUR);
      expect(screen.queryByRole('group', { name: /temperature/i })).toBeNull();
    });

    it('colours each county from its value: coolest to warmest', async () => {
      getMap.mockResolvedValue(answerWith({ dublin: 10, cork: 11, donegal: 12 }));
      render(<MapView />);

      await waitFor(() => expect(fillOf('dublin')).toBe(TEMPERATURE_RAMP[0]));
      expect(fillOf('cork')).toBe(TEMPERATURE_RAMP[3]);
      expect(fillOf('donegal')).toBe(TEMPERATURE_RAMP[6]);
    });

    it('leaves a county with no value grey', async () => {
      getMap.mockResolvedValue(answerWith({ dublin: 10, donegal: 12 }));
      render(<MapView />);

      await waitFor(() => expect(fillOf('dublin')).toBe(TEMPERATURE_RAMP[0]));
      expect(fillOf('cork')).toBe(NO_DATA_COLOUR);
    });

    it('uses a different set of colours for rainfall', async () => {
      getMap.mockResolvedValue(answerWith({ dublin: 800, donegal: 1600 }, { variable: 'precipitation', unit: 'mm' }));
      render(<MapView variable="precipitation" />);

      await waitFor(() => expect(fillOf('dublin')).toBe(PRECIPITATION_RAMP[0]));
      expect(fillOf('donegal')).toBe(PRECIPITATION_RAMP[6]);
    });

    it('shows a legend with the variable, season, scenario, period and units', async () => {
      getMap.mockResolvedValue(answerWith({ dublin: 10, cork: 11, donegal: 12 }));
      render(<MapView />);

      const legend = await screen.findByRole('group', {
        name: 'Average temperature, whole year, RCP8.5, 2071\u20132100 (\u00b0C)',
      });
      // One entry per colour, with its range, so colour is not the only way to read the map
      const entries = within(legend).getAllByRole('listitem');
      expect(entries).toHaveLength(7);
      expect(entries[0].textContent).toBe('10.0\u201310.3');
      expect(entries[6].textContent).toBe('11.7\u201312.0');
    });

    it('updates the legend when the choice changes', async () => {
      getMap
        .mockResolvedValueOnce(answerWith({ dublin: 10, donegal: 12 }))
        .mockResolvedValueOnce(answerWith({ dublin: 9, donegal: 10 }, { scenario: 'rcp45', period: '2021-2050' }));
      const { rerender } = render(<MapView />);
      await screen.findByRole('group', { name: /RCP8\.5, 2071\u20132100/ });

      rerender(<MapView scenario="rcp45" period="2021-2050" />);

      expect(await screen.findByRole('group', { name: /RCP4\.5, 2021\u20132050/ })).toBeTruthy();
      expect(screen.queryByRole('group', { name: /RCP8\.5/ })).toBeNull();
    });

    it('says how many counties have no value', async () => {
      getMap.mockResolvedValue(answerWith({ dublin: 10, donegal: 12 }));
      render(<MapView />);

      expect(await screen.findByText('24 counties have no value and are shown in grey.')).toBeTruthy();
    });

    it('says so when there are no values for the choice, and colours nothing', async () => {
      getMap.mockResolvedValue({ ...mapAnswer, min: null, max: null, results: [] });
      render(<MapView />);

      expect(await screen.findByText('There are no values for this choice.')).toBeTruthy();
      expect(fillOf('cork')).toBe(NO_DATA_COLOUR);
    });

    it('shows no legend and no colours when the request fails', async () => {
      getMap.mockRejectedValue(serverError);
      render(<MapView />);

      await screen.findByRole('alert');
      expect(screen.queryByRole('group')).toBeNull();
      expect(fillOf('cork')).toBe(NO_DATA_COLOUR);
    });
  });
  describe('tooltips and click-through (CCD-382)', () => {
    it('gives every county a tooltip, which is just the name until the values arrive', () => {
      render(<MapView />);
      expect(fakeLayers.size).toBe(26);
      expect(tooltipOf('cork')).toBe('Cork');
    });

    it('shows the name and value of the county, with its unit', async () => {
      getMap.mockResolvedValue(answerWith({ cork: 11.234, dublin: 12 }));
      render(<MapView />);

      await waitFor(() => expect(tooltipOf('cork')).toBe('Cork: 11.2 \u00b0C'));
      expect(tooltipOf('dublin')).toBe('Dublin: 12.0 \u00b0C');
    });

    it('writes rainfall in whole millimetres', async () => {
      getMap.mockResolvedValue(answerWith({ cork: 1369.4, dublin: 800 }, { variable: 'precipitation', unit: 'mm' }));
      render(<MapView variable="precipitation" />);

      await waitFor(() => expect(tooltipOf('cork')).toBe('Cork: 1,369 mm'));
    });

    it('says when a county has no value', async () => {
      getMap.mockResolvedValue(answerWith({ cork: 11, dublin: 12 }));
      render(<MapView />);

      await waitFor(() => expect(tooltipOf('cork')).toBe('Cork: 11.0 \u00b0C'));
      expect(tooltipOf('donegal')).toBe('Donegal: no value');
    });

    it('shows the new value when the choice changes', async () => {
      getMap
        .mockResolvedValueOnce(answerWith({ cork: 11, dublin: 12 }))
        .mockResolvedValueOnce(answerWith({ cork: 9.5, dublin: 10 }, { scenario: 'rcp45' }));
      const { rerender } = render(<MapView />);
      await waitFor(() => expect(tooltipOf('cork')).toBe('Cork: 11.0 \u00b0C'));

      rerender(<MapView scenario="rcp45" />);

      await waitFor(() => expect(tooltipOf('cork')).toBe('Cork: 9.5 \u00b0C'));
    });

    it('opens the county page when a county is clicked', () => {
      render(<MapView />);
      fakeLayers.get('cork').fire('click');
      expect(navigate).toHaveBeenCalledWith('/county/cork');
    });

    it('opens the right county for each one', () => {
      render(<MapView />);
      fakeLayers.get('donegal').fire('click');
      expect(navigate).toHaveBeenLastCalledWith('/county/donegal');
    });

    it('makes every county a link that the keyboard can reach', () => {
      render(<MapView />);
      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(26);
      links.forEach((link) => expect(link.getAttribute('tabindex')).toBe('0'));
    });

    it('tells a screen reader the county, its value and what Enter does', async () => {
      getMap.mockResolvedValue(answerWith({ cork: 11.234, dublin: 12 }));
      render(<MapView />);

      expect(await screen.findByRole('link', { name: 'Cork: 11.2 \u00b0C, open county page' })).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Donegal: no value, open county page' })).toBeTruthy();
    });

    it('opens the county page when Enter is pressed on a focused county, and not for other keys', async () => {
      const user = userEvent.setup();
      render(<MapView />);
      screen.getByRole('link', { name: /^Cork/ }).focus();

      await user.keyboard('a');
      expect(navigate).not.toHaveBeenCalled();
      await user.keyboard('{Enter}');
      expect(navigate).toHaveBeenCalledWith('/county/cork');
    });

    it('shows the tooltip while a county has the keyboard focus, and hides it afterwards', () => {
      render(<MapView />);
      const layer = fakeLayers.get('kerry');

      layer.element.focus();
      expect(layer.openTooltip).toHaveBeenCalled();
      expect(layer.bringToFront).toHaveBeenCalled();

      layer.element.blur();
      expect(layer.closeTooltip).toHaveBeenCalled();
    });
  });
});
