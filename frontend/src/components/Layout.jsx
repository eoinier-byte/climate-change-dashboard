import { Outlet } from 'react-router-dom';
import Footer from './Footer';
import NavBar from './NavBar';

// The frame around every page: navigation bar, the page itself, then the footer.
export default function Layout() {
  return (
    <div className="app">
      <NavBar />
      <Outlet />
      <Footer />
    </div>
  );
}
