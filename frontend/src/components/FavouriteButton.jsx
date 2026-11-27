import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { addFavourite, getFavourites, removeFavourite } from '../services/api';
import { ROUTES } from '../routes';

// "Save county" star on the county page (CCD-413). A signed-in visitor saves the county to their list
// (shown on the account page, CCD-414) or removes it again. Anyone else gets a link to the login page,
// which brings them back to this county afterwards (CCD-325).
// The server has no "is this a favourite?" question, so the whole list is loaded and searched for the slug.
export default function FavouriteButton({ slug }) {
  const { status } = useAuth();
  const location = useLocation();
  const signedIn = status === 'signedIn';

  // What the server said about this county: { slug, saved } or { slug, failed } (null until it answers)
  const [known, setKnown] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!signedIn) return undefined;
    // "ignore" stops an old answer from landing after the visitor moved to another county
    let ignore = false;
    getFavourites()
      .then((list) => {
        if (!ignore) setKnown({ slug, saved: list.some((county) => county.slug === slug) });
      })
      .catch(() => {
        if (!ignore) setKnown({ slug, failed: true });
      });
    return () => {
      ignore = true;
    };
  }, [signedIn, slug]);

  if (status === 'loading') return null;

  if (!signedIn) {
    return (
      <p className="favourite">
        <Link to={ROUTES.login} state={{ from: location }}>
          Log in to save this county
        </Link>
      </p>
    );
  }

  const current = known?.slug === slug ? known : null;
  const saved = Boolean(current?.saved);

  const toggle = async () => {
    setBusy(true);
    setMessage('');
    try {
      if (saved) await removeFavourite(slug);
      else await addFavourite(slug);
      setKnown({ slug, saved: !saved });
    } catch {
      setMessage(saved ? 'We could not remove this county. Please try again.' : 'We could not save this county. Please try again.');
    }
    setBusy(false);
  };

  return (
    <div className="favourite">
      <button
        type="button"
        className="btn btn--secondary"
        aria-pressed={saved}
        disabled={busy || !current || current.failed}
        onClick={toggle}
      >
        <span aria-hidden="true">{saved ? '★' : '☆'}</span> {saved ? 'Saved' : 'Save county'}
      </button>
      {current?.failed && <p role="alert">We could not check your saved counties.</p>}
      {message && <p role="alert">{message}</p>}
    </div>
  );
}
