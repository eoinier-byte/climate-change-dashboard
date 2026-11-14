// The 26 counties in the dashboard data (docs/county-rules.md). Names and URL slugs only,
// so the search works before the map or the API has loaded. Slugs match the backend
// (Django slugify of the name). No climate values belong here.
const NAMES = [
  'Carlow', 'Cavan', 'Clare', 'Cork', 'Donegal', 'Dublin', 'Galway', 'Kerry', 'Kildare',
  'Kilkenny', 'Laois', 'Leitrim', 'Limerick', 'Longford', 'Louth', 'Mayo', 'Meath', 'Monaghan',
  'Offaly', 'Roscommon', 'Sligo', 'Tipperary', 'Waterford', 'Westmeath', 'Wexford', 'Wicklow',
];

export const COUNTIES = NAMES.map((name) => ({ name, slug: name.toLowerCase() }));

// Case-insensitive exact match; returns the county or undefined.
export function findCounty(text) {
  const wanted = text.trim().toLowerCase();
  return COUNTIES.find((county) => county.name.toLowerCase() === wanted);
}
