import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthContext';
import { ROUTES } from '../routes';
import { currentLocation, renderWithRouter } from '../test/renderWithRouter';
import * as api from '../services/api';
import Profile from './Profile';

// Tests for the account page (CCD-327, CCD-432, CCD-433). The API is a fake.
vi.mock('../services/api');

const apiError = (status, body = null) => Object.assign(new Error(`API error ${status}`), { name: 'ApiError', status, body });
const baseUser = { username: 'ronel', name: 'Ronel Mombo', email: 'ronel@example.com', avatar: null, is_verified: true, pending_email: null };

function renderProfile({ user = baseUser, status = 'signedIn', refresh = vi.fn().mockResolvedValue(user), forget = vi.fn() } = {}) {
  renderWithRouter(
    <AuthContext.Provider value={{ user: status === 'signedIn' ? user : null, status, refresh, forget }}>
      <Profile />
    </AuthContext.Provider>,
    { url: ROUTES.profile, path: ROUTES.profile }, // a route table, so a redirect leaves this page
  );
  return { refresh, forget };
}

beforeEach(() => {
  vi.resetAllMocks();
  api.getFavourites.mockResolvedValue([]); // "My counties" loads its list
});

describe('Profile page: who may see it', () => {
  it('sends a visitor who is not signed in to the login page', () => {
    renderProfile({ status: 'signedOut' });
    expect(currentLocation()).toBe(ROUTES.login);
  });

  it('remembers the page, so the login page can bring the visitor back (CCD-325)', () => {
    // A stand-in for the login page that shows what it was told in "from"
    function LoginStandIn() {
      const from = useLocation().state?.from;
      return <p data-testid="from">{from ? from.pathname + from.search : 'nothing'}</p>;
    }
    render(
      <AuthContext.Provider value={{ user: null, status: 'signedOut', refresh: vi.fn(), forget: vi.fn() }}>
        <MemoryRouter initialEntries={[`${ROUTES.profile}?tab=email`]}>
          <Routes>
            <Route path={ROUTES.profile} element={<Profile />} />
            <Route path={ROUTES.login} element={<LoginStandIn />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.getByTestId('from').textContent).toBe('/profile?tab=email');
  });

  it('shows a loading message while the site checks who is signed in', () => {
    renderProfile({ status: 'loading' });
    expect(screen.getByRole('status').textContent).toBe('Loading your account…');
  });

  it('shows the five sections', () => {
    renderProfile();
    expect(screen.getByRole('heading', { level: 1, name: 'Account' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Your details' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'My counties' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Email' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Password' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Delete account' })).toBeTruthy();
  });
});

describe('Profile page: details', () => {
  it('shows the username and name in the fields and initials when there is no photo', () => {
    renderProfile();
    expect(screen.getByLabelText('Username').value).toBe('ronel');
    expect(screen.getByLabelText('Name').value).toBe('Ronel Mombo');
    expect(screen.getByText('RM')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove photo' })).toBeNull();
  });

  it('saves the username and name, loads the profile again and says it is saved', async () => {
    const user = userEvent.setup();
    api.updateProfile.mockResolvedValue({});
    const { refresh } = renderProfile();

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Ronel M');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(api.updateProfile).toHaveBeenCalledWith({ username: 'ronel', name: 'Ronel M' });
    expect(refresh).toHaveBeenCalled();
    expect(await screen.findByText('Your details are saved.')).toBeTruthy();
  });

  it('shows the server message when the username is taken', async () => {
    const user = userEvent.setup();
    api.updateProfile.mockRejectedValue(apiError(400, { username: ['A user with that username already exists.'] }));
    renderProfile();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('A user with that username already exists.')).toBeTruthy();
    expect(screen.queryByText('Your details are saved.')).toBeNull();
  });

  it('refuses an empty username without calling the server', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.clear(screen.getByLabelText('Username'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('Choose a username.')).toBeTruthy();
    expect(api.updateProfile).not.toHaveBeenCalled();
  });

  it('uploads a chosen photo and loads the profile again', async () => {
    const user = userEvent.setup();
    api.changeAvatar.mockResolvedValue({ avatar: 'http://x/a.jpg' });
    const { refresh } = renderProfile();
    const file = new File(['x'], 'me.png', { type: 'image/png' });

    await user.upload(screen.getByLabelText('Choose a photo'), file);

    await waitFor(() => expect(api.changeAvatar).toHaveBeenCalledWith(file));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('does not send a file that is not a photo', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderProfile();

    await user.upload(screen.getByLabelText('Choose a photo'), new File(['x'], 'notes.pdf', { type: 'application/pdf' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/JPEG, PNG or HEIC/);
    expect(api.changeAvatar).not.toHaveBeenCalled();
  });

  it('shows the photo, and removes it on request', async () => {
    const user = userEvent.setup();
    api.deleteAvatar.mockResolvedValue(null);
    const { refresh } = renderProfile({ user: { ...baseUser, avatar: 'http://x/a.jpg' } });

    expect(screen.getByRole('img', { name: 'Your photo' }).getAttribute('src')).toBe('http://x/a.jpg');
    await user.click(screen.getByRole('button', { name: 'Remove photo' }));

    await waitFor(() => expect(api.deleteAvatar).toHaveBeenCalled());
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});

describe('Profile page: email', () => {
  it('shows the address as confirmed, or says it is not confirmed yet', () => {
    renderProfile();
    expect(screen.getByText('ronel@example.com')).toBeTruthy();
    expect(screen.getByText('✓ Confirmed')).toBeTruthy();
  });

  it('says when the address is not confirmed yet', () => {
    renderProfile({ user: { ...baseUser, is_verified: false } });
    expect(screen.getByText('Not confirmed yet')).toBeTruthy();
  });

  it('shows a pending new address', () => {
    renderProfile({ user: { ...baseUser, pending_email: 'new@example.com' } });
    expect(screen.getByText('Waiting for you to confirm new@example.com.')).toBeTruthy();
  });

  it('asks for a link to the new address and loads the profile again', async () => {
    const user = userEvent.setup();
    api.changeEmail.mockResolvedValue({ email: 'new@example.com' });
    const { refresh } = renderProfile();

    await user.type(screen.getByLabelText('New email'), ' new@example.com ');
    await user.click(screen.getByRole('button', { name: 'Send confirmation link' }));

    expect(api.changeEmail).toHaveBeenCalledWith('new@example.com');
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.getByLabelText('New email').value).toBe('');
  });

  it('shows the server message when the address is already used', async () => {
    const user = userEvent.setup();
    api.changeEmail.mockRejectedValue(apiError(400, { email: ['A user with this email already exists.'] }));
    renderProfile();
    await user.type(screen.getByLabelText('New email'), 'taken@example.com');
    await user.click(screen.getByRole('button', { name: 'Send confirmation link' }));
    expect(await screen.findByText('A user with this email already exists.')).toBeTruthy();
  });
});

describe('Profile page: password', () => {
  const fill = async (user, { old = 'old-password', next = 'a-long-password', again = 'a-long-password' } = {}) => {
    // user.type cannot type an empty text, so an empty field is simply left alone
    if (old) await user.type(screen.getByLabelText('Current password'), old);
    if (next) await user.type(screen.getByLabelText('New password'), next);
    if (again) await user.type(screen.getByLabelText('Repeat the new password'), again);
    await user.click(screen.getByRole('button', { name: 'Change password' }));
  };

  it('sends the three passwords, empties the form and says the password is changed', async () => {
    const user = userEvent.setup();
    api.changePassword.mockResolvedValue({});
    renderProfile();

    await fill(user);

    expect(api.changePassword).toHaveBeenCalledWith({
      old_password: 'old-password',
      new_password: 'a-long-password',
      new_password2: 'a-long-password',
    });
    expect(await screen.findByText('Your password is changed.')).toBeTruthy();
    expect(screen.getByLabelText('Current password').value).toBe('');
  });

  it('checks the form before sending', async () => {
    const user = userEvent.setup();
    renderProfile();
    await fill(user, { old: '', next: 'short', again: 'other' });
    expect(screen.getByText('Enter your current password.')).toBeTruthy();
    expect(screen.getByText('The two passwords do not match.')).toBeTruthy();
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('shows the server message for a wrong current password and clears that field', async () => {
    const user = userEvent.setup();
    api.changePassword.mockRejectedValue(apiError(400, { old_password: ['Your old password was entered incorrectly.'] }));
    renderProfile();
    await fill(user);
    expect(await screen.findByText('Your old password was entered incorrectly.')).toBeTruthy();
    expect(screen.getByLabelText('Current password').value).toBe('');
    expect(screen.queryByText('Your password is changed.')).toBeNull();
  });
});

describe('Profile page: delete account (CCD-448)', () => {
  it('only opens a question when the button is pressed, and deletes nothing yet', async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole('button', { name: 'Delete my account…' }));

    expect(screen.getByText('Are you sure? This cannot be undone.')).toBeTruthy();
    expect(api.deleteAccount).not.toHaveBeenCalled();
    // Focus starts on the safe choice
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('goes back to the single button when Cancel is pressed', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole('button', { name: 'Delete my account…' }));

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Delete my account…' })).toBeTruthy();
    expect(screen.queryByText('Are you sure? This cannot be undone.')).toBeNull();
    expect(api.deleteAccount).not.toHaveBeenCalled();
  });

  it('deletes the account, forgets the user and goes to the home page', async () => {
    const user = userEvent.setup();
    api.deleteAccount.mockResolvedValue(null);
    const { forget } = renderProfile();
    await user.click(screen.getByRole('button', { name: 'Delete my account…' }));

    await user.click(screen.getByRole('button', { name: 'Yes, delete my account' }));

    await waitFor(() => expect(forget).toHaveBeenCalled());
    expect(api.deleteAccount).toHaveBeenCalledTimes(1);
    expect(currentLocation()).toBe(ROUTES.home);
  });

  it('keeps the user signed in, and says why, when the server cannot delete the account', async () => {
    const user = userEvent.setup();
    api.deleteAccount.mockRejectedValue(apiError(500));
    const { forget } = renderProfile();
    await user.click(screen.getByRole('button', { name: 'Delete my account…' }));

    await user.click(screen.getByRole('button', { name: 'Yes, delete my account' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/server had a problem/i);
    expect(forget).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Yes, delete my account' }).disabled).toBe(false);
  });
});
