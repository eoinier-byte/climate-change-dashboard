// Every route in the site map, defined once. Pages and tests import from here
// so a path is never typed twice. Other stories plug in by replacing the page
// file, not by changing these paths.
export const ROUTES = {
  home: '/',
  county: '/county/:slug',
  compare: '/compare',
  seaLevel: '/sea-level',
  about: '/about',
  login: '/login',
  register: '/register',
  profile: '/profile',
};

// Build a real county URL from a slug, e.g. countyPath('cork') -> '/county/cork'
export const countyPath = (slug) => `/county/${slug}`;
