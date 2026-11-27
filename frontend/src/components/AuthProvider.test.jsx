import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import AuthProvider from './AuthProvider';

// The API functions are fakes, so no test talks to a server (CCD-326)
vi.mock('../services/api');

const apiError = (status, body = null) => Object.assign(new Error(`API error ${status}`), { name: 'ApiError', status, body });
const profile = { username: 'ronel', name: 'Ronel', email: 'ronel@example.com', is_verified: true };

// A small page that shows what the provider says, with a button for each thing it can do
function Probe() {
  const { user, status, signIn, register, refresh, signOut, forget } = useAuth();
  const [problem, setProblem] = useState('none');
  const tell = (error) => setProblem(error.body?.detail?.[0] ?? error.message);
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="user">{user ? user.username : 'nobody'}</p>
      <p data-testid="problem">{problem}</p>
      <button onClick={() => signIn({ login: 'ronel', password: 'pw' }).catch(tell)}>sign in</button>
      <button onClick={() => register({ username: 'new' }).catch(tell)}>register</button>
      <button onClick={() => refresh().catch(tell)}>refresh</button>
      <button onClick={() => signOut().catch(tell)}>sign out</button>
      <button onClick={() => forget()}>forget</button>
    </div>
  );
}

const status = () => screen.getByTestId('status').textContent;
const who = () => screen.getByTestId('user').textContent;
const problem = () => screen.getByTestId('problem').textContent;

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getProfile.mockResolvedValue(profile);
  api.loginUser.mockResolvedValue({ detail: 'You have signed in.' });
  api.logoutUser.mockResolvedValue({ detail: 'You have signed out.' });
  api.registerUser.mockResolvedValue({ detail: 'Your account has been created.' });
});

describe('AuthProvider (CCD-326)', () => {
  it('says nobody is signed in when there is no provider at all', () => {
    render(<Probe />);
    expect(status()).toBe('signedOut');
    expect(who()).toBe('nobody');
  });

  it('says "loading" first, then signed in with the profile when the server knows the user', async () => {
    renderProbe();
    expect(status()).toBe('loading');
    await waitFor(() => expect(status()).toBe('signedIn'));
    expect(who()).toBe('ronel');
  });

  it('asks for the profile with a signal, so the request can be cancelled', () => {
    renderProbe();
    expect(api.getProfile).toHaveBeenCalledTimes(1);
    expect(api.getProfile.mock.calls[0][0].signal).toBeInstanceOf(AbortSignal);
  });

  it('is signed out when the server answers 403 (nobody is signed in)', async () => {
    api.getProfile.mockRejectedValue(apiError(403, { detail: 'Authentication credentials were not provided.' }));
    renderProbe();
    await waitFor(() => expect(status()).toBe('signedOut'));
    expect(who()).toBe('nobody');
  });

  it('is signed out, not broken, when the server cannot be reached', async () => {
    api.getProfile.mockRejectedValue(apiError(null));
    renderProbe();
    await waitFor(() => expect(status()).toBe('signedOut'));
  });

  describe('signIn', () => {
    beforeEach(() => {
      api.getProfile.mockRejectedValueOnce(apiError(403)); // signed out at the start
    });

    it('sends the login, then loads the profile and becomes signed in', async () => {
      const user = userEvent.setup();
      renderProbe();
      await waitFor(() => expect(status()).toBe('signedOut'));

      await user.click(screen.getByRole('button', { name: 'sign in' }));

      await waitFor(() => expect(status()).toBe('signedIn'));
      expect(api.loginUser).toHaveBeenCalledWith({ login: 'ronel', password: 'pw' });
      expect(who()).toBe('ronel');
    });

    it('stays signed out and passes the error on when the login is refused', async () => {
      api.loginUser.mockRejectedValue(apiError(400, { detail: ['Invalid login or password.'] }));
      const user = userEvent.setup();
      renderProbe();
      await waitFor(() => expect(status()).toBe('signedOut'));

      await user.click(screen.getByRole('button', { name: 'sign in' }));

      await waitFor(() => expect(problem()).toBe('Invalid login or password.'));
      expect(status()).toBe('signedOut');
      expect(api.getProfile).toHaveBeenCalledTimes(1); // only the one at the start
    });
  });

  describe('register', () => {
    it('creates the account but does not change who is signed in until refresh is called', async () => {
      api.getProfile.mockRejectedValueOnce(apiError(403));
      const user = userEvent.setup();
      renderProbe();
      await waitFor(() => expect(status()).toBe('signedOut'));

      await user.click(screen.getByRole('button', { name: 'register' }));
      await waitFor(() => expect(api.registerUser).toHaveBeenCalledWith({ username: 'new' }));
      expect(status()).toBe('signedOut');

      await user.click(screen.getByRole('button', { name: 'refresh' }));
      await waitFor(() => expect(status()).toBe('signedIn'));
    });
  });

  describe('forget', () => {
    it('drops the user without calling the server', async () => {
      const user = userEvent.setup();
      renderProbe();
      await waitFor(() => expect(status()).toBe('signedIn'));

      await user.click(screen.getByRole('button', { name: 'forget' }));

      expect(status()).toBe('signedOut');
      expect(who()).toBe('nobody');
      expect(api.logoutUser).not.toHaveBeenCalled();
    });
  });

  describe('signOut', () => {
    it('signs out and forgets the user', async () => {
      const user = userEvent.setup();
      renderProbe();
      await waitFor(() => expect(status()).toBe('signedIn'));

      await user.click(screen.getByRole('button', { name: 'sign out' }));

      await waitFor(() => expect(status()).toBe('signedOut'));
      expect(api.logoutUser).toHaveBeenCalledTimes(1);
      expect(who()).toBe('nobody');
    });

    it('counts a 403 as signed out, because the session had already ended', async () => {
      api.logoutUser.mockRejectedValue(apiError(403));
      const user = userEvent.setup();
      renderProbe();
      await waitFor(() => expect(status()).toBe('signedIn'));

      await user.click(screen.getByRole('button', { name: 'sign out' }));

      await waitFor(() => expect(status()).toBe('signedOut'));
    });

    it('stays signed in, and passes the error on, when signing out fails for another reason', async () => {
      api.logoutUser.mockRejectedValue(apiError(null));
      const user = userEvent.setup();
      renderProbe();
      await waitFor(() => expect(status()).toBe('signedIn'));

      await user.click(screen.getByRole('button', { name: 'sign out' }));

      await waitFor(() => expect(problem()).not.toBe('none'));
      expect(status()).toBe('signedIn');
      expect(who()).toBe('ronel');
    });
  });
});
