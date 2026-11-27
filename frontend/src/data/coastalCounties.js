// The 15 coastal counties (CCD-152). Only these have sea-level projections (Met Office UKCP18)
// and flood maps (backend/static/flood/<slug>/), so the flood page only offers these.
import { COUNTIES } from './counties';

// The same 15 counties as the flood map folders
const COASTAL_SLUGS = [
  'clare', 'cork', 'donegal', 'dublin', 'galway', 'kerry', 'leitrim', 'limerick',
  'louth', 'mayo', 'meath', 'sligo', 'waterford', 'wexford', 'wicklow',
];

// [{ name: 'Clare', slug: 'clare' }, ...] in alphabetical order, for the dropdown
export const COASTAL_COUNTIES = COUNTIES.filter((county) => COASTAL_SLUGS.includes(county.slug));

// The county the page opens on when the URL doesn't name one: the first in the list
export const DEFAULT_COASTAL = COASTAL_COUNTIES[0].slug;

// True for a coastal county, e.g. isCoastal('cork') -> true, isCoastal('kildare') -> false
export function isCoastal(slug) {
  return COASTAL_SLUGS.includes(slug);
}