// All API calls go through here, so the base URL and the error handling live in one place
// (CCD-131, CCD-141). No component calls fetch or contains a URL.
//
// Every function returns a Promise of the parsed JSON, or rejects with an ApiError:
//   - error.status is the HTTP status (404, 500, ...), or null if the server could not be reached
//   - error.message is readable. For an HTTP error it keeps the form "API error 404 for /path/",
//     because the pages check it for "404" (e.g. County not found).
// Callers may pass fetch options as the last argument, e.g. { signal } to cancel a request.
// With VITE_USE_MOCKS=true the answers come from src/mocks/ instead of the server (CCD-405).

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

// The one place that calls fetch.
// fetch does not throw on 404/500, so we check res.ok ourselves,
// and fetch throws a TypeError when the network is down, which we turn into an ApiError too.
export async function apiGet(path, options = {}) {
  if (import.meta.env.VITE_USE_MOCKS === 'true') return mockGetResponse(path);

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




// AI assistant chat (CCD-347, CCD-386). Unlike the GET calls above, this one POSTs the
// conversation, and the answer comes back a piece at a time ("streamed"), so the panel can
// show it while it is being written.
//
// messages: the conversation so far, oldest first, e.g. [{ role: 'user', content: 'Will Cork get hotter?' }]
//           The last one must be from the user. At most 20 messages of 500 characters each.
// context:  optional, what the person is looking at, e.g. { county: 'cork' }
// onEvent:  called once for every event the server sends:
//             { type: 'tool', name, input }   the assistant is looking up data
//             { type: 'text', text }          the next piece of the answer
//             { type: 'done', sources }       the answer is finished, with its sources
//             { type: 'error', text }         the answer could not be finished
// signal:   optional, from an AbortController, to stop the answer early
export async function sendChat(messages, context, { onEvent, signal } = {}) {
  const path = '/agent/chat/';

  // Mock mode: play back an example answer instead of calling the server
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    const { mockChatEvents } = await import('../mocks/chat');
    for await (const event of mockChatEvents(messages)) {
      if (signal?.aborted) return; // the panel was closed or a new question was asked
      onEvent(event);
    }
    return;
  }

  // Only send context when there is some, so the server never gets an empty one
  const body = { messages };
  if (context) body.context = context;

  let res;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    // Same as apiGet: a cancelled request is passed on, a network failure becomes an ApiError
    if (error?.name === 'AbortError') throw error;
    throw new ApiError('Could not reach the server. Check your connection and try again.', { path });
  }

  if (!res.ok) {
    // For 429 (too many messages) the server explains why in "detail",
    // e.g. "Sign in to keep chatting with Boreas.", so show that to the person
    let detail = '';
    try {
      detail = (await res.json()).detail ?? '';
    } catch {
      // No JSON in the answer: fall back to the normal message below
    }
    throw new ApiError(detail || `API error ${res.status} for ${path}`, { status: res.status, path });
  }

  // Read the answer as it arrives. The server sends one JSON event per line, but a chunk
  // of data can stop halfway through a line, so keep the unfinished part for the next chunk.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let leftover = '';

  let chunk = await reader.read();
  while (!chunk.done) {
    leftover += decoder.decode(chunk.value, { stream: true });
    const lines = leftover.split('\n');
    leftover = lines.pop(); // the last piece may not be a whole line yet
    for (const line of lines) {
      if (line.trim()) onEvent(JSON.parse(line));
    }
    chunk = await reader.read();
  }

  // Anything left after the last line break is the final event
  if (leftover.trim()) onEvent(JSON.parse(leftover));
}