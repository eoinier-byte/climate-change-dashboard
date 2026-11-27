import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthContext';
import { ROUTES } from '../routes';
import * as api from '../services/api';
import { currentLocation, renderWithRouter } from '../test/renderWithRouter';
import FavouriteButton from './FavouriteButton';

// Tests for the "Save county" star (CCD-413). The API is a fake.
vi.mock('../services/api');

const apiError = (status) => Object.assign(new Error(`API error ${status}`), { name: 'ApiError', status });
const cork = { name: 'Cork', slug: 'cork', has_coastline: true };
const galway = { name: 'Galway', slug: 'galway', has_coastline: true };

function renderButton({ status = 'signedIn', slug = 'cork' } = {}) {
  renderWithRouter(
    <AuthContext.Provider value={{ user: status === 'signedIn' ? { username: 'ronel' } : null, status }}>
      <FavouriteButton slug={slug} />
    </AuthContext.Provider>,
    { url: `/county/${slug}`, path: '/county/:slug' },
  );
}

const starButton = () => screen.getByRole('button', { name: /save county|saved/i });

beforeEach(() => {
  vi.resetAllMocks();
});

describe('FavouriteButton', () => {
  it('offers a login link to a visitor who is not signed in, and asks the server nothing', () => {
    renderButton({ status: 'signedOut' });
    const link = screen.getByRole('link', { name: 'Log in to save this county' });
    expect(link.getAttribute('href')).toBe(ROUTES.login);
    expect(screen.queryByRole('button')).toBeNull();
    expect(api.getFavourites).not.toHaveBeenCalled();
  });

  it('shows nothing while the site checks who is signed in', () => {
    renderButton({ status: 'loading' });
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('takes the visitor to the login page when the link is clicked', async () => {
    const user = userEvent.setup();
    renderButton({ status: 'signedOut' });
    await user.click(screen.getByRole('link', { name: 'Log in to save this county' }));
    expect(currentLocation()).toBe(ROUTES.login);
  });

  it('shows "Save county" when the county is not a favourite', async () => {
    api.getFavourites.mockResolvedValue([galway]);
    renderButton();
    await waitFor(() => expect(starButton().disabled).toBe(false));
    expect(starButton().textContent).toContain('Save county');
    expect(starButton().getAttribute('aria-pressed')).toBe('false');
  });

  it('shows "Saved" for a favourite', async () => {
    api.getFavourites.mockResolvedValue([cork, galway]);
    renderButton();
    await waitFor(() => expect(starButton().textContent).toContain('Saved'));
    expect(starButton().getAttribute('aria-pressed')).toBe('true');
  });

  it('saves the county when the button is pressed', async () => {
    api.getFavourites.mockResolvedValue([]);
    api.addFavourite.mockResolvedValue(cork);
    const user = userEvent.setup();
    renderButton();
    await waitFor(() => expect(starButton().disabled).toBe(false));

    await user.click(starButton());

    expect(api.addFavourite).toHaveBeenCalledWith('cork');
    await waitFor(() => expect(starButton().textContent).toContain('Saved'));
  });

  it('removes the county when a saved one is pressed', async () => {
    api.getFavourites.mockResolvedValue([cork]);
    api.removeFavourite.mockResolvedValue(null);
    const user = userEvent.setup();
    renderButton();
    await waitFor(() => expect(starButton().textContent).toContain('Saved'));

    await user.click(starButton());

    expect(api.removeFavourite).toHaveBeenCalledWith('cork');
    await waitFor(() => expect(starButton().textContent).toContain('Save county'));
  });

  it('says so, and keeps the old state, when saving fails', async () => {
    api.getFavourites.mockResolvedValue([]);
    api.addFavourite.mockRejectedValue(apiError(500));
    const user = userEvent.setup();
    renderButton();
    await waitFor(() => expect(starButton().disabled).toBe(false));

    await user.click(starButton());

    expect((await screen.findByRole('alert')).textContent).toBe('We could not save this county. Please try again.');
    expect(starButton().getAttribute('aria-pressed')).toBe('false');
  });

  it('says so, and stays disabled, when the list cannot be loaded', async () => {
    api.getFavourites.mockRejectedValue(apiError(500));
    renderButton();
    expect((await screen.findByRole('alert')).textContent).toBe('We could not check your saved counties.');
    expect(starButton().disabled).toBe(true);
  });
});
