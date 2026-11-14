// Tests for the shared test helpers themselves (CCD-417), so we can trust them in other tests.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../services/api';
import { mockCork } from '../mocks/countyRows';
import { ROUTES } from '../routes';
import { mockApiError, mockApiLoading, mockApiSuccess, mockCountyList } from './mockApi';
import { currentLocation, renderWithRouter } from './renderWithRouter';

vi.mock('../services/api'); // every API function becomes a fake

// Small stand-in components, just for these tests
function ShowSlug() {
  const { slug } = useParams();
  return <p>Slug: {slug}</p>;
}

function GoToKerry() {
  return <Link to="/county/kerry">Kerry</Link>;
}

describe('renderWithRouter', () => {
  it('starts at the given address', () => {
    renderWithRouter(<p>Hello</p>, { url: '/county/cork?rcp=85' });
    expect(currentLocation()).toBe('/county/cork?rcp=85');
  });

  it('starts at "/" when no address is given', () => {
    renderWithRouter(<p>Hello</p>);
    expect(currentLocation()).toBe('/');
  });

  it('fills in URL values when a route pattern is given', () => {
    renderWithRouter(<ShowSlug />, { url: '/county/cork', path: ROUTES.county });
    expect(screen.getByText('Slug: cork')).toBeTruthy();
  });

  it('lets a test check that a link changed the page', async () => {
    const user = userEvent.setup();
    renderWithRouter(<GoToKerry />);

    await user.click(screen.getByRole('link', { name: 'Kerry' }));

    expect(currentLocation()).toBe('/county/kerry');
  });
});

describe('mockApi helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mockApiSuccess makes every fake answer with the mock data', async () => {
    mockApiSuccess(api);
    expect(await api.getCounties()).toEqual(mockCountyList);
    expect(await api.getCounty('cork')).toEqual(mockCork);
  });

  it('mockApiSuccess lets one answer be changed', async () => {
    mockApiSuccess(api, { counties: [] });
    expect(await api.getCounties()).toEqual([]);
  });

  it('mockApiError makes one fake fail with an HTTP error', async () => {
    mockApiSuccess(api);
    mockApiError(api, 'getCounty', 404);
    await expect(api.getCounty('atlantis')).rejects.toThrow('API error 404');
  });

  it('mockApiLoading makes the fakes never answer', async () => {
    mockApiLoading(api);
    // Race the fake against a 50 ms timer: the timer always wins
    const winner = await Promise.race([
      api.getCounty('cork').then(() => 'api'),
      new Promise((resolve) => setTimeout(() => resolve('timer'), 50)),
    ]);
    expect(winner).toBe('timer');
  });
});