// Tests for the "Choose a county" dropdown (CCD-159, CCD-166).
// Uses the shared test helpers (CCD-417): renderWithRouter and mockApiSuccess.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CountySelect from './CountySelect';
import * as api from '../services/api';
import { ROUTES, countyPath } from '../routes';
import { mockApiError, mockApiSuccess } from '../test/mockApi';
import { currentLocation, renderWithRouter } from '../test/renderWithRouter';

// Replace every API function with a fake, so the tests never need the backend
vi.mock('../services/api');

// A stand-in county page that shows the dropdown, the way the real page does
function FakeCountyPage() {
  const { slug } = useParams();
  return <CountySelect currentSlug={slug} />;
}

function renderAt(slug, search = '') {
  renderWithRouter(<FakeCountyPage />, { url: countyPath(slug) + search, path: ROUTES.county });
}

describe('CountySelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The county list from the shared mock: Cork, Kerry, Kildare
    mockApiSuccess(api);
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

    expect(currentLocation()).toBe('/county/kerry');
  });

  it('keeps the chosen scenarios and period when switching county (CCD-406)', async () => {
    const user = userEvent.setup();
    renderAt('cork', '?rcp=85&period=2021-2050');
    const dropdown = await screen.findByRole('combobox', { name: 'Choose a county' });

    await user.selectOptions(dropdown, 'kerry');

    expect(currentLocation()).toBe('/county/kerry?rcp=85&period=2021-2050');
  });

  it('shows "Select…" when the county in the URL is not in the list', async () => {
    renderAt('atlantis');
    const dropdown = await screen.findByRole('combobox', { name: 'Choose a county' });

    expect(dropdown.value).toBe('');
    expect(screen.getByRole('option', { name: 'Select…' })).toBeTruthy();
  });

  it('stays hidden if the county list cannot load', async () => {
    mockApiError(api, 'getCounties', 500);
    renderAt('cork');

    // Wait for the failed request to finish, then check there is no dropdown
    await vi.waitFor(() => expect(api.getCounties).toHaveBeenCalled());
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});