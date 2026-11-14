import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  apiGet,
  getCounties,
  getCounty,
  getMap,
  getProjections,
  getSeaLevel,
} from './api';

// Tests for the API layer (CCD-141). fetch is replaced with a fake, so no real requests are made.

const BASE = 'http://api.test/api';
const MAP_CHOICES = { variable: 'temperature', scenario: 'rcp85', period: '2041-2070', season: 'annual' };

// [name, how to call it, the URL it should request]
const endpoints = [
  ['getCounties', () => getCounties(), `${BASE}/counties/`],
  ['getCounty', () => getCounty('cork'), `${BASE}/counties/cork/`],
  [
    'getProjections',
    () => getProjections({ county: 'cork', variable: 'temperature' }),
    `${BASE}/projections/?county=cork&variable=temperature`,
  ],
  ['getSeaLevel', () => getSeaLevel('cork'), `${BASE}/sea-level/cork/`],
  [
    'getMap',
    () => getMap(MAP_CHOICES),
    `${BASE}/map/?variable=temperature&scenario=rcp85&period=2041-2070&season=annual`,
  ],
];

// A fake Response with just what apiGet uses
function fakeResponse({ ok = true, status = 200, body = {} } = {}) {
  return { ok, status, json: () => Promise.resolve(body) };
}

let fetchMock;

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', BASE);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe.each(endpoints)('%s', (_name, call, expectedUrl) => {
  it('asks the right URL, built from VITE_API_URL, and returns the JSON', async () => {
    const body = { hello: 'world' };
    fetchMock.mockResolvedValue(fakeResponse({ body }));

    await expect(call()).resolves.toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(expectedUrl);
  });

  it('rejects with a readable ApiError for a 404', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ ok: false, status: 404 }));

    const error = await call().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
    expect(error.message).toMatch(/^API error 404 for \//);
  });

  it('rejects with a readable ApiError for a 500', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ ok: false, status: 500 }));

    const error = await call().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
    expect(error.message).toMatch(/^API error 500 for \//);
  });

  it('rejects with a readable ApiError when the network fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await call().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBeNull();
    // Readable for people: no raw "Failed to fetch"
    expect(error.message).toBe('Could not reach the server. Check your connection and try again.');
  });
});

describe('getMap', () => {
  it('says which choices are missing, without calling the server', async () => {
    await expect(getMap({ variable: 'temperature', scenario: 'rcp85' })).rejects.toThrow(
      'getMap needs period, season',
    );
    await expect(getMap()).rejects.toThrow('getMap needs variable, scenario, period, season');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('apiGet', () => {
  it('passes fetch options, such as an abort signal, on to fetch', async () => {
    fetchMock.mockResolvedValue(fakeResponse());
    const controller = new AbortController();

    await apiGet('/counties/', { signal: controller.signal });
    expect(fetchMock.mock.calls[0][1]).toEqual({ signal: controller.signal });
  });

  it('lets a cancelled request through as an AbortError, not an ApiError', async () => {
    const abort = new DOMException('The operation was aborted.', 'AbortError');
    fetchMock.mockRejectedValue(abort);

    const error = await apiGet('/counties/').catch((e) => e);
    expect(error).toBe(abort);
    expect(error).not.toBeInstanceOf(ApiError);
  });
});
