import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../routes';
import { renderWithRouter } from '../test/renderWithRouter';
import * as api from '../services/api';
import ForgotPassword from './ForgotPassword';

// Tests for the "forgot your password" page (CCD-434). The API is a fake.
vi.mock('../services/api');

const apiError = (status, body = null) => Object.assign(new Error(`API error ${status}`), { name: 'ApiError', status, body });
const emailField = () => screen.getByLabelText('Email');

beforeEach(() => {
  vi.resetAllMocks();
  api.requestPasswordReset.mockResolvedValue({ detail: 'ok' });
});

describe('ForgotPassword page', () => {
  it('has a heading, an email field and a link back to log in', () => {
    renderWithRouter(<ForgotPassword />, { url: ROUTES.forgotPassword });
    expect(screen.getByRole('heading', { level: 1, name: 'Forgot your password?' })).toBeTruthy();
    expect(emailField().getAttribute('type')).toBe('email');
    expect(screen.getByRole('link', { name: 'Back to log in' }).getAttribute('href')).toBe(ROUTES.login);
  });

  it('says what is wrong, and sends nothing, for an empty or malformed address', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ForgotPassword />, { url: ROUTES.forgotPassword });

    await user.click(screen.getByRole('button', { name: 'Send link' }));
    expect(screen.getByText('Enter your email address.')).toBeTruthy();

    await user.type(emailField(), 'nope');
    await user.click(screen.getByRole('button', { name: 'Send link' }));
    expect(screen.getByText(/valid email address/i)).toBeTruthy();
    expect(api.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('sends the address, then says the same thing whether or not it has an account', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ForgotPassword />, { url: ROUTES.forgotPassword });

    await user.type(emailField(), '  ronel@example.com ');
    await user.click(screen.getByRole('button', { name: 'Send link' }));

    expect(api.requestPasswordReset).toHaveBeenCalledWith('ronel@example.com');
    expect(await screen.findByRole('heading', { level: 1, name: 'Check your email' })).toBeTruthy();
    expect(screen.getByText(/If that address has an account/)).toBeTruthy();
  });

  it('lets the visitor try another address', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ForgotPassword />, { url: ROUTES.forgotPassword });
    await user.type(emailField(), 'ronel@example.com');
    await user.click(screen.getByRole('button', { name: 'Send link' }));

    await user.click(await screen.findByRole('button', { name: 'Try another address' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Forgot your password?' })).toBeTruthy();
  });

  it('shows a message from the server, and a plain one when the server cannot be reached', async () => {
    const user = userEvent.setup();
    api.requestPasswordReset.mockRejectedValueOnce(apiError(400, { email: ['Enter a valid email address.'] }));
    renderWithRouter(<ForgotPassword />, { url: ROUTES.forgotPassword });
    await user.type(emailField(), 'ronel@example.com');
    await user.click(screen.getByRole('button', { name: 'Send link' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();

    api.requestPasswordReset.mockRejectedValueOnce(apiError(null));
    await user.click(screen.getByRole('button', { name: 'Send link' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not reach the server/i);
  });
});
