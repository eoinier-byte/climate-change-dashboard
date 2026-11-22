// Tests for the choices on the home page maps: which scenarios, which year and the ▶ button.
// Fake timers, so stepping through the periods takes no real time.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import useHomeMapView, {
  DEFAULT_HOME_YEAR,
  HOME_PERIODS,
  PLAY_MS,
  homeScenariosToText,
  parseHomeScenarios,
  parseHomeYear,
} from './useHomeMapView';

// How long the page waits after the slider stops before it writes the year into the address
const URL_WAIT = 300;

// Renders the hook on a page opened at the given address. Gives back the hook's values and the address
// the page is at now, so tests can check both what the hook returns and what it wrote into the URL.
function renderView(address = '/') {
  const wrapper = ({ children }) => <MemoryRouter initialEntries={[address]}>{children}</MemoryRouter>;
  return renderHook(() => ({ ...useHomeMapView(), address: useLocation().search }), { wrapper });
}

describe('parseHomeScenarios', () => {
  it('reads a list, always in the order RCP2.6, RCP4.5, RCP8.5', () => {
    expect(parseHomeScenarios('85,26')).toEqual(['rcp26', 'rcp85']);
  });

  it('reads "none" as no scenarios', () => {
    expect(parseHomeScenarios('none')).toEqual([]);
  });

  it('uses all three when there is nothing valid', () => {
    expect(parseHomeScenarios(null)).toEqual(['rcp26', 'rcp45', 'rcp85']);
    expect(parseHomeScenarios('99')).toEqual(['rcp26', 'rcp45', 'rcp85']);
  });

  it('writes the opposite way', () => {
    expect(homeScenariosToText(['rcp26', 'rcp85'])).toBe('26,85');
    expect(homeScenariosToText([])).toBe('none');
  });
});

describe('parseHomeYear', () => {
  it('reads a whole year from 1990 to 2085', () => {
    expect(parseHomeYear('1990')).toBe(1990);
    expect(parseHomeYear('2035')).toBe(2035);
    expect(parseHomeYear('2085')).toBe(2085);
  });

  it('uses 2085 for anything else, including years outside the slider and old links made for 2100', () => {
    expect(parseHomeYear('1989')).toBe(DEFAULT_HOME_YEAR);
    expect(parseHomeYear('2100')).toBe(DEFAULT_HOME_YEAR);
    expect(parseHomeYear('20x5')).toBe(DEFAULT_HOME_YEAR);
    expect(parseHomeYear(undefined)).toBe(2085);
  });
});

describe('useHomeMapView', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const advance = (ms) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  it('starts with all three scenarios at the end of the century, not playing', () => {
    const { result } = renderView();
    expect(result.current.scenarios).toEqual(['rcp26', 'rcp45', 'rcp85']);
    expect(result.current.year).toBe(2085);
    expect(result.current.period).toBe('2071-2100');
    expect(result.current.playing).toBe(false);
  });

  it('opens on the choices in the address', () => {
    const { result } = renderView('/?rcp=45&year=2035');
    expect(result.current.scenarios).toEqual(['rcp45']);
    expect(result.current.year).toBe(2035);
    expect(result.current.period).toBe('2021-2050');
  });

  it('puts each period at the middle year of its 30 years', () => {
    expect(HOME_PERIODS.map(({ period, year, name }) => [period, year, name])).toEqual([
      ['1976-2005', 1990, 'Baseline'],
      ['2021-2050', 2035, 'Mid-century'],
      ['2071-2100', 2085, 'End of century'],
    ]);
  });

  it('unticks and re-ticks a scenario, writing it into the address and keeping the order', () => {
    const { result } = renderView();

    act(() => result.current.toggleScenario('rcp26'));
    expect(result.current.scenarios).toEqual(['rcp45', 'rcp85']);
    expect(decodeURIComponent(result.current.address)).toBe('?rcp=45,85');

    act(() => result.current.toggleScenario('rcp26'));
    expect(result.current.scenarios).toEqual(['rcp26', 'rcp45', 'rcp85']);
    expect(result.current.address).toBe(''); // all three is the default, so it is left out
  });

  it('can have no scenario ticked, and shows all three again', () => {
    const { result } = renderView('/?rcp=45');

    act(() => result.current.toggleScenario('rcp45'));
    expect(result.current.scenarios).toEqual([]);
    expect(result.current.address).toBe('?rcp=none');

    act(() => result.current.showAll());
    expect(result.current.scenarios).toHaveLength(3);
    expect(result.current.address).toBe('');
  });

  it('moves to any year at once, and writes it to the address a moment after it stops', () => {
    const { result } = renderView();

    act(() => result.current.setYear(2012));
    expect(result.current.year).toBe(2012);
    expect(result.current.address).toBe(''); // still waiting, so dragging does not rewrite the address

    advance(URL_WAIT);
    expect(result.current.address).toBe('?year=2012');

    act(() => result.current.setYear(2085));
    advance(URL_WAIT);
    expect(result.current.address).toBe(''); // back to the default
  });

  it('keeps years on the slider', () => {
    const { result } = renderView();
    act(() => result.current.setYear(1900));
    expect(result.current.year).toBe(1990);
    act(() => result.current.setYear(3000));
    expect(result.current.year).toBe(2085);
  });

  it('names the nearest period for a year between two', () => {
    const { result } = renderView();
    act(() => result.current.setYear(2005));
    expect(result.current.period).toBe('1976-2005');
    act(() => result.current.setYear(2020));
    expect(result.current.period).toBe('2021-2050');
    act(() => result.current.setYear(2065));
    expect(result.current.period).toBe('2071-2100');
  });

  it('jumps to the middle of a period, and keeps the other choices', () => {
    const { result } = renderView('/?rcp=45');
    act(() => result.current.setPeriod('1976-2005'));
    expect(result.current.year).toBe(1990);
    advance(URL_WAIT);
    expect(result.current.address).toBe('?rcp=45&year=1990');
  });

  it('runs the year on gradually when Play is pressed, from 1990 if the end is showing', () => {
    const { result } = renderView();

    act(() => result.current.togglePlay());
    expect(result.current.playing).toBe(true);
    expect(result.current.year).toBe(1990);

    advance(PLAY_MS / 2);
    expect(result.current.yearExact).toBeCloseTo(2037.5, 1);
    expect(result.current.playing).toBe(true);
    expect(result.current.address).toBe(''); // the address is left alone while it runs

    advance(PLAY_MS / 2);
    expect(result.current.year).toBe(2085);
    expect(result.current.playing).toBe(false);
    advance(URL_WAIT);
    expect(result.current.address).toBe(''); // 2085 is the default
  });

  it('plays on from the year that is showing', () => {
    const { result } = renderView('/?year=2035');
    act(() => result.current.togglePlay());
    advance(PLAY_MS);
    expect(result.current.year).toBe(2085);
    expect(result.current.playing).toBe(false);
  });

  it('stops where it is when Pause is pressed, or when the slider is moved by hand', () => {
    const { result } = renderView('/?year=1990');

    act(() => result.current.togglePlay());
    advance(PLAY_MS / 4);
    act(() => result.current.togglePlay());
    const stoppedAt = result.current.yearExact;
    expect(result.current.playing).toBe(false);
    advance(PLAY_MS);
    expect(result.current.yearExact).toBe(stoppedAt);

    act(() => result.current.togglePlay());
    act(() => result.current.setYear(2050));
    expect(result.current.playing).toBe(false);
    expect(result.current.year).toBe(2050);
  });
});
