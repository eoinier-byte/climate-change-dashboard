import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ROUTES } from '../routes';
import '../styles/nav.css';

// Paths come from routes.js. When accounts exist (CCD-299), show "Account" (ROUTES.profile)
// instead of "Login" for a signed-in user.
const NAV_ITEMS = [
  { label: 'Map', to: ROUTES.home, end: true },
  { label: 'Compare', to: ROUTES.compare },
  { label: 'Flooding', to: ROUTES.seaLevel },
  { label: 'About', to: ROUTES.about },
  { label: 'Login', to: ROUTES.login },
];

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

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
          {NAV_ITEMS.map(({ label, to, end }) => (
            <li key={to}>
              <NavLink to={to} end={end} onClick={close}>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
