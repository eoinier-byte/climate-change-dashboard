import { Link } from 'react-router-dom';
import CountySearch from '../components/CountySearch';
import MapExplorer from '../components/MapExplorer';
import { COUNTIES } from '../data/counties';
import { countyPath } from '../routes';
import '../styles/home.css';

// Home page shell. The map (CCD-379) is drawn inside #map-root, with its scenario and period controls (CCD-383).
export default function Home() {
  return (
    <main className="home">
      <section className="hero" aria-labelledby="home-title">
        <h1 id="home-title">Explore Ireland&apos;s climate projections</h1>
        <p className="hero__intro">
          See how temperature, rainfall and flooding could change in each of Ireland&apos;s 26
          counties. These are projections from simplified climate models, not forecasts.
        </p>
        <CountySearch />
      </section>

      <section className="map-area" aria-labelledby="map-title">
        <h2 id="map-title">Map of the 26 counties</h2>
        <div id="map-root" className="map-area__canvas" role="region" aria-label="County map">
          <MapExplorer />
        </div>
      </section>

      <section aria-labelledby="list-title">
        <h2 id="list-title">Or choose a county</h2>
        <ul className="county-grid">
          {COUNTIES.map((county) => (
            <li key={county.slug}>
              <Link to={countyPath(county.slug)}>{county.name}</Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
