// Tests that the home page map follows its controls (CCD-383): switching scenario, moving the slider
// and pressing ▶ all load new values for the map, with no page reload, on one shared colour scale.
// Leaflet and the API are fakes.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MapExplorer from './MapExplorer';
import { TEMPERATURE_RAMP } from './mapColours';
import { getMap } from '../services/api';
import { STEP_MS } from '../hooks/useMapView';

vi.mock('../services/api', () => ({ getMap: vi.fn() }));
// The map is clicked through to a county page by MapView; this test does not use that
vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => vi.fn() }));

// What the map last asked the API for. Call this after getMap.mockClear(), so the two requests for the
// shared colour range (made once, when the page opens) are not counted.
const lastChoices = () => getMap.mock.calls[getMap.mock.calls.length - 1][0];
const asked = (choices) => getMap.mock.calls.some(([sent]) => Object.entries(choices).every(([key, value]) => sent[key] === value));

// A short answer in the shape of GET /api/map/ for the given values { slug: number }
function answerWith(values) {
  const numbers = Object.values(values);
  return {
    variable: 'temperature',
    unit: 'degC',
    min: Math.min(...numbers).toFixed(3),
    max: Math.max(...numbers).toFixed(3),
    results: Object.entries(values).map(([slug, value]) => ({
      county: { name: slug, slug, has_coastline: true },
      value: value.toFixed(3),
      unit: 'degC',
    })),
  };
}

describe('MapExplorer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    getMap.mockReturnValue(new Promise(() => {})); // by default no answer arrives
  });
  afterEach(() => vi.useRealTimers());

  it('shows the controls above the map, and asks for the end-of-century RCP8.5 map first', () => {
    render(<MapExplorer />);
    expect(screen.getByRole('group', { name: 'Scenario' })).toBeTruthy();
    expect(screen.getByRole('slider')).toBeTruthy();
    expect(screen.getByTestId('map')).toBeTruthy();
    expect(asked({ variable: 'temperature', scenario: 'rcp85', period: '2071-2100', season: 'annual' })).toBe(true);
  });

  it('also asks, once, for the coolest and warmest maps, to share one colour scale', () => {
    render(<MapExplorer />);
    expect(asked({ scenario: 'baseline', period: '1976-2005', variable: 'temperature', season: 'annual' })).toBe(true);
    expect(asked({ scenario: 'rcp85', period: '2071-2100' })).toBe(true);
  });

  it('loads the map for another scenario when it is chosen, keeping the period', () => {
    render(<MapExplorer />);
    getMap.mockClear();

    fireEvent.click(screen.getByRole('radio', { name: /Middle path/ }));

    expect(getMap).toHaveBeenCalledTimes(1);
    expect(lastChoices()).toMatchObject({ scenario: 'rcp45', period: '2071-2100' });
    expect(screen.getByRole('radio', { name: /Middle path/ }).checked).toBe(true);
  });

  it('loads the map for another period when the slider is moved, keeping the scenario', () => {
    render(<MapExplorer />);
    getMap.mockClear();

    fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } });

    expect(getMap).toHaveBeenCalledTimes(1);
    expect(lastChoices()).toMatchObject({ scenario: 'rcp85', period: '2021-2050' });
    expect(screen.getByText(/Period: Mid-century/)).toBeTruthy();
  });

  it('steps to the next period when Play is pressed, then goes back to saying Play', async () => {
    render(<MapExplorer />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } });
    getMap.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /Play/ }));
    expect(screen.getByRole('button', { name: /Pause/ })).toBeTruthy();
    expect(getMap).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(STEP_MS);
    });

    expect(lastChoices().period).toBe('2071-2100');
    expect(screen.getByRole('slider').value).toBe('1');
    expect(screen.getByRole('button', { name: /Play/ })).toBeTruthy();
  });

  it('starts again from the first period when Play is pressed on the last', () => {
    render(<MapExplorer />); // it opens on the last period
    getMap.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /Play/ }));

    expect(lastChoices().period).toBe('2021-2050');
  });

  it('stops moving the map when Pause is pressed', async () => {
    render(<MapExplorer />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /Play/ }));
    fireEvent.click(screen.getByRole('button', { name: /Pause/ }));
    getMap.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(STEP_MS * 3);
    });

    expect(getMap).not.toHaveBeenCalled();
    expect(screen.getByRole('slider').value).toBe('0');
  });

  describe('one colour scale for every choice', () => {
    beforeEach(() => {
      // The coolest map is 9 to 10 degrees, the warmest 12 to 13, and a middle one 10.2 to 10.4
      getMap.mockImplementation(async ({ scenario, period }) => {
        if (scenario === 'baseline') return answerWith({ cork: 9, dublin: 10 });
        if (scenario === 'rcp85' && period === '2071-2100') return answerWith({ cork: 12, dublin: 13 });
        return answerWith({ cork: 10.2, dublin: 10.4 });
      });
    });

    const fillOf = (slug) => screen.getByTestId(`county-${slug}`).dataset.fill;

    it('colours the warmest map from the cool end to the warm end of the scale', async () => {
      render(<MapExplorer />);
      await act(async () => {});

      expect(fillOf('cork')).toBe(TEMPERATURE_RAMP[5]); // 12 on a scale of 9 to 13
      expect(fillOf('dublin')).toBe(TEMPERATURE_RAMP[6]); // 13
    });

    it('colours a cooler choice cooler, instead of stretching it over the whole scale', async () => {
      render(<MapExplorer />);
      await act(async () => {});

      fireEvent.click(screen.getByRole('radio', { name: /Middle path/ }));
      await act(async () => {});

      // 10.2 and 10.4 are close together on a 9 to 13 scale, so they are the same cool colour
      expect(fillOf('cork')).toBe(TEMPERATURE_RAMP[2]);
      expect(fillOf('dublin')).toBe(TEMPERATURE_RAMP[2]);
      expect(screen.getByText(/one scale for every scenario and period/)).toBeTruthy();
    });

    it('still colours the map from its own values if the shared range cannot be loaded', async () => {
      getMap.mockImplementation(async ({ scenario }) => {
        if (scenario === 'baseline') throw new Error('no baseline');
        return answerWith({ cork: 10.2, dublin: 10.4 });
      });
      render(<MapExplorer />);
      await act(async () => {});

      expect(fillOf('cork')).toBe(TEMPERATURE_RAMP[0]);
      expect(fillOf('dublin')).toBe(TEMPERATURE_RAMP[6]);
      expect(screen.queryByText(/one scale for every scenario and period/)).toBeNull();
    });
  });
});
