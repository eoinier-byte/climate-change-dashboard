import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthContext';
import { ROUTES } from '../routes';
import { renderWithRouter } from '../test/renderWithRouter';
import * as api from '../services/api';
import EmailLink from './EmailLink';

// Tests for the pages the registration and new-email links open (CCD-436). The API is a fake.
vi.mock('../services/api');

const apiError = (status, body = null) => Object.assign(new Error(`API error ${status}`), { name: 'ApiError', status, body });

// Each test uses its own code, because the page remembers a link it has already used (see EmailLink.jsx)
let counter = 0;
function renderPage({ kind = 'register', status = 'signedOut' } = {}) {
  counter += 1;
  const path = kind === 'register' ? ROUTES.verifyEmail : ROUTES.emailUpdated;
  const url = path.replace(':userId', '7').replace(':code', `code-${counter}`);
  const refresh = vi.fn().mockResolvedValue({});
  renderWithRouter(
    <AuthContext.Provider value={{ user: null, status, refresh }}>
      <EmailLink kind={kind} />
    </AuthContext.Provider>,
    { url, path },
  );
  return { refresh, code: `code-${counter}` };
}

beforeEach(() => {
  vi.resetAllMocks();
  api.verifyEmailLink.mockResolvedValue({ detail: 'ok' });
});

describe('EmailLink page', () => {
  it('confirms a registration, using the user and code from the address, once', async () => {
    const { code } = renderPage({ kind: 'register' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Email confirmed' })).toBeTruthy();
    expect(api.verifyEmailLink).toHaveBeenCalledTimes(1);
    expect(api.verifyEmailLink).toHaveBeenCalledWith('7', code);
  });

  it('says "Email updated" for a new email address', async () => {
    renderPage({ kind: 'change' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Email updated' })).toBeTruthy();
  });

  it('offers the login page to a visitor who is not signed in, and the account page to one who is', async () => {
    renderPage();
    expect((await screen.findByRole('link', { name: 'Log in' })).getAttribute('href')).toBe(ROUTES.login);
  });

  it('loads the profile again for a signed-in visitor, so the account page shows the new state', async () => {
    const { refresh } = renderPage({ status: 'signedIn' });
    expect((await screen.findByRole('link', { name: 'Go to your account' })).getAttribute('href')).toBe(ROUTES.profile);
    expect(refresh).toHaveBeenCalled();
  });

  it('says the link has expired (410) and tells the visitor to log in and ask for a new one', async () => {
    api.verifyEmailLink.mockRejectedValue(apiError(410));
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'This link has expired' })).toBeTruthy();
    expect(screen.getByText(/ask for a new one from your account page/i)).toBeTruthy();
  });

  it('says the address is already in use (409)', async () => {
    api.verifyEmailLink.mockRejectedValue(apiError(409));
    renderPage({ kind: 'change' });
    expect(await screen.findByRole('heading', { level: 1, name: 'That email is already in use' })).toBeTruthy();
  });

  it('says it does not recognise the link (404)', async () => {
    api.verifyEmailLink.mockRejectedValue(apiError(404));
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'We do not recognise this link' })).toBeTruthy();
  });

  it('does not say "expired" when the server could not be reached', async () => {
    api.verifyEmailLink.mockRejectedValue(apiError(null));
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'We could not check your link' })).toBeTruthy();
  });
});
