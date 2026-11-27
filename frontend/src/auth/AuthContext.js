import { createContext } from 'react';

// Who is signed in (CCD-326). AuthProvider (components/AuthProvider.jsx) fills this in; pages read it
// with useAuth() (hooks/useAuth.js).
//
//   status  'loading'    the server has not said yet
//           'signedIn'   user is the profile from GET /auth/profile/me/
//           'signedOut'  nobody is signed in (user is null)
//
// Without an AuthProvider around it, a component sees "nobody is signed in", so the navigation bar and
// the pages still draw (and their tests need no provider unless they are about signing in).
const missingProvider = () => Promise.reject(new Error('Sign-in is not available: AuthProvider is missing.'));

export const AuthContext = createContext({
  user: null,
  status: 'signedOut',
  signIn: missingProvider,
  register: missingProvider,
  refresh: missingProvider,
  signOut: missingProvider,
});
