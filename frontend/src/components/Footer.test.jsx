import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from '../App.jsx';
import { ROUTES } from '../routes';

// Every route in the route table, plus an unknown URL
const paths = [...Object.values(ROUTES).map((path) => path.replace(':slug', 'cork')), '/nope'];

function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('footer', () => {
  it.each(paths)('appears on %s', (path) => {
    renderAt(path);
    expect(screen.getByRole('contentinfo')).toBeTruthy();
  });

  it('links to the About page', () => {
    renderAt(ROUTES.home);
    const link = within(screen.getByRole('contentinfo')).getByRole('link', {
      name: 'About this dashboard',
    });
    expect(link.getAttribute('href')).toBe(ROUTES.about);
  });

  it('credits the data sources and says the models are simplified', () => {
    renderAt(ROUTES.home);
    const text = screen.getByRole('contentinfo').textContent;
    ['Met Éireann', 'EPA Climate Ireland', 'Met Office', 'Tailte Éireann', 'simplified'].forEach(
      (phrase) => expect(text).toContain(phrase),
    );
  });

  it('opens every external link at an https address', () => {
    renderAt(ROUTES.home);
    const links = within(screen.getByRole('contentinfo')).getAllByRole('link');
    links
      .filter((link) => link.getAttribute('href') !== ROUTES.about)
      .forEach((link) => expect(link.getAttribute('href')).toMatch(/^https:\/\//));
  });
});
