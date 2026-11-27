import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Loading from '../components/Loading';
import { useAuth } from '../hooks/useAuth';
import { verifyEmailLink } from '../services/api';
import { ROUTES } from '../routes';
import '../styles/auth.css';

// The pages the other two emails link to (CCD-436). Both call POST /auth/verify/{user_id}/{code}/:
//   kind="register"  /verify-email/{user_id}/{code}   "confirm your email" after registering
//   kind="change"    /email-updated/{user_id}/{code}  sent to the new address after "change email"
// A link works once. React runs effects twice in development (StrictMode), which would spend the link on the
// first call and show "expired" on the second, so both calls share one request per link.
const requests = new Map();
function verifyOnce(userId, code) {
  const key = `${userId}/${code}`;
  if (!requests.has(key)) {
    const request = verifyEmailLink(userId, code);
    requests.set(key, request);
    // After a failure the same link may be tried again (for example the connection dropped)
    request.catch(() => requests.delete(key));
  }
  return requests.get(key);
}

const TEXT = {
  register: {
    title: 'Email confirmed',
    body: 'Thank you. Your email address is confirmed and your account is ready to use.',
  },
  change: {
    title: 'Email updated',
    body: 'Your new email address is confirmed and saved. You can use it to log in.',
  },
};

export default function EmailLink({ kind = 'register' }) {
  const { userId, code } = useParams();
  const { status: authStatus, refresh } = useAuth();
  const [result, setResult] = useState('checking'); // checking | ok | expired | taken | unknown | error

  useEffect(() => {
    let cancelled = false;
    verifyOnce(userId, code)
      .then(() => {
        if (cancelled) return;
        setResult('ok');
        // A signed-in visitor's account page should show the confirmed address
        refresh().catch(() => {});
      })
      .catch((error) => {
        if (cancelled) return;
        if (error?.status === 410) setResult('expired');
        else if (error?.status === 409) setResult('taken');
        else if (error?.status === 404) setResult('unknown');
        else setResult('error');
      });
    return () => {
      cancelled = true;
    };
    // refresh is a new function on every render; the link is only used once, for these two values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, code]);

  const text = TEXT[kind] ?? TEXT.register;
  const signedIn = authStatus === 'signedIn';

  if (result === 'checking') return <main className="auth-page"><Loading message="Checking your link…" /></main>;

  if (result === 'ok') {
    return (
      <main className="auth-page auth-result">
        <div role="status">
          <span className="auth-result__icon" aria-hidden="true">✓</span>
          <h1>{text.title}</h1>
          <p>{text.body}</p>
        </div>
        <p>
          <Link to={signedIn ? ROUTES.profile : ROUTES.login} className="btn">
            {signedIn ? 'Go to your account' : 'Log in'}
          </Link>
        </p>
      </main>
    );
  }

  if (result === 'taken') {
    return (
      <main className="auth-page auth-result">
        <h1>That email is already in use</h1>
        <p>Another account confirmed this address first, so we could not save it. Choose a different email on your account page.</p>
        <p>
          <Link to={ROUTES.profile} className="btn btn--secondary">
            Go to your account
          </Link>
        </p>
      </main>
    );
  }

  if (result === 'expired') {
    return (
      <main className="auth-page auth-result">
        <h1>This link has expired</h1>
        <p>Links work once and last 1 hour. Log in and ask for a new one from your account page.</p>
        <p>
          <Link to={ROUTES.login} className="btn">
            Log in
          </Link>
        </p>
      </main>
    );
  }

  if (result === 'unknown') {
    return (
      <main className="auth-page auth-result">
        <h1>We do not recognise this link</h1>
        <p>Check that you opened the whole link from the email. You can also log in and ask for a new one from your account page.</p>
        <p>
          <Link to={ROUTES.login} className="btn">
            Log in
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="auth-page auth-result">
      <h1>We could not check your link</h1>
      <p>Check your internet connection and reload the page to try again.</p>
    </main>
  );
}
