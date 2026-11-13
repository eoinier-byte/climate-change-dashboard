// Tests for reading and writing the county page's scenario and period in the URL (CCD-406).
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import useCountyView, { DEFAULT_PERIOD, parsePeriod, parseScenarios, scenariosToText } from './useCountyView';

describe('parseScenarios (reading ?rcp=)', () => {
  it('turns "26,85" into the scenario keys', () => {
    expect(parseScenarios('26,85')).toEqual(['rcp26', 'rcp85']);
  });

  it('keeps the usual order and drops repeats', () => {
    expect(parseScenarios('85,26,85')).toEqual(['rcp26', 'rcp85']);
  });

  it('ignores values that are not scenarios', () => {
    expect(parseScenarios('45,99,abc')).toEqual(['rcp45']);
  });

  it('falls back to all three when missing or nothing is valid', () => {
    expect(parseScenarios(null)).toEqual(['rcp26', 'rcp45', 'rcp85']);
    expect(parseScenarios('99')).toEqual(['rcp26', 'rcp45', 'rcp85']);
  });
});

describe('scenariosToText (writing ?rcp=)', () => {
  it('turns the scenario keys into "26,85"', () => {
    expect(scenariosToText(['rcp26', 'rcp85'])).toBe('26,85');
  });
});

describe('parsePeriod (reading ?period=)', () => {
  it('accepts a known period', () => {
    expect(parsePeriod('2021-2050')).toBe('2021-2050');
  });

  it('falls back to 2071-2100 when missing or unknown', () => {
    expect(DEFAULT_PERIOD).toBe('2071-2100');
    expect(parsePeriod(null)).toBe('2071-2100');
    expect(parsePeriod('1900-1950')).toBe('2071-2100');
  });
});

describe('useCountyView', () => {
  // Runs the hook inside a router that starts at "url", and also reports the current URL
  function setup(url) {
    const wrapper = ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
    return renderHook(() => ({ view: useCountyView(), location: useLocation() }), { wrapper });
  }

  it('reads the scenarios and period from the URL', () => {
    const { result } = setup('/county/cork?rcp=85&period=2021-2050');
    expect(result.current.view.scenarios).toEqual(['rcp85']);
    expect(result.current.view.period).toBe('2021-2050');
  });

  it('uses the defaults when the URL has no settings', () => {
    const { result } = setup('/county/cork');
    expect(result.current.view.scenarios).toEqual(['rcp26', 'rcp45', 'rcp85']);
    expect(result.current.view.period).toBe('2071-2100');
  });

  it('writes a new choice into the URL', () => {
    const { result } = setup('/county/cork');

    act(() => result.current.view.setScenarios(['rcp26', 'rcp85']));
    act(() => result.current.view.setPeriod('2021-2050'));

    expect(result.current.location.search).toBe('?rcp=26%2C85&period=2021-2050');
  });

  it('removes a setting from the URL when it goes back to the default', () => {
    const { result } = setup('/county/cork?rcp=85&period=2021-2050');

    act(() => result.current.view.setScenarios(['rcp26', 'rcp45', 'rcp85']));
    act(() => result.current.view.setPeriod('2071-2100'));

    expect(result.current.location.search).toBe('');
  });
});