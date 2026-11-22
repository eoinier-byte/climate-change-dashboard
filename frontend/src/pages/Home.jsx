import { Link } from 'react-router-dom';
import CompareSection from '../components/CompareSection';
import CountySearch from '../components/CountySearch';
import HomeMaps from '../components/HomeMaps';
import { COUNTIES } from '../data/counties';
import { countyPath } from '../routes';
import '../styles/home.css';

// Home page. The maps (CCD-379) are drawn inside #map-root, with their scenario and period controls (CCD-383).
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

      <section id="map-root" className="map-area" aria-label="Maps of the 26 counties">
        <HomeMaps />
      </section>

      <section id="compare" className="compare-page home-compare" aria-labelledby="home-compare-title">
        <h2 id="home-compare-title">Compare</h2>
        <p className="compare-page__intro">
          See how the climate is projected to change under two emissions scenarios, or compare two counties
          under the same scenario, and how big the difference between them is.
        </p>
        <CompareSection prefix="cmp_" />
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
