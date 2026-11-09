import { Link, Route, Routes } from 'react-router-dom';
import { ROUTES } from './routes';
import Home from './pages/Home';
import CountyDashboard from './pages/CountyDashboard';
import Compare from './pages/Compare';
import SeaLevel from './pages/SeaLevel';
import About from './pages/About';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <>
      {/* Temporary links so every page can be reached; CCD-135 replaces this with the real navigation bar. */}
      <nav>
        <Link to={ROUTES.home}>Map</Link> | <Link to={ROUTES.compare}>Compare</Link> |{' '}
        <Link to={ROUTES.seaLevel}>Flooding</Link> | <Link to={ROUTES.about}>About</Link> |{' '}
        <Link to={ROUTES.login}>Login</Link>
      </nav>
      <Routes>
        <Route path={ROUTES.home} element={<Home />} />
        <Route path={ROUTES.county} element={<CountyDashboard />} />
        <Route path={ROUTES.compare} element={<Compare />} />
        <Route path={ROUTES.seaLevel} element={<SeaLevel />} />
        <Route path={ROUTES.about} element={<About />} />
        <Route path={ROUTES.login} element={<Login />} />
        <Route path={ROUTES.register} element={<Register />} />
        <Route path={ROUTES.profile} element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
