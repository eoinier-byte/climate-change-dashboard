import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../routes';
import { renderWithRouter } from '../test/renderWithRouter';
import * as api from '../services/api';
import ResetPassword from './ResetPassword';

// Tests for the page the reset email links to (CCD-435). The API is a fake.
vi.mock('../services/api');

const apiError = (status, body = null) => Object.assign(new Error(`API error ${status}`), { name: 'ApiError', status, body });
const RESET_URL = '/recovery/7/code-1';
const renderPage = () => renderWithRouter(<ResetPassword />, { url: RESET_URL, path: ROUTES.recovery });
const repeat = () => screen.getByLabelText('Repeat the new password');

beforeEach(() => {
  vi.resetAllMocks();
  api.checkResetLink.mockResolvedValue({});
  api.resetPassword.mockResolvedValue({ detail: 'ok' });
});

describe('ResetPassword page', () => {
  it('checks the link first, using the user and code from the address', async () => {
    renderPage();
    expect(screen.getByRole('status').textContent).toBe('Checking your link…');
    expect(await screen.findByRole('heading', { level: 1, name: 'Choose a new password' })).toBeTruthy();
    expect(api.checkResetLink.mock.calls[0].slice(0, 2)).toEqual(['7', 'code-1']);
  });

  it.each([404, 410])('offers a new link when the server says %s', async (status) => {
    api.checkResetLink.mockRejectedValue(apiError(status));
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'This link has expired' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ask for a new link' }).getAttribute('href')).toBe(ROUTES.forgotPassword);
  });

  it('does not claim the link has expired when the check itself failed', async () => {
    api.checkResetLink.mockRejectedValue(apiError(null));
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'We could not check your link' })).toBeTruthy();
  });

  it('checks the passwords before sending', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('New password'), 'short');
    await user.type(repeat(), 'other');
    await user.click(screen.getByRole('button', { name: 'Set new password' }));

    expect(screen.getByText(/at least 8 characters\./i, { selector: '.auth-field__error' })).toBeTruthy();
    expect(screen.getByText('The two passwords do not match.')).toBeTruthy();
    expect(api.resetPassword).not.toHaveBeenCalled();
  });

  it('sends the new password and then offers the login page', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('New password'), 'a-long-password');
    await user.type(repeat(), 'a-long-password');
    await user.click(screen.getByRole('button', { name: 'Set new password' }));

    expect(api.resetPassword).toHaveBeenCalledWith('7', 'code-1', { new_password: 'a-long-password', new_password2: 'a-long-password' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Password changed' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe(ROUTES.login);
  });

  it('shows what the server says about the password, such as "too common"', async () => {
    const user = userEvent.setup();
    api.resetPassword.mockRejectedValue(apiError(400, { non_field_errors: ['This password is too common.'] }));
    renderPage();
    await user.type(await screen.findByLabelText('New password'), 'password1');
    await user.type(repeat(), 'password1');
    await user.click(screen.getByRole('button', { name: 'Set new password' }));

    expect((await screen.findByRole('alert')).textContent).toBe('This password is too common.');
  });

  it('switches to the expired message when the link is used up while the form is open', async () => {
    const user = userEvent.setup();
    api.resetPassword.mockRejectedValue(apiError(410));
    renderPage();
    await user.type(await screen.findByLabelText('New password'), 'a-long-password');
    await user.type(repeat(), 'a-long-password');
    await user.click(screen.getByRole('button', { name: 'Set new password' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'This link has expired' })).toBeTruthy();
  });
});
