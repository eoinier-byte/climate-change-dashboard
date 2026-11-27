import { useEffect, useState } from 'react';
import { AuthContext } from '../auth/AuthContext';
import { getProfile, loginUser, logoutUser, registerUser } from '../services/api';

// Keeps "who is signed in" for the whole site (CCD-326). It wraps <App /> in main.jsx.
//
// On start it asks the server (GET /auth/profile/me/). The browser sends the session cookie, so a visitor who
// signed in earlier is still signed in after a refresh. Nothing is kept in localStorage or sessionStorage.
// Any failure counts as "signed out", so the public pages always work, even when the account part is down.
//
// What it gives to pages:
//   signIn({ login, password })  signs in, then loads the profile. Rejects with the ApiError (see formErrors.js).
//   register(details)            creates the account. The server signs the browser in, but the state changes only
//                                when the page calls refresh(), so the page can show its own message first.
//   refresh()                    loads the profile again
//   signOut()                    signs out. A 403 means the session had already ended, which is the same result.
export default function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    getProfile({ signal: controller.signal })
      .then((user) => setState({ user, status: 'signedIn' }))
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setState({ user: null, status: 'signedOut' });
      });
    return () => controller.abort();
  }, []);

  const refresh = async () => {
    const user = await getProfile();
    setState({ user, status: 'signedIn' });
    return user;
  };

  const signIn = async (credentials) => {
    await loginUser(credentials);
    return refresh();
  };

  const register = (details) => registerUser(details);

  const signOut = async () => {
    try {
      await logoutUser();
    } catch (error) {
      if (error?.status !== 403) throw error;
    }
    setState({ user: null, status: 'signedOut' });
  };

  return <AuthContext.Provider value={{ ...state, signIn, register, refresh, signOut }}>{children}</AuthContext.Provider>;
}
