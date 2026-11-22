// Tests for the Compare section's choices in the URL.
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import useExplorerView, { DEFAULT_PERIOD, DEFAULT_SCENARIO } from './useExplorerView';

function renderView(address = '/compare', options) {
  const wrapper = ({ children }) => <MemoryRouter initialEntries={[address]}>{children}</MemoryRouter>;
  return renderHook(() => ({ ...useExplorerView(options), address: useLocation().search }), { wrapper });
}

describe('useExplorerView', () => {
  it('starts with Cork, the baseline and each scenario at the end of the century', () => {
    const { result } = renderView();
    expect(result.current).toMatchObject({
      mode: 'scenarios',
      county: 'cork',
      county2: 'dublin',
      combos: ['base', '26-end', '45-end', '85-end'],
      scenario: DEFAULT_SCENARIO,
      period: DEFAULT_PERIOD,
    });
  });

  it('reads every choice from the address', () => {
    const { result } = renderView('/compare?mode=counties&county=donegal&county2=kerry&rcp=45&period=2021-2050&set=base,85-mid');
    expect(result.current).toMatchObject({
      mode: 'counties',
      county: 'donegal',
      county2: 'kerry',
      scenario: 'rcp45',
      period: '2021-2050',
      combos: ['base', '85-mid'],
    });
  });

  it('uses the defaults for values that are not valid', () => {
    const { result } = renderView('/compare?mode=nonsense&rcp=99&period=1999&set=x');
    expect(result.current).toMatchObject({ mode: 'scenarios', scenario: 'rcp85', period: '2071-2100', combos: ['base', '26-end', '45-end', '85-end'] });
  });

  it('never compares a county with itself', () => {
    const { result } = renderView('/compare?mode=counties&county=cork&county2=cork');
    expect(result.current.county2).not.toBe(result.current.county);
  });

  it('writes a changed choice to the address and leaves the defaults out', () => {
    const { result } = renderView();
    act(() => result.current.setMode('counties'));
    expect(result.current.address).toBe('?mode=counties');
    act(() => result.current.setScenario('rcp45'));
    expect(result.current.address).toBe('?mode=counties&rcp=45');
    act(() => result.current.setScenario('rcp85'));
    expect(result.current.address).toBe('?mode=counties');
  });

  it('ticks and unticks things to compare, in list order, and keeps at least one', () => {
    const { result } = renderView('/compare?set=base');
    act(() => result.current.toggleCombo('85-mid'));
    expect(result.current.combos).toEqual(['base', '85-mid']);
    expect(result.current.address).toBe('?set=base%2C85-mid');
    act(() => result.current.toggleCombo('base'));
    act(() => result.current.toggleCombo('85-mid')); // the last one cannot be unticked
    expect(result.current.combos).toEqual(['85-mid']);
  });

  it('swaps the counties when the first is chosen as the second', () => {
    const { result } = renderView('/compare?mode=counties&county=cork&county2=kerry');
    act(() => result.current.setCounty('kerry'));
    expect(result.current).toMatchObject({ county: 'kerry', county2: 'cork' });
  });

  it('keeps one county in the address when comparing scenarios', () => {
    const { result } = renderView();
    act(() => result.current.setCounty('kerry'));
    expect(result.current.address).toBe('?county=kerry');
  });

  it('can use other names, so the home page maps keep their own rcp', () => {
    const { result } = renderView('/?rcp=45&cmp_county=kerry', { prefix: 'cmp_' });
    expect(result.current.county).toBe('kerry');
    expect(result.current.scenario).toBe(DEFAULT_SCENARIO);
    act(() => result.current.setMode('counties'));
    expect(result.current.address).toBe('?rcp=45&cmp_county=kerry&cmp_mode=counties');
  });
});
