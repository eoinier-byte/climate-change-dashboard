import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { countyPath, ROUTES } from '../routes';
import { getFavourites, removeFavourite } from '../services/api';

// "My counties" on the account page (CCD-414): the counties saved with the star on the county page
// (CCD-413), each with a link and a Remove button.
export default function FavouriteCounties() {
  // null while loading, 'failed' when the list could not be loaded, otherwise the list
  const [counties, setCounties] = useState(null);
  const [message, setMessage] = useState('');
  const [busySlug, setBusySlug] = useState('');

  useEffect(() => {
    let ignore = false;
    getFavourites()
      .then((list) => {
        if (!ignore) setCounties(list);
      })
      .catch(() => {
        if (!ignore) setCounties('failed');
      });
    return () => {
      ignore = true;
    };
  }, []);

  const remove = async (county) => {
    setBusySlug(county.slug);
    setMessage('');
    try {
      await removeFavourite(county.slug);
      setCounties((list) => list.filter((item) => item.slug !== county.slug));
    } catch {
      setMessage(`We could not remove ${county.name}. Please try again.`);
    }
    setBusySlug('');
  };

  return (
    <section className="account-section" aria-labelledby="account-counties-title">
      <h2 id="account-counties-title">My counties</h2>

      {counties === null && <p>Loading your counties…</p>}
      {counties === 'failed' && <p role="alert">We could not load your counties. Please try again later.</p>}
      {message && <p role="alert">{message}</p>}

      {Array.isArray(counties) && counties.length === 0 && (
        <p>
          You have not saved any counties yet. Open a county page and choose "Save county", or{' '}
          <Link to={ROUTES.home}>pick one on the map</Link>.
        </p>
      )}

      {Array.isArray(counties) && counties.length > 0 && (
        <ul className="favourite-list">
          {counties.map((county) => (
            <li key={county.slug}>
              <Link to={countyPath(county.slug)}>{county.name}</Link>
              <button
                type="button"
                className="btn btn--secondary"
                disabled={busySlug === county.slug}
                aria-label={`Remove ${county.name}`}
                onClick={() => remove(county)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
