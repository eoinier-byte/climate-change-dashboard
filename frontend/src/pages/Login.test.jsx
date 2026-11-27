import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthContext';
import { ROUTES } from '../routes';
import { currentLocation, renderWithRouter } from '../test/renderWithRouter';
import Login from './Login';

// Tests for the login page (CCD-325, CCD-328). The page reads signIn and status from the auth context,
// so the tests give it their own and never call the API.

const apiError = (status, body = null) => Object.assign(new Error(`API error ${status}`), { name: 'ApiError', status, body });

function renderLogin({ status = 'signedOut', signIn = vi.fn().mockResolvedValue({}), url = ROUTES.login } = {}) {
  renderWithRouter(
    <AuthContext.Provider value={{ user: null, status, signIn }}>
      <Login />
    </AuthContext.Provider>,
    { url, path: ROUTES.login }, // a route table, so a redirect leaves this page
  );
  return { signIn };
}

const loginField = () => screen.getByLabelText('Username or email');
const passwordField = () => screen.getByLabelText('Password');
const submitButton = () => screen.getByRole('button', { name: /^log in|logging in/i });

describe('Login page', () => {
  it('has a heading, a username-or-email field, a password field, a Log in button and a link to register', () => {
    renderLogin();
    expect(screen.getByRole('heading', { level: 1, name: 'Log in' })).toBeTruthy();
    expect(loginField().getAttribute('autocomplete')).toBe('username');
    expect(passwordField().getAttribute('type')).toBe('password');
    expect(passwordField().getAttribute('autocomplete')).toBe('current-password');
    expect(submitButton()).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Create an account' }).getAttribute('href')).toBe(ROUTES.register);
  });

  it('says what is missing, and does not call the server, when the form is empty', async () => {
    const user = userEvent.setup();
    const { signIn } = renderLogin();

    await user.click(submitButton());

    expect(screen.getByText('Enter your username or email.')).toBeTruthy();
    expect(screen.getByText('Enter your password.')).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('marks a wrong field as invalid and links it to its message', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(submitButton());

    expect(loginField().getAttribute('aria-invalid')).toBe('true');
    const message = document.getElementById(loginField().getAttribute('aria-describedby'));
    expect(message.textContent).toBe('Enter your username or email.');
  });

  it('sends the login (without spaces around it) and the password', async () => {
    const user = userEvent.setup();
    const { signIn } = renderLogin();

    await user.type(loginField(), '  ronel  ');
    await user.type(passwordField(), 'secret-pw');
    await user.click(submitButton());

    expect(signIn).toHaveBeenCalledWith({ login: 'ronel', password: 'secret-pw' });
  });

  it('shows the answer of the server in an alert, keeps the username and clears the password', async () => {
    const signIn = vi.fn().mockRejectedValue(apiError(400, { detail: ['Invalid login or password.'] }));
    const user = userEvent.setup();
    renderLogin({ signIn });

    await user.type(loginField(), 'ronel');
    await user.type(passwordField(), 'wrong-pw');
    await user.click(submitButton());

    expect((await screen.findByRole('alert')).textContent).toBe('Invalid login or password.');
    expect(loginField().value).toBe('ronel');
    expect(passwordField().value).toBe('');
    expect(submitButton().disabled).toBe(false); // can try again
  });

  it('says so when the server cannot be reached', async () => {
    const signIn = vi.fn().mockRejectedValue(apiError(null));
    const user = userEvent.setup();
    renderLogin({ signIn });

    await user.type(loginField(), 'ronel');
    await user.type(passwordField(), 'secret-pw');
    await user.click(submitButton());

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not reach the server/i);
  });

  it('removes an old message when the form is sent again', async () => {
    const signIn = vi
      .fn()
      .mockRejectedValueOnce(apiError(400, { detail: ['Invalid login or password.'] }))
      .mockResolvedValue({});
    const user = userEvent.setup();
    renderLogin({ signIn });

    await user.type(loginField(), 'ronel');
    await user.type(passwordField(), 'wrong-pw');
    await user.click(submitButton());
    await screen.findByRole('alert');

    await user.type(passwordField(), 'right-pw');
    await user.click(submitButton());

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('disables the button while it waits for the server', async () => {
    const signIn = vi.fn(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderLogin({ signIn });

    await user.type(loginField(), 'ronel');
    await user.type(passwordField(), 'secret-pw');
    await user.click(submitButton());

    expect(submitButton().disabled).toBe(true);
    expect(submitButton().textContent).toBe('Logging in…');
  });

  it('sends a visitor who is already signed in to the home page', () => {
    renderLogin({ status: 'signedIn' });
    expect(currentLocation()).toBe(ROUTES.home);
  });

  it('sends a signed-in visitor back to the page they came from (CCD-325)', () => {
    const from = { pathname: ROUTES.profile, search: '?tab=email', hash: '#top' };
    renderLogin({ status: 'signedIn', url: { pathname: ROUTES.login, state: { from } } });
    expect(currentLocation()).toBe('/profile?tab=email');
  });

  it('sends a signed-in visitor home when there is no page to go back to', () => {
    renderLogin({ status: 'signedIn', url: { pathname: ROUTES.login, state: {} } });
    expect(currentLocation()).toBe(ROUTES.home);
  });
});
