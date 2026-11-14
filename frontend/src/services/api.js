// All API calls go through here, so the base URL and the error handling live in one place
// (CCD-131, CCD-141). No component calls fetch or contains a URL.
//
// Every function returns a Promise of the parsed JSON, or rejects with an ApiError:
//   - error.status is the HTTP status (404, 500, ...), or null if the server could not be reached
//   - error.message is readable. For an HTTP error it keeps the form "API error 404 for /path/",
//     because the pages check it for "404" (e.g. County not found).
// Callers may pass fetch options as the last argument, e.g. { signal } to cancel a request.

// The error every API function throws, so pages can tell the cases apart with error.status
export class ApiError extends Error {
  constructor(message, { status = null, path = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // HTTP status, or null for a network failure
    this.path = path;
  }
}

// Read the base URL when a request is made (not when the file loads),
// so tests can set VITE_API_URL with vi.stubEnv
function baseUrl() {
  return import.meta.env.VITE_API_URL ?? '';
}

// The one place that calls fetch.
// fetch does not throw on 404/500, so we check res.ok ourselves,
// and fetch throws a TypeError when the network is down, which we turn into an ApiError too.
export async function apiGet(path, options = {}) {
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
    throw new ApiError(`API error ${res.status} for ${path}`, { status: res.status, path });
  }

  return res.json();
}

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
