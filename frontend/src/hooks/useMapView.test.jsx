// Tests for the choices on the home page map (CCD-383): scenario, period and the ▶ button.
// Fake timers, so stepping through the periods takes no real time.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { DEFAULT_PERIOD, PERIODS } from './useCountyView';
import useMapView, { DEFAULT_SCENARIO, MAP_SCENARIOS, STEP_MS, parseScenario, parseYear, periodToYear } from './useMapView';

const FIRST = PERIODS[0];
const LAST = PERIODS[PERIODS.length - 1];

// Renders the hook on a page opened at the given address. Gives back the hook's values and the address
// the page is at now, so tests can check both what the hook returns and what it wrote into the URL.
function renderView(address = '/') {
  const wrapper = ({ children }) => <MemoryRouter initialEntries={[address]}>{children}</MemoryRouter>;
  return renderHook(() => ({ ...useMapView(), address: useLocation().search }), { wrapper });
}

describe('useMapView', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts with the end-of-century RCP8.5 map, not playing', () => {
    const { result } = renderView();
    expect(result.current.scenario).toBe(DEFAULT_SCENARIO);
    expect(result.current.scenario).toBe('rcp85');
    expect(result.current.period).toBe(DEFAULT_PERIOD);
    expect(result.current.playing).toBe(false);
  });

  it('offers the three scenarios with plain names, lowest emissions first', () => {
    expect(MAP_SCENARIOS.map(({ value, plain, rcp }) => [value, plain, rcp])).toEqual([
      ['rcp26', 'If the world cuts emissions', 'RCP2.6'],
      ['rcp45', 'Middle path', 'RCP4.5'],
      ['rcp85', 'If nothing is done', 'RCP8.5'],
    ]);
  });

  it('changes the scenario', () => {
    const { result } = renderView();
    act(() => result.current.setScenario('rcp26'));
    expect(result.current.scenario).toBe('rcp26');
  });

  it('changes the period', () => {
    const { result } = renderView();
    act(() => result.current.setPeriod(FIRST));
    expect(result.current.period).toBe(FIRST);
  });

  describe('the play button', () => {
    it('steps from the first period to the last, then stops', () => {
      const { result } = renderView();
      act(() => result.current.setPeriod(FIRST));

      act(() => result.current.togglePlay());
      expect(result.current.playing).toBe(true);

      // Not yet: it waits on each period
      act(() => vi.advanceTimersByTime(STEP_MS - 1));
      expect(result.current.period).toBe(FIRST);

      for (let step = 0; step < PERIODS.length - 1; step += 1) {
        act(() => vi.advanceTimersByTime(step === 0 ? 1 : STEP_MS));
      }
      expect(result.current.period).toBe(LAST);
      expect(result.current.playing).toBe(false);
    });

    it('starts again from the first period when the last is showing', () => {
      const { result } = renderView();
      act(() => result.current.setPeriod(LAST));

      act(() => result.current.togglePlay());

      expect(result.current.period).toBe(FIRST);
      expect(result.current.playing).toBe(true);
    });

    it('pauses where it is when pressed again', () => {
      const { result } = renderView();
      act(() => result.current.setPeriod(FIRST));
      act(() => result.current.togglePlay());

      act(() => result.current.togglePlay());
      expect(result.current.playing).toBe(false);

      act(() => vi.advanceTimersByTime(STEP_MS * 5));
      expect(result.current.period).toBe(FIRST);
    });

    it('stops when the period is chosen by hand', () => {
      const { result } = renderView();
      act(() => result.current.setPeriod(FIRST));
      act(() => result.current.togglePlay());

      act(() => result.current.setPeriod(FIRST));

      expect(result.current.playing).toBe(false);
      act(() => vi.advanceTimersByTime(STEP_MS * 5));
      expect(result.current.period).toBe(FIRST);
    });

    it('keeps playing when the scenario is changed', () => {
      const { result } = renderView();
      act(() => result.current.setPeriod(FIRST));
      act(() => result.current.togglePlay());

      act(() => result.current.setScenario('rcp45'));

      expect(result.current.playing).toBe(true);
      expect(result.current.scenario).toBe('rcp45');
    });
  });
});

describe('the map view in the URL', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sets the scenario and period from the address when the page loads', () => {
    const { result } = renderView('/?rcp=45&year=2050');
    expect(result.current.scenario).toBe('rcp45');
    expect(result.current.period).toBe('2021-2050');
    expect(result.current.playing).toBe(false);
  });

  it('reads each setting on its own, using the default for the one that is missing', () => {
    expect(renderView('/?rcp=26').result.current).toMatchObject({ scenario: 'rcp26', period: DEFAULT_PERIOD });
    expect(renderView('/?year=2050').result.current).toMatchObject({ scenario: DEFAULT_SCENARIO, period: '2021-2050' });
  });

  it('uses the defaults for a plain address', () => {
    const { result } = renderView('/');
    expect(result.current).toMatchObject({ scenario: DEFAULT_SCENARIO, period: DEFAULT_PERIOD, address: '' });
  });

  it('ignores values that are not a scenario or a period', () => {
    const { result } = renderView('/?rcp=99&year=1999');
    expect(result.current.scenario).toBe(DEFAULT_SCENARIO);
    expect(result.current.period).toBe(DEFAULT_PERIOD);
    expect(renderView('/?rcp=&year=').result.current.scenario).toBe(DEFAULT_SCENARIO);
    expect(renderView('/?rcp=rcp45&year=2021-2050').result.current).toMatchObject({
      scenario: DEFAULT_SCENARIO,
      period: DEFAULT_PERIOD,
    });
  });

  it('writes the scenario to the address when it changes', () => {
    const { result } = renderView();
    act(() => result.current.setScenario('rcp26'));
    expect(result.current.address).toBe('?rcp=26');
    expect(result.current.scenario).toBe('rcp26');
  });

  it('writes the period to the address as its last year when it changes', () => {
    const { result } = renderView();
    act(() => result.current.setPeriod(FIRST));
    expect(result.current.address).toBe('?year=2050');
  });

  it('keeps both settings when one changes', () => {
    const { result } = renderView('/?rcp=45&year=2050');
    act(() => result.current.setScenario('rcp26'));
    expect(new URLSearchParams(result.current.address).get('year')).toBe('2050');
    expect(new URLSearchParams(result.current.address).get('rcp')).toBe('26');
  });

  it('leaves a setting out of the address when it goes back to the default', () => {
    const { result } = renderView('/?rcp=45&year=2050');
    act(() => result.current.setScenario(DEFAULT_SCENARIO));
    act(() => result.current.setPeriod(DEFAULT_PERIOD));
    expect(result.current.address).toBe('');
  });

  it('keeps other things in the address', () => {
    const { result } = renderView('/?utm_source=newsletter');
    act(() => result.current.setScenario('rcp26'));
    expect(new URLSearchParams(result.current.address).get('utm_source')).toBe('newsletter');
  });

  it('writes the period to the address while the play button steps through', () => {
    const { result } = renderView('/?year=2050');
    act(() => result.current.togglePlay());
    act(() => vi.advanceTimersByTime(STEP_MS));
    expect(result.current.period).toBe(LAST);
    expect(result.current.address).toBe('');
  });

  it('does not put the play button in the address', () => {
    const { result } = renderView();
    act(() => result.current.togglePlay());
    expect(result.current.playing).toBe(true);
    expect(result.current.address).not.toMatch(/play/);
  });
});

describe('parseScenario, parseYear and periodToYear', () => {
  it('turn the address values into the names the map uses', () => {
    expect(parseScenario('26')).toBe('rcp26');
    expect(parseScenario('45')).toBe('rcp45');
    expect(parseScenario('85')).toBe('rcp85');
    expect(parseYear('2050')).toBe('2021-2050');
    expect(parseYear('2100')).toBe('2071-2100');
  });

  it('fall back to the defaults for anything else', () => {
    expect(parseScenario(undefined)).toBe(DEFAULT_SCENARIO);
    expect(parseScenario(null)).toBe(DEFAULT_SCENARIO);
    expect(parseScenario('60')).toBe(DEFAULT_SCENARIO);
    expect(parseYear(undefined)).toBe(DEFAULT_PERIOD);
    expect(parseYear('2075')).toBe(DEFAULT_PERIOD);
    expect(parseYear('2005')).toBe(DEFAULT_PERIOD); // the end of the baseline is not a future period
  });

  it('turn a period back into its last year', () => {
    PERIODS.forEach((period) => expect(parseYear(periodToYear(period))).toBe(period));
  });
});
