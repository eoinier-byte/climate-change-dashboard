import { Link, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Counties from './pages/Counties';
import CountyDashboard from './pages/CountyDashboard';
import Compare from './pages/Compare';
import SeaLevel from './pages/SeaLevel';
import Analogue from './pages/Analogue';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <>
      <nav>
        <Link to="/">Home</Link> | <Link to="/counties">Counties</Link> |{' '}
        <Link to="/compare">Compare</Link> | <Link to="/sea-level">Sea level</Link> |{' '}
        <Link to="/analogue">Analogue</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/counties" element={<Counties />} /><Route path="/county/:slug" element={<CountyDashboard />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/sea-level" element={<SeaLevel />} />
        <Route path="/analogue" element={<Analogue />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
