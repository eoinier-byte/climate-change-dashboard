import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  apiDelete,
  apiGet,
  apiGetWithSession,
  apiPatch,
  apiPost,
  apiPut,
  apiSend,
  getCounties,
  getCounty,
  getCsrfToken,
  getMap,
  getProfile,
  getProjections,
  getSeaLevel,
  loginUser,
  logoutUser,
  registerUser,
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

// Mock mode (CCD-405): VITE_USE_MOCKS=true answers from src/mocks instead of calling fetch.
describe('mock mode', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCKS', 'true');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('answers from the mocks and never calls fetch', async () => {
    const counties = await getCounties();
    expect(counties).toHaveLength(26);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('works through the helper functions, including getMap', async () => {
    expect((await getCounty('cork')).name).toBe('Cork');
    expect((await getSeaLevel('cork')).series.rcp85).toBeDefined();
    expect((await getProjections({ county: 'cork' })).length).toBeGreaterThan(0);
    // the mock only knows the periods the real API accepts (1976-2005, 2021-2050, 2071-2100)
    expect((await getMap({ ...MAP_CHOICES, period: '2021-2050' })).results).toHaveLength(26);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails like the real API for an unknown county, with the status in the message', async () => {
    const error = await getCounty('atlantis').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
    expect(error.message).toBe('API error 404 for /counties/atlantis/');
  });

  it('tells the developer once that mocks are on', async () => {
    await getCounties();
    await getCounties();
    expect(console.warn.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('uses the real API again when the switch is off', async () => {
    vi.stubEnv('VITE_USE_MOCKS', 'false');
    fetchMock.mockResolvedValue(fakeResponse({ body: [] }));
    await getCounties();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});


// Session cookie and CSRF token (CCD-409). Public reads send no cookies; session calls do,
// and every write sends the CSRF token that Django keeps in its csrftoken cookie.
describe('session calls (CCD-409)', () => {
  const clearCsrfCookie = () => {
    document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  };

  beforeEach(clearCsrfCookie);
  afterEach(() => {
    clearCsrfCookie();
    vi.restoreAllMocks();
  });

  it('does not send cookies on a public read, so the other pages work without CORS credentials', async () => {
    fetchMock.mockResolvedValue(fakeResponse());
    await getCounties();
    expect(fetchMock.mock.calls[0][1]?.credentials).toBeUndefined();
  });

  it('sends the session cookie on a read that needs the signed-in user', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ body: { username: 'ronel' } }));

    await expect(apiGetWithSession('/auth/me/')).resolves.toEqual({ username: 'ronel' });
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/auth/me/`);
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });

  it('adds the CSRF header to a write request, with the session cookie', async () => {
    document.cookie = 'csrftoken=abc123; path=/';
    fetchMock.mockResolvedValue(fakeResponse({ body: { ok: true } }));

    await apiPost('/auth/login/', { username: 'ronel', password: 'secret' });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/auth/login/`);
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('include');
    expect(options.headers['X-CSRFToken']).toBe('abc123');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ username: 'ronel', password: 'secret' });
  });

  it.each([
    ['POST', (path, data) => apiPost(path, data)],
    ['PUT', (path, data) => apiPut(path, data)],
    ['PATCH', (path, data) => apiPatch(path, data)],
    ['DELETE', (path) => apiDelete(path)],
  ])('sends the CSRF header on a %s request', async (method, call) => {
    document.cookie = 'csrftoken=token-for-' + method + '; path=/';
    fetchMock.mockResolvedValue(fakeResponse());

    await call('/thing/', { a: 1 });

    const options = fetchMock.mock.calls[0][1];
    expect(options.method).toBe(method);
    expect(options.headers['X-CSRFToken']).toBe(`token-for-${method}`);
  });

  it('sends no body and no Content-Type for a DELETE', async () => {
    document.cookie = 'csrftoken=abc123; path=/';
    fetchMock.mockResolvedValue(fakeResponse());
    await apiDelete('/favourites/cork/');

    const options = fetchMock.mock.calls[0][1];
    expect(options.body).toBeUndefined();
    expect(options.headers['Content-Type']).toBeUndefined();
  });

  it('finds the CSRF token among other cookies', () => {
    document.cookie = 'theme=dark; path=/';
    document.cookie = 'csrftoken=a%2Fb; path=/';
    document.cookie = 'sessionid_copy=nope; path=/';

    expect(getCsrfToken()).toBe('a/b');
    document.cookie = 'theme=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    document.cookie = 'sessionid_copy=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('asks the server for the CSRF cookie first when there is none, then sends the write with it', async () => {
    // the fake server sets the cookie when it is asked, as Django does for GET /auth/csrf/
    fetchMock.mockImplementation(async (url) => {
      if (url.endsWith('/auth/csrf/')) document.cookie = 'csrftoken=fresh-token; path=/';
      return fakeResponse();
    });

    await apiPost('/auth/login/', { login: 'ronel', password: 'secret' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [csrfUrl, csrfOptions] = fetchMock.mock.calls[0];
    expect(csrfUrl).toBe(`${BASE}/auth/csrf/`);
    expect(csrfOptions.credentials).toBe('include');
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe(`${BASE}/auth/login/`);
    expect(options.headers['X-CSRFToken']).toBe('fresh-token');
  });

  it('does not ask for the CSRF cookie again when it already has one', async () => {
    document.cookie = 'csrftoken=abc123; path=/';
    fetchMock.mockResolvedValue(fakeResponse());

    await apiPost('/auth/logout/');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('still sends the write, without the header, if the cookie cannot be read; the server then refuses it', async () => {
    fetchMock.mockImplementation(async (url) =>
      url.endsWith('/auth/csrf/') ? fakeResponse() : fakeResponse({ ok: false, status: 403, body: { detail: 'CSRF Failed' } }),
    );

    const error = await apiPost('/auth/login/', {}).catch((e) => e);
    expect(fetchMock.mock.calls[1][1].headers['X-CSRFToken']).toBeUndefined();
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(403);
  });

  it('rejects with an ApiError, and sends nothing, when the CSRF cookie request fails', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ ok: false, status: 500 }));

    const error = await apiPost('/auth/login/', {}).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('answers null when the server sends no body (204, e.g. after logout)', async () => {
    document.cookie = 'csrftoken=abc123; path=/';
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: () => Promise.reject(new SyntaxError('no body')) });
    await expect(apiPost('/auth/logout/')).resolves.toBeNull();
  });

  it('keeps what the server said on an error, so a form can show it', async () => {
    document.cookie = 'csrftoken=abc123; path=/';
    const body = { email: ['Enter a valid email address.'] };
    fetchMock.mockResolvedValue(fakeResponse({ ok: false, status: 400, body }));

    const error = await apiPost('/auth/register/', { email: 'x' }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.message).toBe('API error 400 for /auth/register/');
    expect(error.body).toEqual(body);
  });

  it('still makes an ApiError when the error answer is not JSON', async () => {
    document.cookie = 'csrftoken=abc123; path=/';
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject(new SyntaxError('html')) });

    const error = await apiPost('/auth/login/', {}).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
    expect(error.body).toBeNull();
  });

  it('turns a network failure into a readable ApiError', async () => {
    document.cookie = 'csrftoken=abc123; path=/';
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await apiPost('/auth/login/', {}).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBeNull();
    expect(error.message).toMatch(/Could not reach the server/);
  });

  it('never writes the password or the token to localStorage or sessionStorage', async () => {
    document.cookie = 'csrftoken=abc123; path=/';
    fetchMock.mockResolvedValue(fakeResponse());
    const local = vi.spyOn(Storage.prototype, 'setItem');

    await apiPost('/auth/login/', { username: 'ronel', password: 'secret' });
    await apiSend('PUT', '/auth/profile/', { name: 'Ronel' });

    expect(local).not.toHaveBeenCalled();
  });

  it('refuses to send while mock mode is on, instead of pretending it worked', async () => {
    vi.stubEnv('VITE_USE_MOCKS', 'true');

    const error = await apiPost('/auth/login/', {}).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toMatch(/VITE_USE_MOCKS/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// The account functions (CCD-299). Paths are from docs/api.md, "Accounts".
describe('account functions (CCD-299)', () => {
  beforeEach(() => {
    document.cookie = 'csrftoken=abc123; path=/';
    fetchMock.mockResolvedValue(fakeResponse({ body: { detail: 'ok' } }));
  });
  afterEach(() => {
    document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it.each([
    ['registerUser', () => registerUser({ username: 'a' }), 'POST', '/auth/register/', { username: 'a' }],
    ['loginUser', () => loginUser({ login: 'a', password: 'b' }), 'POST', '/auth/login/', { login: 'a', password: 'b' }],
    ['logoutUser', () => logoutUser(), 'POST', '/auth/logout/', undefined],
  ])('%s sends a %s to %s with the session cookie and CSRF token', async (_name, call, method, path, body) => {
    await call();

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}${path}`);
    expect(options.method).toBe(method);
    expect(options.credentials).toBe('include');
    expect(options.headers['X-CSRFToken']).toBe('abc123');
    if (body === undefined) expect(options.body).toBeUndefined();
    else expect(JSON.parse(options.body)).toEqual(body);
  });

  it('getProfile reads the signed-in user with the session cookie', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ body: { username: 'ronel' } }));

    await expect(getProfile()).resolves.toEqual({ username: 'ronel' });
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/auth/profile/me/`);
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });

  it('getProfile rejects with status 403 when nobody is signed in', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ ok: false, status: 403, body: { detail: 'Not authenticated.' } }));

    const error = await getProfile().catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(403);
  });
});
