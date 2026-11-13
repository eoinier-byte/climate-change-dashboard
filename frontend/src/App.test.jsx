import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { ROUTES, countyPath } from './routes';

// The county page now loads data from the API (CCD-149). These tests only check
// the routes, so the API calls are replaced with fakes that never finish loading.
vi.mock('./services/api', () => ({
  getCounty: vi.fn(() => new Promise(() => {})),
  getProjections: vi.fn(() => new Promise(() => {})),
}));

// [path to open, heading the page should show]
// Pages that are not built yet and still show the Coming soon placeholder
const pages = [
  [ROUTES.home, 'Map'],
  [ROUTES.compare, 'Compare'],
  [ROUTES.seaLevel, 'Flooding'],
  [ROUTES.about, 'About'],
  [ROUTES.login, 'Log in'],
  [ROUTES.register, 'Register'],
  [ROUTES.profile, 'Profile'],
];

// Pages that are built, so they have their own tests next to the page file
const builtPages = [[countyPath('cork'), 'County dashboard']];

function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('routes', () => {
  it.each(pages)('%s renders its page with a Coming soon placeholder', (path, heading) => {
    renderAt(path);
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy();
    expect(screen.getByText('Coming soon.')).toBeTruthy();
  });

  // The county page shows "County dashboard" while its data is loading
  it.each(builtPages)('%s renders its page', (path, heading) => {
    renderAt(path);
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy();
  });

  it('has a test for every route in the route table', () => {
    expect(pages.length + builtPages.length).toBe(Object.keys(ROUTES).length);
  });

  it('shows Page not found, with a link back to the map, for an unknown URL', () => {
    renderAt('/this-page-does-not-exist');
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Back to the map' });
    expect(link.getAttribute('href')).toBe(ROUTES.home);
  });
});