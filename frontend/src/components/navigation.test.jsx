import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from '../App.jsx';
import { ROUTES, countyPath } from '../routes';

// The county page now loads data from the API (CCD-149). These tests only check
// navigation, so the API calls are replaced with fakes that never finish loading.
vi.mock('../services/api', () => ({
  getCounties: vi.fn(() => new Promise(() => {})),
  getCounty: vi.fn(() => new Promise(() => {})),
  getProjections: vi.fn(() => new Promise(() => {})),
  getSeaLevel: vi.fn(() => new Promise(() => {})),
}));

// Click-through tests: move between pages the way a visitor would.
function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const h1 = (name) => screen.getByRole('heading', { level: 1, name });
const mainNav = () => within(screen.getByRole('navigation', { name: 'Main' }));

describe('moving around the site', () => {
  it('goes from the home page to a county by search', async () => {
    const user = userEvent.setup();
    renderAt(ROUTES.home);
    await user.type(screen.getByLabelText('Find a county'), 'Galway');
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(h1('County dashboard')).toBeTruthy();
  });

  it('goes from the home page to a county by its link', async () => {
    const user = userEvent.setup();
    renderAt(ROUTES.home);
    await user.click(screen.getByRole('link', { name: 'Kerry' }));
    expect(h1('County dashboard')).toBeTruthy();
  });

  it('the brand link goes back to the home page', async () => {
    const user = userEvent.setup();
    renderAt(ROUTES.compare);
    await user.click(mainNav().getByRole('link', { name: 'Ireland Climate Futures' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/climate projections/i);
  });

  it('the footer About link opens the About page', async () => {
    const user = userEvent.setup();
    renderAt(countyPath('cork'));
    const footer = screen.getByRole('contentinfo');
    await user.click(within(footer).getByRole('link', { name: 'About this dashboard' }));
    expect(h1('About')).toBeTruthy();
  });

  it('Page not found still has the navigation bar and footer', () => {
    renderAt('/nope');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
    expect(screen.getByRole('contentinfo')).toBeTruthy();
  });

  it('the Back to the map link on Page not found goes home', async () => {
    const user = userEvent.setup();
    renderAt('/nope');
    await user.click(screen.getByRole('link', { name: 'Back to the map' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/climate projections/i);
  });

  it('moves through several pages in a row, updating the current-page highlight', async () => {
    const user = userEvent.setup();
    renderAt(ROUTES.home);
    await user.click(mainNav().getByRole('link', { name: 'Flooding' }));
    expect(h1('Flooding')).toBeTruthy();
    expect(mainNav().getByRole('link', { name: 'Flooding' }).getAttribute('aria-current')).toBe('page');
    await user.click(mainNav().getByRole('link', { name: 'Login' }));
    expect(h1('Log in')).toBeTruthy();
    expect(mainNav().getByRole('link', { name: 'Flooding' }).getAttribute('aria-current')).toBeNull();
  });
});
