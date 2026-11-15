// Tests for the choices on the home page map (CCD-383): scenario, period and the ▶ button.
// Fake timers, so stepping through the periods takes no real time.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PERIOD, PERIODS } from './useCountyView';
import useMapView, { DEFAULT_SCENARIO, MAP_SCENARIOS, STEP_MS } from './useMapView';

const FIRST = PERIODS[0];
const LAST = PERIODS[PERIODS.length - 1];

describe('useMapView', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts with the end-of-century RCP8.5 map, not playing', () => {
    const { result } = renderHook(() => useMapView());
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
    const { result } = renderHook(() => useMapView());
    act(() => result.current.setScenario('rcp26'));
    expect(result.current.scenario).toBe('rcp26');
  });

  it('changes the period', () => {
    const { result } = renderHook(() => useMapView());
    act(() => result.current.setPeriod(FIRST));
    expect(result.current.period).toBe(FIRST);
  });

  describe('the play button', () => {
    it('steps from the first period to the last, then stops', () => {
      const { result } = renderHook(() => useMapView());
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
      const { result } = renderHook(() => useMapView());
      act(() => result.current.setPeriod(LAST));

      act(() => result.current.togglePlay());

      expect(result.current.period).toBe(FIRST);
      expect(result.current.playing).toBe(true);
    });

    it('pauses where it is when pressed again', () => {
      const { result } = renderHook(() => useMapView());
      act(() => result.current.setPeriod(FIRST));
      act(() => result.current.togglePlay());

      act(() => result.current.togglePlay());
      expect(result.current.playing).toBe(false);

      act(() => vi.advanceTimersByTime(STEP_MS * 5));
      expect(result.current.period).toBe(FIRST);
    });

    it('stops when the period is chosen by hand', () => {
      const { result } = renderHook(() => useMapView());
      act(() => result.current.setPeriod(FIRST));
      act(() => result.current.togglePlay());

      act(() => result.current.setPeriod(FIRST));

      expect(result.current.playing).toBe(false);
      act(() => vi.advanceTimersByTime(STEP_MS * 5));
      expect(result.current.period).toBe(FIRST);
    });

    it('keeps playing when the scenario is changed', () => {
      const { result } = renderHook(() => useMapView());
      act(() => result.current.setPeriod(FIRST));
      act(() => result.current.togglePlay());

      act(() => result.current.setScenario('rcp45'));

      expect(result.current.playing).toBe(true);
      expect(result.current.scenario).toBe('rcp45');
    });
  });
});
