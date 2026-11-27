import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthContext';
import { ROUTES } from '../routes';
import { currentLocation, renderWithRouter } from '../test/renderWithRouter';
import Register from './Register';

// Tests for the registration page (CCD-324, CCD-328). The page reads register, refresh and status from the
// auth context, so the tests give it their own and never call the API.

const apiError = (status, body = null) => Object.assign(new Error(`API error ${status}`), { name: 'ApiError', status, body });

// Pretends to be AuthProvider: refresh() makes the status "signedIn", as the real one does once the profile loads
function Harness({ register, refresh }) {
  const [status, setStatus] = useState('signedOut');
  const value = {
    user: null,
    status,
    register,
    refresh: async () => {
      await refresh();
      setStatus('signedIn');
    },
  };
  return (
    <AuthContext.Provider value={value}>
      <Register />
    </AuthContext.Provider>
  );
}

function renderRegister({ register = vi.fn().mockResolvedValue({}), refresh = vi.fn().mockResolvedValue({}) } = {}) {
  renderWithRouter(<Harness register={register} refresh={refresh} />, { url: ROUTES.register });
  return { register, refresh };
}

async function fillIn(user, { username = 'ronel', email = 'ronel@example.com', password = 'a-long-password', password2 = password } = {}) {
  if (username) await user.type(screen.getByLabelText('Username'), username);
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  if (password2) await user.type(screen.getByLabelText('Repeat the password'), password2);
}

const submit = (user) => user.click(screen.getByRole('button', { name: /create account|creating/i }));

describe('Register page', () => {
  it('has a heading, four labelled fields with the right autocomplete, and a link to log in', () => {
    renderRegister();
    expect(screen.getByRole('heading', { level: 1, name: 'Register' })).toBeTruthy();
    expect(screen.getByLabelText('Username').getAttribute('autocomplete')).toBe('username');
    expect(screen.getByLabelText('Email').getAttribute('type')).toBe('email');
    expect(screen.getByLabelText('Password').getAttribute('autocomplete')).toBe('new-password');
    expect(screen.getByLabelText('Repeat the password').getAttribute('type')).toBe('password');
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe(ROUTES.login);
  });

  it('describes the password rules next to the field', () => {
    renderRegister();
    const hint = document.getElementById(screen.getByLabelText('Password').getAttribute('aria-describedby'));
    expect(hint.textContent).toMatch(/at least 8 characters/i);
  });

  it('says what is wrong with each field, and does not call the server, for an empty form', async () => {
    const user = userEvent.setup();
    const { register } = renderRegister();

    await submit(user);

    ['Choose a username.', 'Enter your email address.', 'Choose a password.', 'Type the password again.'].forEach((text) =>
      expect(screen.getByText(text)).toBeTruthy(),
    );
    expect(register).not.toHaveBeenCalled();
  });

  it('says when the passwords differ, and when the password is too short', async () => {
    const user = userEvent.setup();
    const { register } = renderRegister();

    await fillIn(user, { password: 'short', password2: 'other' });
    await submit(user);

    expect(screen.getByText('Use at least 8 characters.')).toBeTruthy();
    expect(screen.getByText('The two passwords do not match.')).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it('sends the details, then shows a "Check your email" message with the address', async () => {
    const user = userEvent.setup();
    const { register, refresh } = renderRegister();

    await fillIn(user, { username: ' ronel ', email: ' ronel@example.com ' });
    await submit(user);

    expect(await screen.findByRole('heading', { level: 1, name: 'Check your email' })).toBeTruthy();
    expect(register).toHaveBeenCalledWith({
      username: 'ronel',
      email: 'ronel@example.com',
      password: 'a-long-password',
      password2: 'a-long-password',
    });
    expect(screen.getByText('ronel@example.com')).toBeTruthy();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Back to the map' }).getAttribute('href')).toBe(ROUTES.home);
  });

  it('stays on the message, and does not jump to the home page, when the user becomes signed in', async () => {
    const user = userEvent.setup();
    renderRegister();

    await fillIn(user);
    await submit(user);

    await screen.findByRole('heading', { name: 'Check your email' });
    await waitFor(() => expect(currentLocation()).toBe(ROUTES.register));
  });

  it('still shows the message when the profile cannot be loaded afterwards', async () => {
    const user = userEvent.setup();
    renderRegister({ refresh: vi.fn().mockRejectedValue(apiError(null)) });

    await fillIn(user);
    await submit(user);

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeTruthy();
  });

  it('shows the server\'s message under the field it is about', async () => {
    const register = vi.fn().mockRejectedValue(apiError(400, { email: ['A user with this email already exists.'] }));
    const user = userEvent.setup();
    renderRegister({ register });

    await fillIn(user);
    await submit(user);

    const field = screen.getByLabelText('Email');
    await waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'));
    expect(document.getElementById(field.getAttribute('aria-describedby')).textContent).toBe('A user with this email already exists.');
    expect(screen.queryByRole('heading', { name: 'Check your email' })).toBeNull();
  });

  it('shows the password rules of the server (not tied to one field) in an alert', async () => {
    const register = vi.fn().mockRejectedValue(apiError(400, { non_field_errors: ['This password is too common.'] }));
    const user = userEvent.setup();
    renderRegister({ register });

    await fillIn(user, { password: 'password123' });
    await submit(user);

    expect((await screen.findByRole('alert')).textContent).toBe('This password is too common.');
  });

  it('can be sent again after an error, and keeps what was typed', async () => {
    const register = vi.fn().mockRejectedValue(apiError(null));
    const user = userEvent.setup();
    renderRegister({ register });

    await fillIn(user);
    await submit(user);
    await screen.findByRole('alert');

    expect(screen.getByLabelText('Username').value).toBe('ronel');
    expect(screen.getByRole('button', { name: 'Create account' }).disabled).toBe(false);
  });
});

describe('Register page when signed in already', () => {
  it('sends the visitor to the home page', () => {
    renderWithRouter(
      <AuthContext.Provider value={{ user: { username: 'ronel' }, status: 'signedIn', register: vi.fn(), refresh: vi.fn() }}>
        <Register />
      </AuthContext.Provider>,
      { url: ROUTES.register },
    );
    expect(currentLocation()).toBe(ROUTES.home);
  });
});
