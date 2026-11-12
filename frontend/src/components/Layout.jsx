import { Outlet } from 'react-router-dom';
import NavBar from '../../../../Downloads/ccd-135/frontend/src/components/NavBar.jsx';

// The frame around every page: navigation bar, then the page itself.
export default function Layout() {
  return (
    <div className="app">
      <NavBar />
      <Outlet />
    </div>
  );
}
