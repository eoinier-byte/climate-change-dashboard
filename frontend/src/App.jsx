import { Route, Routes } from 'react-router-dom';
import { ROUTES } from './routes';
import Layout from './components/Layout';
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
    <Routes>
      <Route element={<Layout />}>
        <Route path={ROUTES.home} element={<Home />} />
        <Route path={ROUTES.county} element={<CountyDashboard />} />
        <Route path={ROUTES.compare} element={<Compare />} />
        <Route path={ROUTES.seaLevel} element={<SeaLevel />} />
        <Route path={ROUTES.about} element={<About />} />
        <Route path={ROUTES.login} element={<Login />} />
        <Route path={ROUTES.register} element={<Register />} />
        <Route path={ROUTES.profile} element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
