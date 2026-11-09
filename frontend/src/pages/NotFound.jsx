import { Link } from 'react-router-dom';
import { ROUTES } from '../routes';

export default function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>We could not find that page.</p>
      <Link to={ROUTES.home}>Back to the map</Link>
    </main>
  );
}
