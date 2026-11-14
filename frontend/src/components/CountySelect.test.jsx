// Tests for the "Choose a county" dropdown (CCD-159, CCD-166).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CountySelect from './CountySelect';
import { getCounties } from '../services/api';
import { ROUTES, countyPath } from '../routes';

// Replace the real API call with a fake, so the tests never need the backend
vi.mock('../services/api', () => ({
  getCounties: vi.fn(),
}));

// A short list in the same shape as GET /api/counties/
const counties = [
  { id: 1, name: 'Cork', slug: 'cork', has_coastline: true },
  { id: 2, name: 'Kerry', slug: 'kerry', has_coastline: true },
  { id: 3, name: 'Kildare', slug: 'kildare', has_coastline: false },
];

// A stand-in county page that shows the dropdown and which slug is in the URL,
// so a test can check the page really changed
function FakeCountyPage() {
  const { slug } = useParams();
  const location = useLocation();
  return (
    <>
      <p data-testid="current-slug">{slug}</p>
      <p data-testid="current-search">{location.search}</p>
      <CountySelect currentSlug={slug} />
    </>
  );
}

function renderAt(slug, search = '') {
  render(
    <MemoryRouter initialEntries={[countyPath(slug) + search]}>
      <Routes>
        <Route path={ROUTES.county} element={<FakeCountyPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CountySelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCounties.mockResolvedValue(counties);
  });

  it('lists every county from the API, with the current county selected', async () => {
    renderAt('cork');
    const dropdown = await screen.findByRole('combobox', { name: 'Choose a county' });

    const names = screen.getAllByRole('option').map((option) => option.textContent);
    expect(names).toEqual(['Cork', 'Kerry', 'Kildare']);
    expect(dropdown.value).toBe('cork');
  });

  it('opens the chosen county page', async () => {
    const user = userEvent.setup();
    renderAt('cork');
    const dropdown = await screen.findByRole('combobox', { name: 'Choose a county' });

    await user.selectOptions(dropdown, 'kerry');

    expect(screen.getByTestId('current-slug').textContent).toBe('kerry');
  });

  it('keeps the chosen scenarios and period when switching county (CCD-406)', async () => {
    const user = userEvent.setup();
    renderAt('cork', '?rcp=85&period=2021-2050');
    const dropdown = await screen.findByRole('combobox', { name: 'Choose a county' });

    await user.selectOptions(dropdown, 'kerry');

    expect(screen.getByTestId('current-slug').textContent).toBe('kerry');
    expect(screen.getByTestId('current-search').textContent).toBe('?rcp=85&period=2021-2050');
  });

  it('shows "Select…" when the county in the URL is not in the list', async () => {
    renderAt('atlantis');
    const dropdown = await screen.findByRole('combobox', { name: 'Choose a county' });

    expect(dropdown.value).toBe('');
    expect(screen.getByRole('option', { name: 'Select…' })).toBeTruthy();
  });

  it('stays hidden if the county list cannot load', async () => {
    getCounties.mockRejectedValue(new Error('API error 500 for /counties/'));
    renderAt('cork');

    // Wait for the failed request to finish, then check there is no dropdown
    await vi.waitFor(() => expect(getCounties).toHaveBeenCalled());
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});