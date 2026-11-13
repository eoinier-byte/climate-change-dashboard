import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App.jsx';
import { ROUTES, countyPath } from './routes';

// Pages that are still a "Coming soon" placeholder: [path to open, heading the page should show]
const placeholders = [
  [countyPath('cork'), 'County dashboard'],
  [ROUTES.compare, 'Compare'],
  [ROUTES.seaLevel, 'Flooding'],
  [ROUTES.about, 'About'],
  [ROUTES.login, 'Log in'],
  [ROUTES.register, 'Register'],
  [ROUTES.profile, 'Profile'],
];

function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('routes', () => {
  it.each(placeholders)('%s renders its page with a Coming soon placeholder', (path, heading) => {
    renderAt(path);
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy();
    expect(screen.getByText('Coming soon.')).toBeTruthy();
  });

  it('renders the home page at /', () => {
    renderAt(ROUTES.home);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/climate projections/i);
  });

  it('has a test for every route in the route table', () => {
    // placeholders + the home page
    expect(placeholders.length + 1).toBe(Object.keys(ROUTES).length);
  });

  it('shows Page not found, with a link back to the map, for an unknown URL', () => {
    renderAt('/this-page-does-not-exist');
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Back to the map' });
    expect(link.getAttribute('href')).toBe(ROUTES.home);
  });
});
