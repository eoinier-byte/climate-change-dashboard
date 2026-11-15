// Tests for the hook that loads the map values (CCD-380). The API is replaced with fakes.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMap } from '../services/api';
import useMapData from './useMapData';

vi.mock('../services/api', () => ({ getMap: vi.fn() }));

// A short answer in the shape of GET /api/map/ (the real one has 26 results)
const answer = (value) => ({
  variable: 'temperature',
  scenario: 'rcp85',
  period: '2071-2100',
  season: 'annual',
  unit: 'degC',
  min: value,
  max: value,
  results: [{ county: { name: 'Cork', slug: 'cork', has_coastline: true }, value, unit: 'degC' }],
});

// A request we can finish whenever we like, to test answers that arrive late
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Looks like the error services/api.js throws
const serverError = Object.assign(new Error('API error 500 for /map/'), { name: 'ApiError', status: 500 });

describe('useMapData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is loading first, then returns the data', async () => {
    getMap.mockResolvedValue(answer('12.500'));
    const { result } = renderHook(() => useMapData('temperature', 'rcp85', '2071-2100'));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(answer('12.500'));
    expect(result.current.error).toBeNull();
  });

  it('asks the API for all four choices, season "annual" unless told otherwise', async () => {
    getMap.mockResolvedValue(answer('12.500'));
    const { result } = renderHook(() => useMapData('temperature', 'rcp85', '2071-2100'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getMap).toHaveBeenCalledWith(
      { variable: 'temperature', scenario: 'rcp85', period: '2071-2100', season: 'annual' },
      { signal: expect.any(AbortSignal) },
    );
  });

  it('passes on a season when one is given', async () => {
    getMap.mockResolvedValue(answer('12.500'));
    const { result } = renderHook(() => useMapData('precipitation', 'rcp45', '2021-2050', 'winter'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getMap.mock.calls[0][0]).toEqual({
      variable: 'precipitation',
      scenario: 'rcp45',
      period: '2021-2050',
      season: 'winter',
    });
  });

  it('returns the error, and no data, when the request fails', async () => {
    getMap.mockRejectedValue(serverError);
    const { result } = renderHook(() => useMapData('temperature', 'rcp85', '2071-2100'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(serverError);
    expect(result.current.data).toBeNull();
  });

  it('loads again, and shows no old data, when the choice changes', async () => {
    const second = deferred();
    getMap.mockResolvedValueOnce(answer('10.000')).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(({ scenario }) => useMapData('temperature', scenario, '2071-2100'), {
      initialProps: { scenario: 'rcp45' },
    });
    await waitFor(() => expect(result.current.data).toEqual(answer('10.000')));

    rerender({ scenario: 'rcp85' });

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(getMap).toHaveBeenCalledTimes(2);
    expect(getMap.mock.calls[1][0].scenario).toBe('rcp85');

    await act(async () => second.resolve(answer('14.000')));
    expect(result.current.data).toEqual(answer('14.000'));
  });

  it('ignores an answer that arrives after the choice has changed', async () => {
    const first = deferred();
    const second = deferred();
    getMap.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(({ scenario }) => useMapData('temperature', scenario, '2071-2100'), {
      initialProps: { scenario: 'rcp45' },
    });

    rerender({ scenario: 'rcp85' }); // the slider moved before the first answer came back
    await act(async () => second.resolve(answer('14.000')));
    expect(result.current.data).toEqual(answer('14.000'));

    await act(async () => first.resolve(answer('10.000'))); // the old answer finally arrives
    expect(result.current.data).toEqual(answer('14.000'));
  });

  it('ignores an error that arrives after the choice has changed', async () => {
    const first = deferred();
    getMap.mockReturnValueOnce(first.promise).mockResolvedValueOnce(answer('14.000'));
    const { result, rerender } = renderHook(({ scenario }) => useMapData('temperature', scenario, '2071-2100'), {
      initialProps: { scenario: 'rcp45' },
    });

    rerender({ scenario: 'rcp85' });
    await waitFor(() => expect(result.current.data).toEqual(answer('14.000')));

    await act(async () => first.reject(serverError));
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(answer('14.000'));
  });

  it('cancels the request when the choice changes or the page closes', () => {
    getMap.mockReturnValue(new Promise(() => {}));
    const { rerender, unmount } = renderHook(({ scenario }) => useMapData('temperature', scenario, '2071-2100'), {
      initialProps: { scenario: 'rcp45' },
    });
    const firstSignal = getMap.mock.calls[0][1].signal;
    expect(firstSignal.aborted).toBe(false);

    rerender({ scenario: 'rcp85' });
    expect(firstSignal.aborted).toBe(true);

    const secondSignal = getMap.mock.calls[1][1].signal;
    unmount();
    expect(secondSignal.aborted).toBe(true);
  });

  it('retry() asks again after an error', async () => {
    getMap.mockRejectedValueOnce(serverError).mockResolvedValueOnce(answer('12.500'));
    const { result } = renderHook(() => useMapData('temperature', 'rcp85', '2071-2100'));
    await waitFor(() => expect(result.current.error).toBe(serverError));

    act(() => result.current.retry());

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    await waitFor(() => expect(result.current.data).toEqual(answer('12.500')));
    expect(getMap).toHaveBeenCalledTimes(2);
  });
});
