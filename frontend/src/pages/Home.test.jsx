import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Home from './Home';

// The maps and the Compare section ask the API for values; here they just wait, so the test only looks at the page layout
vi.mock('../services/api', () => {
  const waiting = vi.fn(() => new Promise(() => {}));
  return { getMap: waiting, getCounties: waiting, getProjections: waiting };
});

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

  it('draws the three scenario maps inside the map area (CCD-379)', () => {
    renderHome();
    const mapArea = document.getElementById('map-root');
    const maps = within(mapArea).getByRole('region', { name: 'County maps' });
    expect(within(maps).getAllByRole('figure')).toHaveLength(3);
    expect(within(maps).getAllByRole('link')).toHaveLength(26 * 3);
  });

  it('has a Compare section under the maps, with its own settings in the address', () => {
    renderHome();
    const section = screen.getByRole('region', { name: 'Compare' });
    expect(within(section).getByRole('radio', { name: 'One county, several scenarios' })).toBeTruthy();
    expect(within(section).getByRole('radio', { name: 'Two counties, one scenario' })).toBeTruthy();
  });

  it('links to all 26 county dashboards', () => {
    renderHome();
    const list = screen.getByRole('heading', { name: 'Or choose a county' }).parentElement;
    const links = within(list).getAllByRole('link');
    expect(links).toHaveLength(26);
    expect(within(list).getByRole('link', { name: 'Cork' }).getAttribute('href')).toBe('/county/cork');
  });
});
