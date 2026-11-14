import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Home from './Home';

function renderHome() {
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

describe('home page', () => {
  it('has a title and says projections, not forecasts', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/climate projections/i);
    expect(screen.getByText(/not forecasts/i)).toBeTruthy();
  });

  it('has a county search and a place for the map', () => {
    renderHome();
    expect(screen.getByLabelText('Find a county')).toBeTruthy();
    expect(document.getElementById('map-root')).not.toBeNull();
  });

  it('links to all 26 county dashboards', () => {
    renderHome();
    const list = screen.getByRole('heading', { name: 'Or choose a county' }).parentElement;
    const links = within(list).getAllByRole('link');
    expect(links).toHaveLength(26);
    expect(within(list).getByRole('link', { name: 'Cork' }).getAttribute('href')).toBe('/county/cork');
  });
});
