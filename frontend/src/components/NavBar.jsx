import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../routes';
import '../styles/nav.css';

// Paths come from routes.js. A signed-in user sees "Account" (ROUTES.profile) and a Log out button
// instead of "Login" (CCD-326).
const NAV_ITEMS = [
  { label: 'Map', to: ROUTES.home, end: true },
  { label: 'Flooding', to: ROUTES.seaLevel },
  { label: 'About', to: ROUTES.about },
];

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const items = [...NAV_ITEMS, user ? { label: 'Account', to: ROUTES.profile } : { label: 'Login', to: ROUTES.login }];

  // If signing out fails (for example the connection dropped), the user stays signed in and nothing changes
  const logOut = async () => {
    close();
    try {
      await signOut();
      navigate(ROUTES.home);
    } catch {
      // still signed in
    }
  };

  // Escape closes the phone menu
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <header className="site-nav">
      <nav className="site-nav__inner" aria-label="Main">
        <Link to={ROUTES.home} className="site-nav__brand" onClick={close}>
          Ireland Climate Futures
        </Link>
        <button
          type="button"
          className="btn site-nav__toggle"
          aria-expanded={open}
          aria-controls="site-nav-links"
          onClick={() => setOpen((isOpen) => !isOpen)}
        >
          Menu
        </button>
        <ul id="site-nav-links" className="site-nav__links" data-open={open}>
          {items.map(({ label, to, end }) => (
            <li key={to}>
              <NavLink to={to} end={end} onClick={close}>
                {label}
              </NavLink>
            </li>
          ))}
          {user && (
            <li>
              <button type="button" className="site-nav__logout" onClick={logOut}>
                Log out
              </button>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}
