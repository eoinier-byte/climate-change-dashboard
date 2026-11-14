// Shared test helper (CCD-417): draws a component inside a pretend router,
// so components that use links, useParams, useNavigate or useLocation work in tests.
// Only for tests: the app itself never imports this file.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

// An invisible-to-users line that shows the current address, e.g. "/county/kerry?rcp=85",
// so a test can check that clicking something really changed the page
function CurrentLocation() {
  const location = useLocation();
  return <p data-testid="current-location">{location.pathname + location.search}</p>;
}

// Draws "ui" as if the browser were open at "url".
//   url  - the address to start at, e.g. '/county/cork?rcp=85' (default '/')
//   path - optional route pattern, e.g. ROUTES.county ('/county/:slug').
//          Give it when the component reads values from the URL with useParams.
// Returns the same things as Testing Library's render().
//
// Examples:
//   renderWithRouter(<ShareLink />, { url: '/county/cork?rcp=85' });
//   renderWithRouter(<CountyDashboard />, { url: '/county/cork', path: ROUTES.county });
export function renderWithRouter(ui, { url = '/', path } = {}) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      {path ? (
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      ) : (
        ui
      )}
      <CurrentLocation />
    </MemoryRouter>,
  );
}

// The address the pretend browser is at now, e.g. "/county/kerry?rcp=85"
export function currentLocation() {
  return screen.getByTestId('current-location').textContent;
}