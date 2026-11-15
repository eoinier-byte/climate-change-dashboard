// Tests for the Compare page's choices in the URL (CCD-207).
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PERIOD } from './useCountyView';
import useCompareView, { DEFAULT_COUNTY, DEFAULT_FIRST, DEFAULT_SECOND } from './useCompareView';

// The hook on a page opened at the given address. Gives back the hook's values and the address the page
// is at now, so a test can check both what the hook returns and what it wrote into the URL.
function renderView(address = '/compare') {
  const wrapper = ({ children }) => <MemoryRouter initialEntries={[address]}>{children}</MemoryRouter>;
  return renderHook(() => ({ ...useCompareView(), address: useLocation().search }), { wrapper });
}

describe('useCompareView', () => {
  it('starts with Cork, RCP2.6 against RCP8.5, end of century', () => {
    const { result } = renderView();
    expect(result.current).toMatchObject({
      county: 'cork',
      first: 'rcp26',
      second: 'rcp85',
      period: '2071-2100',
      address: '',
    });
    expect([DEFAULT_COUNTY, DEFAULT_FIRST, DEFAULT_SECOND, DEFAULT_PERIOD]).toEqual(['cork', 'rcp26', 'rcp85', '2071-2100']);
  });

  it('reads every choice from the address', () => {
    const { result } = renderView('/compare?county=kerry&a=45&b=26&period=2021-2050');
    expect(result.current).toMatchObject({ county: 'kerry', first: 'rcp45', second: 'rcp26', period: '2021-2050' });
  });

  it('ignores a county in capital letters or with spaces around it', () => {
    expect(renderView('/compare?county=%20Kerry%20').result.current.county).toBe('kerry');
  });

  it('uses the defaults for values that are not valid', () => {
    const { result } = renderView('/compare?county=&a=99&b=rcp45&period=1999');
    expect(result.current).toMatchObject({ county: 'cork', first: 'rcp26', second: 'rcp85', period: '2071-2100' });
  });

  it('never compares a scenario with itself', () => {
    expect(renderView('/compare?a=45&b=45').result.current).toMatchObject({ first: 'rcp45', second: 'rcp85' });
    expect(renderView('/compare?a=85&b=85').result.current).toMatchObject({ first: 'rcp85', second: 'rcp26' });
  });

  it('writes the county and the period to the address', () => {
    const { result } = renderView();
    act(() => result.current.setCounty('kerry'));
    expect(result.current.address).toBe('?county=kerry');
    act(() => result.current.setPeriod('2021-2050'));
    expect(new URLSearchParams(result.current.address).get('period')).toBe('2021-2050');
    expect(new URLSearchParams(result.current.address).get('county')).toBe('kerry');
  });

  it('writes a changed scenario as 26, 45 or 85', () => {
    const { result } = renderView();
    act(() => result.current.setFirst('rcp45'));
    expect(result.current.address).toBe('?a=45');
    expect(result.current.first).toBe('rcp45');
    expect(result.current.second).toBe('rcp85');
  });

  it('swaps the two scenarios when one is chosen that is already the other', () => {
    const { result } = renderView();
    act(() => result.current.setFirst('rcp85'));
    expect(result.current).toMatchObject({ first: 'rcp85', second: 'rcp26', address: '?a=85&b=26' });

    act(() => result.current.setSecond('rcp85'));
    expect(result.current).toMatchObject({ first: 'rcp26', second: 'rcp85', address: '' });
  });

  it('leaves a choice out of the address when it goes back to the default', () => {
    const { result } = renderView('/compare?county=kerry&period=2021-2050');
    act(() => result.current.setCounty('cork'));
    act(() => result.current.setPeriod('2071-2100'));
    expect(result.current.address).toBe('');
  });

  it('keeps other things in the address', () => {
    const { result } = renderView('/compare?utm_source=newsletter');
    act(() => result.current.setCounty('kerry'));
    expect(new URLSearchParams(result.current.address).get('utm_source')).toBe('newsletter');
  });
});
