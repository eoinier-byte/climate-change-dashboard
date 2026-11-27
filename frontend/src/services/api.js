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

// Django only sets the csrftoken cookie when asked (GET /auth/csrf/, docs/api.md). If the cookie is
// missing, for example on the first visit or after it expired, ask for it before the write goes out.
// If the cookie still cannot be read afterwards, the write is sent anyway and the server refuses it (403).
async function csrfToken() {
  const existing = getCsrfToken();
  if (existing) return existing;
  await request('/auth/csrf/', { credentials: 'include' });
  return getCsrfToken();
}

// A write (POST, PUT, PATCH or DELETE) with an optional JSON body. It sends the session cookie and
// the CSRF token, and answers with the parsed JSON, or null when the server sends no body (204).
export async function apiSend(method, path, data, options = {}) {
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    throw new ApiError('Signing in and saving are not available while VITE_USE_MOCKS=true.', { path });
  }

  // A FormData body (a photo upload) is sent as it is: the browser adds the multipart Content-Type itself
  const isForm = typeof FormData !== 'undefined' && data instanceof FormData;
  const headers = { Accept: 'application/json', ...options.headers };
  if (data !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const token = await csrfToken();
  if (token) headers[CSRF_HEADER] = token;

  const res = await request(path, {
    ...options,
    method,
    headers,
    credentials: 'include',
    body: data === undefined || isForm ? data : JSON.stringify(data),
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

// Accounts (CCD-299). The endpoints are described in docs/api.md, "Accounts".
// Login and register answer { detail } and sign the browser in with the session cookie.
// A 400 keeps the field errors in error.body, e.g. { email: ['A user with this email already exists.'] }.
export const registerUser = (data) => apiPost('/auth/register/', data);
export const loginUser = (data) => apiPost('/auth/login/', data);
export const logoutUser = () => apiPost('/auth/logout/');

// The signed-in user's profile. Rejects with status 403 when nobody is signed in (the API never sends 401).
export const getProfile = (opts) => apiGetWithSession('/auth/profile/me/', opts);

// The profile: { username, name, email, avatar, is_verified, pending_email }. Only username and name can be sent here.
export const updateProfile = (data) => apiPatch('/auth/profile/me/update/', data);

// A new photo: the file goes in a multipart form, field "avatar". Answers { avatar: '<url>' }.
export function changeAvatar(file) {
  const form = new FormData();
  form.append('avatar', file);
  return apiPatch('/auth/profile/me/change-avatar/', form);
}
export const deleteAvatar = () => apiDelete('/auth/profile/me/delete-avatar/');

// Deletes the signed-in user's account and photo for good (204). The server also ends the session.
export const deleteAccount = () => apiDelete('/auth/profile/me/delete/');

// data: { old_password, new_password, new_password2 }. The user stays signed in; other sessions are signed out.
export const changePassword = (data) => apiPatch('/auth/profile/me/change-password/', data);

// Asks for a link to a new address (202). The current email stays until the link is opened.
export const changeEmail = (email) => apiPatch('/auth/profile/me/change-email/', { email });

// Forgotten password. The answer is the same whether or not the address has an account.
export const requestPasswordReset = (email) => apiPost('/auth/recovery/', { email });

// The pages opened from an email link get user_id and code from the address.
// Rejects with 404 (unknown link) or 410 (already used or expired).
export const checkResetLink = (userId, code, opts) => apiGetWithSession(`/auth/reset/${userId}/${code}/`, opts);
export const resetPassword = (userId, code, data) => apiPost(`/auth/reset/${userId}/${code}/`, data);
// Confirms a registration or a new email. Rejects with 404, 409 (address taken in the meantime) or 410.
export const verifyEmailLink = (userId, code) => apiPost(`/auth/verify/${userId}/${code}/`);

// Flood map of one coastal county (CCD-360, CCD-377): the corners of the map ("bounds") and one
// see-through PNG layer per sea level, from 0 to 2 m in 0.1 m steps, each with the flooded area in km².
// An inland county has no flood map, so the server answers 404.
export const getFlood = (slug, opts) => apiGet(`/flood/${slug}/`, opts);

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
//
// Rejects with an ApiError with a readable message if the server cannot be reached, answers with
// an error (e.g. 429), sends a line that cannot be read, or stops before the answer is finished.
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

  // Signed-in users (CCD-409): the frontend and the API are on different ports, so the browser only
  // sends the session cookie with credentials: 'include'. With the cookie, Django knows who is asking
  // (and gives them the signed-in limit), but it then also wants the CSRF token on the POST, like apiSend.
  const headers = { 'Content-Type': 'application/json' };
  const token = getCsrfToken();
  if (token) headers[CSRF_HEADER] = token;

  let res;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method: 'POST',
      headers,
      credentials: 'include',
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

  // A normal answer always ends with a "done" or "error" event. This notes when one has arrived,
  // so we can tell a finished answer from one that stopped part-way.
  let finished = false;

  // Turn one line into an event and pass it on. A broken line becomes a readable error,
  // not a technical message like "Unexpected token…".
  function handleLine(line) {
    if (!line.trim()) return;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      throw new ApiError('Boreas sent an answer that could not be read. Please try again.', { path });
    }
    if (event.type === 'done' || event.type === 'error') finished = true;
    onEvent(event);
  }

  const cutOff = () => new ApiError('The answer was cut off. Please try again.', { path });

  // Read the answer as it arrives. The server sends one JSON event per line, but a chunk
  // of data can stop halfway through a line, so keep the unfinished part for the next chunk.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let leftover = '';

  try {
    let chunk = await reader.read();
    while (!chunk.done) {
      leftover += decoder.decode(chunk.value, { stream: true });
      const lines = leftover.split('\n');
      leftover = lines.pop(); // the last piece may not be a whole line yet
      lines.forEach(handleLine);
      chunk = await reader.read();
    }
    // Anything left after the last line break is the final event
    handleLine(leftover);
  } catch (error) {
    // Stopped on purpose, or a line that could not be read: pass it on as it is
    if (error?.name === 'AbortError' || error instanceof ApiError) throw error;
    // Anything else here means the connection dropped part-way through the answer
    throw cutOff();
  }

  // The stream ended without "done" or "error": the answer is incomplete
  if (!finished) throw cutOff();
}
