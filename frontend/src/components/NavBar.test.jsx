import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from '../App.jsx';
import { ROUTES, countyPath } from '../routes';

// [link text, where it goes, heading of the page it opens]
const links = [
  ['Map', ROUTES.home, /climate projections/i],
  ['Compare', ROUTES.compare, 'Compare'],
  ['Flooding', ROUTES.seaLevel, 'Flooding'],
  ['About', ROUTES.about, 'About'],
  ['Login', ROUTES.login, 'Log in'],
];

function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const mainNav = () => screen.getByRole('navigation', { name: 'Main' });
const menuButton = () => screen.getByRole('button', { name: 'Menu' });

describe('navigation bar', () => {
  it('is on the page with a link to each main page', () => {
    renderAt(countyPath('cork'));
    links.forEach(([label, href]) => {
      expect(within(mainNav()).getByRole('link', { name: label }).getAttribute('href')).toBe(href);
    });
  });

  it.each(links)('the %s link opens its page', async (label, href, heading) => {
    const user = userEvent.setup();
    renderAt(countyPath('cork'));
    await user.click(within(mainNav()).getByRole('link', { name: label }));
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy();
  });

  it('highlights the current page only', () => {
    renderAt(ROUTES.compare);
    const nav = within(mainNav());
    expect(nav.getByRole('link', { name: 'Compare' }).getAttribute('aria-current')).toBe('page');
    expect(nav.getByRole('link', { name: 'Map' }).getAttribute('aria-current')).toBeNull();
  });

  it('opens and closes the phone menu with the Menu button', async () => {
    const user = userEvent.setup();
    renderAt(ROUTES.home);
    expect(menuButton().getAttribute('aria-expanded')).toBe('false');
    await user.click(menuButton());
    expect(menuButton().getAttribute('aria-expanded')).toBe('true');
    await user.click(menuButton());
    expect(menuButton().getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the phone menu with Escape', async () => {
    const user = userEvent.setup();
    renderAt(ROUTES.home);
    await user.click(menuButton());
    await user.keyboard('{Escape}');
    expect(menuButton().getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the phone menu after choosing a link', async () => {
    const user = userEvent.setup();
    renderAt(ROUTES.home);
    await user.click(menuButton());
    await user.click(within(mainNav()).getByRole('link', { name: 'About' }));
    expect(menuButton().getAttribute('aria-expanded')).toBe('false');
  });
});
