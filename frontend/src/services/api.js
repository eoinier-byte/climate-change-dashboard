// All API calls go through here, so the base URL and the error handling live in one place
// (CCD-131, CCD-141). No component calls fetch or contains a URL.
//
// Every function returns a Promise of the parsed JSON, or rejects with an ApiError:
//   - error.status is the HTTP status (404, 500, ...), or null if the server could not be reached
//   - error.message is readable. For an HTTP error it keeps the form "API error 404 for /path/",
//     because the pages check it for "404" (e.g. County not found).
// Callers may pass fetch options as the last argument, e.g. { signal } to cancel a request.
// With VITE_USE_MOCKS=true the answers come from src/mocks/ instead of the server (CCD-405).
//
// Signing in (CCD-409): the site uses Django session authentication. Public reads (counties,
// projections, ...) send no cookies. Calls that need a session use apiGetWithSession, apiPost,
// apiPut, apiPatch or apiDelete, which send the session cookie, and the write calls also send the
// CSRF token (read from Django's csrftoken cookie). Nothing is stored in localStorage or
// sessionStorage: the browser keeps the session cookie, and the page never sees the password again.

// The error every API function throws, so pages can tell the cases apart with error.status
export class ApiError extends Error {
  constructor(message, { status = null, path = '', body = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // HTTP status, or null for a network failure
    this.path = path;
    this.body = body; // what the server said, e.g. { email: ['Enter a valid email address.'] }, or null
  }
}

// Read the base URL when a request is made (not when the file loads),
// so tests can set VITE_API_URL with vi.stubEnv
function baseUrl() {
  return import.meta.env.VITE_API_URL ?? '';
}

// Mock mode (CCD-405): with VITE_USE_MOCKS=true in frontend/.env, every function answers with
// example data from src/mocks/ and never calls the server. Anything else uses the real API.
// VITE_MOCK_DELAY_MS=800 (optional) makes the mock answers slow, so Loading can be seen.
let warnedAboutMocks = false;

async function mockGetResponse(path) {
  if (!warnedAboutMocks) {
    warnedAboutMocks = true;
    console.warn('API mocks are ON (VITE_USE_MOCKS=true): this is example data, not the real API.');
  }
  // Loaded only now, so the mock data stays out of the normal bundle
  const { mockGet } = await import('../mocks/mockResponses');

  const delay = Number(import.meta.env.VITE_MOCK_DELAY_MS) || 0;
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

  const { status, body } = mockGet(path);
  if (status >= 400) {
    throw new ApiError(`API error ${status} for ${path}`, { status, path });
  }
  return body;
}

// Django's CSRF cookie and the header it expects back on every write request
const CSRF_COOKIE = 'csrftoken';
const CSRF_HEADER = 'X-CSRFToken';

// The CSRF token Django put in its cookie, or null if there is none yet.
// Django sets it when a view asks for it (the backend owner provides that view).
export function getCsrfToken() {
  if (typeof document === 'undefined') return null;
  const prefix = `${CSRF_COOKIE}=`;
  const pair = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return pair ? decodeURIComponent(pair.slice(prefix.length)) : null;
}

// The one place that calls fetch.
// fetch does not throw on 404/500, so we check res.ok ourselves,
// and fetch throws a TypeError when the network is down, which we turn into an ApiError too.
// An error answer keeps what the server said in error.body (the form pages need it).
async function request(path, options) {
  let res;
  try {
    res = await fetch(`${baseUrl()}${path}`, options);
  } catch (error) {
    // A cancelled request (AbortController) is not a failure: pass it on unchanged,
    // so code that ignores cancelled requests can still recognise it
    if (error?.name === 'AbortError') throw error;
    throw new ApiError('Could not reach the server. Check your connection and try again.', { path });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(`API error ${res.status} for ${path}`, { status: res.status, path, body });
  }

  return res;
}

export async function apiGet(path, options = {}) {
  if (import.meta.env.VITE_USE_MOCKS === 'true') return mockGetResponse(path);

  const res = await request(path, options);
  return res.json();
}

// A read that needs the signed-in user (for example "who am I?"): sends the session cookie.
export const apiGetWithSession = (path, options = {}) => apiGet(path, { ...options, credentials: 'include' });

// A write (POST, PUT, PATCH or DELETE) with an optional JSON body. It sends the session cookie and
// the CSRF token, and answers with the parsed JSON, or null when the server sends no body (204).
export async function apiSend(method, path, data, options = {}) {
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    throw new ApiError('Signing in and saving are not available while VITE_USE_MOCKS=true.', { path });
  }

  const headers = { Accept: 'application/json', ...options.headers };
  if (data !== undefined) headers['Content-Type'] = 'application/json';
  const token = getCsrfToken();
  if (token) headers[CSRF_HEADER] = token;

  const res = await request(path, {
    ...options,
    method,
    headers,
    credentials: 'include',
    body: data === undefined ? undefined : JSON.stringify(data),
  });

  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

export const apiPost = (path, data, options) => apiSend('POST', path, data, options);
export const apiPut = (path, data, options) => apiSend('PUT', path, data, options);
export const apiPatch = (path, data, options) => apiSend('PATCH', path, data, options);
export const apiDelete = (path, options) => apiSend('DELETE', path, undefined, options);

export const getCounties = (opts) => apiGet('/counties/', opts);
export const getCounty = (slug, opts) => apiGet(`/counties/${slug}/`, opts);

// Projection rows from the list endpoint (CCD-143).
// "filters" is an object such as { county: 'cork', variable: 'temperature' }.
// URLSearchParams turns it into "county=cork&variable=temperature" for the URL.
export const getProjections = (filters, opts) =>
  apiGet(`/projections/?${new URLSearchParams(filters)}`, opts);

// Sea-level rise for one county (CCD-407): one series per scenario, every 10 years to 2100.
// Inland counties come back with has_coastline: false and no series.
export const getSeaLevel = (slug, opts) => apiGet(`/sea-level/${slug}/`, opts);

// One value for each of the 26 counties, for the map colours (CCD-338, CCD-380).
// The endpoint needs all four choices, e.g. { variable: 'temperature', scenario: 'rcp85',
// period: '2041-2070', season: 'annual' }. It answers with { unit, min, max, results: [...] }.
const MAP_PARAMS = ['variable', 'scenario', 'period', 'season'];

export const getMap = (choices = {}, opts) => {
  // Stop a missing choice here, with a clear message, instead of getting a 400 from the server
  const missing = MAP_PARAMS.filter((name) => !choices[name]);
  if (missing.length > 0) {
    return Promise.reject(new Error(`getMap needs ${missing.join(', ')}`));
  }
  const query = new URLSearchParams(MAP_PARAMS.map((name) => [name, choices[name]]));
  return apiGet(`/map/?${query}`, opts);
};


// Everyday impact indicators for one county (CCD-364, CCD-375): hot days, frost days,
// heating degree days and growing season length. A flat list like /projections/: one row per
// indicator, scenario and period, each with baseline_value, projected_value and change.
export const getImpacts = (slug, opts) => apiGet(`/counties/${slug}/impacts/`, opts);


// Climate analogues for one county (CCD-358, CCD-373): the three European cities whose climate today
// is closest to the county's projected climate, for one scenario and one period, closest first.
// Both choices are needed, e.g. getAnalogues('cork', { scenario: 'rcp45', period: '2071-2100' }).
// The answer is a list of cities; an empty list means there is no close match.
export const getAnalogues = (slug, { scenario, period }, opts) =>
  apiGet(`/counties/${slug}/analogues/?${new URLSearchParams({ scenario, period })}`, opts);



// Flood map of one coastal county (CCD-360, CCD-377): the corners of the map ("bounds") and one
// see-through PNG layer per sea level, from 0 to 2 m in 0.1 m steps, each with the flooded area in km².
// An inland county has no flood map, so the server answers 404.
export const getFlood = (slug, opts) => apiGet(`/flood/${slug}/`, opts);