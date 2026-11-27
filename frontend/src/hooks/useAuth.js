import { useContext } from 'react';
import { AuthContext } from '../auth/AuthContext';

// { user, status, signIn, register, refresh, signOut }: see auth/AuthContext.js
export function useAuth() {
  return useContext(AuthContext);
}
