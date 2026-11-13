// All API calls go through here so the base URL lives in one place (CCD-131).
const BASE_URL = import.meta.env.VITE_API_URL;

export async function apiGet(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, options);
  // fetch does not throw on 404/500, so check ok ourselves
  if (!res.ok) throw new Error(`API error ${res.status} for ${path}`);
  return res.json();
}

export const getCounties = (opts) => apiGet('/counties/', opts);
export const getCounty = (slug, opts) => apiGet(`/counties/${slug}/`, opts);

// Projection rows from the list endpoint (CCD-143).
// "filters" is an object such as { county: 'cork', variable: 'temperature' }.
// URLSearchParams turns it into "county=cork&variable=temperature" for the URL.
export const getProjections = (filters, opts) =>
  apiGet(`/projections/?${new URLSearchParams(filters)}`, opts);