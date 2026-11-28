import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { ROUTES, countyPath } from './routes';

// The county page now loads data from the API (CCD-149). These tests only check
// the routes, so the API calls are replaced with fakes that never finish loading.
vi.mock('./services/api', () => ({
  getCounties: vi.fn(() => new Promise(() => {})),
  getCounty: vi.fn(() => new Promise(() => {})),
  getProjections: vi.fn(() => new Promise(() => {})),
  getSeaLevel: vi.fn(() => new Promise(() => {})),
  getMap: vi.fn(() => new Promise(() => {})), // the home page map (CCD-380)
  checkResetLink: vi.fn(() => new Promise(() => {})), // the pages opened from an email (CCD-435, CCD-436)
  verifyEmailLink: vi.fn(() => new Promise(() => {})),
  getFavourites: vi.fn(() => new Promise(() => {})), // the county star and "My counties" (CCD-413, CCD-414)
  getFlood: vi.fn(() => new Promise(() => {})), // the flood map (CCD-377)
}));

// [path to open, heading the page should show]
// Pages that are built, so they have their own tests next to the page file
const builtPages = [
  [countyPath('cork'), 'County dashboard'],
  [ROUTES.seaLevel, 'Flooding'], // the flood page (CCD-152), tested in pages/SeaLevel.test.jsx
  [ROUTES.about, 'About'], // the methodology page (CCD-372), tested in pages/About.test.jsx
  [ROUTES.login, 'Log in'], // CCD-325, tested in pages/Login.test.jsx
  [ROUTES.register, 'Register'], // CCD-324, tested in pages/Register.test.jsx
  [ROUTES.forgotPassword, 'Forgot your password?'], // CCD-434, tested in pages/ForgotPassword.test.jsx
  [ROUTES.profile, 'Log in'], // CCD-327: a visitor who is not signed in is sent to the login page; tested in pages/Profile.test.jsx
];

// The three pages an email links to. They check the link first, so they show "Checking your link…" at the start.
// Tested in pages/ResetPassword.test.jsx and pages/EmailLink.test.jsx
const linkPages = [ROUTES.recovery, ROUTES.verifyEmail, ROUTES.emailUpdated].map((path) => path.replace(':userId', '1').replace(':code', 'abc'));

function renderAt(path) {
  render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
  );
}

describe('routes', () => {
  // The county page shows "County dashboard" while its data is loading
  it.each(builtPages)('%s renders its page', (path, heading) => {
    renderAt(path);
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy();
  });

  it.each(linkPages)('%s opens its page and checks the link', (path) => {
    renderAt(path);
    expect(screen.getByRole('status').textContent).toBe('Checking your link…');
  });

  // The home page is built too (CCD-134), with its own heading
  it('renders the home page at /', () => {
    renderAt(ROUTES.home);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/climate projections/i);
  });

  it('sends the old /compare address to the home page, where Compare now is', () => {
    renderAt('/compare');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/climate projections/i);
    expect(screen.getByRole('region', { name: 'Compare' })).toBeTruthy();
  });

  it('has a test for every route in the route table', () => {
    // built pages + email-link pages + the home page
    expect(builtPages.length + linkPages.length + 1).toBe(Object.keys(ROUTES).length);
  });

  it('shows Page not found, with a link back to the map, for an unknown URL', () => {
    renderAt('/this-page-does-not-exist');
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Back to the map' });
    expect(link.getAttribute('href')).toBe(ROUTES.home);
  });
});