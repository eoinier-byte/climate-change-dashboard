import { Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from './routes';
import Layout from './components/Layout';
import Home from './pages/Home';
import CountyDashboard from './pages/CountyDashboard';
import SeaLevel from './pages/SeaLevel';
import About from './pages/About';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import EmailLink from './pages/EmailLink';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path={ROUTES.home} element={<Home />} />
        <Route path={ROUTES.county} element={<CountyDashboard />} />
        {/* The Compare page moved into the home page. Old links to /compare go to the home page. */}
        <Route path="/compare" element={<Navigate to={ROUTES.home} replace />} />
        <Route path={ROUTES.seaLevel} element={<SeaLevel />} />
        <Route path={ROUTES.about} element={<About />} />
        <Route path={ROUTES.login} element={<Login />} />
        <Route path={ROUTES.register} element={<Register />} />
        <Route path={ROUTES.profile} element={<Profile />} />
        <Route path={ROUTES.forgotPassword} element={<ForgotPassword />} />
        <Route path={ROUTES.recovery} element={<ResetPassword />} />
        <Route path={ROUTES.verifyEmail} element={<EmailLink kind="register" />} />
        <Route path={ROUTES.emailUpdated} element={<EmailLink kind="change" />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
