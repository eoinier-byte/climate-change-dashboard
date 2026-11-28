import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { countyPath } from '../routes';
import * as api from '../services/api';
import { currentLocation, renderWithRouter } from '../test/renderWithRouter';
import FavouriteCounties from './FavouriteCounties';

// Tests for "My counties" on the account page (CCD-414). The API is a fake.
vi.mock('../services/api');

const apiError = (status) => Object.assign(new Error(`API error ${status}`), { name: 'ApiError', status });
const cork = { name: 'Cork', slug: 'cork', has_coastline: true };
const galway = { name: 'Galway', slug: 'galway', has_coastline: true };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('FavouriteCounties', () => {
  it('shows a loading message, then a link for each saved county', async () => {
    api.getFavourites.mockResolvedValue([cork, galway]);
    renderWithRouter(<FavouriteCounties />);

    expect(screen.getByText('Loading your counties…')).toBeTruthy();
    const links = await screen.findAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Cork', 'Galway']);
    expect(links[0].getAttribute('href')).toBe(countyPath('cork'));
  });

  it('says there is nothing saved yet, and points to the map', async () => {
    api.getFavourites.mockResolvedValue([]);
    renderWithRouter(<FavouriteCounties />);

    expect(await screen.findByText(/You have not saved any counties yet/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'pick one on the map' }).getAttribute('href')).toBe('/');
  });

  it('says so when the list cannot be loaded', async () => {
    api.getFavourites.mockRejectedValue(apiError(500));
    renderWithRouter(<FavouriteCounties />);
    expect((await screen.findByRole('alert')).textContent).toBe('We could not load your counties. Please try again later.');
  });

  it('opens the county page when a county is clicked', async () => {
    api.getFavourites.mockResolvedValue([cork]);
    const user = userEvent.setup();
    renderWithRouter(<FavouriteCounties />);

    await user.click(await screen.findByRole('link', { name: 'Cork' }));
    expect(currentLocation()).toBe(countyPath('cork'));
  });

  it('removes a county from the list when its Remove button is pressed', async () => {
    api.getFavourites.mockResolvedValue([cork, galway]);
    api.removeFavourite.mockResolvedValue(null);
    const user = userEvent.setup();
    renderWithRouter(<FavouriteCounties />);

    await user.click(await screen.findByRole('button', { name: 'Remove Cork' }));

    expect(api.removeFavourite).toHaveBeenCalledWith('cork');
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Cork' })).toBeNull());
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
  });

  it('keeps the county and says so when removing fails', async () => {
    api.getFavourites.mockResolvedValue([cork]);
    api.removeFavourite.mockRejectedValue(apiError(500));
    const user = userEvent.setup();
    renderWithRouter(<FavouriteCounties />);

    await user.click(await screen.findByRole('button', { name: 'Remove Cork' }));

    expect((await screen.findByRole('alert')).textContent).toBe('We could not remove Cork. Please try again.');
    expect(screen.getByRole('link', { name: 'Cork' })).toBeTruthy();
  });
});
