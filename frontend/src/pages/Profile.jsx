import { Navigate, useLocation } from 'react-router-dom';
import Loading from '../components/Loading';
import ProfileDelete from '../components/ProfileDelete';
import ProfileDetails from '../components/ProfileDetails';
import ProfileEmail from '../components/ProfileEmail';
import ProfilePassword from '../components/ProfilePassword';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../routes';
import '../styles/auth.css';

// The account page (CCD-327, CCD-432, CCD-433, CCD-448): details and photo, email, password, delete account.
// Only for a signed-in user; anyone else is sent to the login page, which brings them back here after logging in. After a change, refresh() loads the
// profile again, so the page always shows what the server has.
export default function Profile() {
  const { user, status, refresh } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <main><Loading message="Loading your account…" /></main>;
  if (status !== 'signedIn' || !user) return <Navigate to={ROUTES.login} replace state={{ from: location }} />;

  return (
    <main className="account-page">
      <div>
        <h1>Account</h1>
        <p className="auth-muted">
          Signed in as <strong>{user.username}</strong>
        </p>
      </div>
      <ProfileDetails user={user} onSaved={refresh} />
      <ProfileEmail user={user} onSaved={refresh} />
      <ProfilePassword />
      <ProfileDelete />
    </main>
  );
}
