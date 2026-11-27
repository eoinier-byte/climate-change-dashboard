// The flood page at /sea-level (CCD-169, CCD-152): sea-level rise and flooding for one coastal county.
//
// The choices live in the URL, so a link opens the same view:
//   county  which coastal county, as its slug, e.g. ?county=cork.  Default: the first coastal county
//   rcp     which scenarios are ticked, as on the county page, e.g. ?rcp=26,85.  Default: all three
// e.g. /sea-level?county=cork&rcp=85 shows Cork under the high-emissions scenario only.
//
// Sections:
//   1. Controls      - the coastal county dropdown and the "Show scenarios" tick boxes (CCD-174)
//   2. Numbers       - the 2050 and 2100 cards (CCD-171, CCD-172)
//   3. Chart         - the sea-level rise chart from 2020 to 2100 (SeaLevelChart, CCD-407)
//   4. Flood map     - the flood layer with a sea-level slider and km² counter (FloodMap, CCD-377)
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ErrorMessage from '../components/ErrorMessage';
import FloodMap from '../components/FloodMap';
import Loading from '../components/Loading';
import ScenarioFilter from '../components/ScenarioFilter';
import SeaLevelCard from '../components/SeaLevelCard';
import SeaLevelChart from '../components/SeaLevelChart';
import { COASTAL_COUNTIES, DEFAULT_COASTAL, isCoastal } from '../data/coastalCounties';
import { parseScenarios, scenariosToText } from '../hooks/useCountyView';
import { getSeaLevel } from '../services/api';
import { ALL_SCENARIOS } from '../styles/scenarioColors';
import { countyPath } from '../routes';
// county.css has the "Show scenarios" tick box styles, shared with the county page
import '../styles/county.css';
import '../styles/sea-level.css';

// The two years with their own card
const CARD_YEARS = [2050, 2100];

export default function SeaLevel() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Which county: the one in the URL if it is coastal, otherwise the default
  const asked = searchParams.get('county')?.trim().toLowerCase();
  const slug = isCoastal(asked) ? asked : DEFAULT_COASTAL;
  const countyName = COASTAL_COUNTIES.find((county) => county.slug === slug).name;

  // Which scenarios are ticked (all three if the URL says nothing)
  const selected = parseScenarios(searchParams.get('rcp'));

  // The answer from the API: { slug, data } when it worked, or { slug, error } when it failed.
  // It keeps the slug, so we know if it belongs to the county shown now.
  const [result, setResult] = useState(null);
  // Goes up by one each time Retry is pressed, which makes the effect below run again
  const [attempt, setAttempt] = useState(0);

  // Load the county's sea-level projections whenever the county changes (or Retry is pressed)
  useEffect(() => {
    let ignore = false; // stops a late answer for an old county replacing the new one

    getSeaLevel(slug)
      .then((data) => {
        if (!ignore) setResult({ slug, data });
      })
      .catch((error) => {
        if (!ignore) setResult({ slug, error });
      });

    return () => {
      ignore = true;
    };
  }, [slug, attempt]);

  // Writes one setting into the URL, or removes it when it is empty.
  // replace: true changes the current history entry, so Back leaves the page.
  function updateParam(name, value) {
    const next = new URLSearchParams(searchParams); // copy, so other settings are kept
    if (value) next.set(name, value);
    else next.delete(name);
    setSearchParams(next, { replace: true });
  }

  // A county was picked in the dropdown
  function handleCountyChange(event) {
    updateParam('county', event.target.value);
  }

  // A scenario was ticked or unticked. All three ticked is the default, so it is left out of the URL.
  function handleScenariosChange(list) {
    updateParam('rcp', list.length === ALL_SCENARIOS.length ? '' : scenariosToText(list));
  }

  // Retry after an error: clear the old answer (so Loading shows) and ask again
  function handleRetry() {
    setResult(null);
    setAttempt((count) => count + 1);
  }

  // Still waiting if there is no answer yet, or the answer is for a different county
  const loading = !result || result.slug !== slug;

  return (
    <main className="sea-level-page">
      <h1>Flooding</h1>
      <p className="sea-level-page__intro">
        How much the sea around County {countyName} is projected to rise this century, under three emissions
        scenarios. These are projections from climate models, not forecasts.
      </p>

      {/* 1. Controls */}
      <div className="sea-level-page__controls">
        <div className="sea-level-page__county">
          {/* htmlFor links the label to the dropdown, for screen readers and clicking */}
          <label htmlFor="coastal-county">Coastal county</label>
          <select id="coastal-county" value={slug} onChange={handleCountyChange}>
            {COASTAL_COUNTIES.map((county) => (
              <option key={county.slug} value={county.slug}>
                {county.name}
              </option>
            ))}
          </select>
        </div>
        <ScenarioFilter selected={selected} onChange={handleScenariosChange} />
      </div>

      {loading && <Loading message="Loading sea-level data…" />}

      {!loading && result.error && <ErrorMessage error={result.error} onRetry={handleRetry} />}

      {!loading && result.data && (
        <>
          {/* 2. Numbers: 2050 and 2100 side by side */}
          <section className="sea-level-page__section" aria-labelledby="sea-level-numbers-heading">
            <h2 id="sea-level-numbers-heading">Projected rise around County {countyName}</h2>
            <div className="sea-level-page__cards">
              {CARD_YEARS.map((year) => (
                <SeaLevelCard key={year} data={result.data} year={year} selected={selected} />
              ))}
            </div>
          </section>

          {/* 3. Chart: every decade from 2020 to 2100 */}
          <section className="sea-level-page__section" aria-labelledby="sea-level-chart-heading">
            <h2 id="sea-level-chart-heading">Rise from 2020 to 2100</h2>
            <SeaLevelChart data={result.data} selected={selected} />
          </section>
        </>
      )}

      {/* 4. Flood map: which land could flood at each sea level, 0 to 2 m.
          It loads its own data, so it shows even if the sea-level numbers above fail. */}
      <section className="sea-level-page__section" aria-labelledby="flood-map-heading">
        <h2 id="flood-map-heading">Flood map</h2>
        <p className="sea-level-page__intro">
          Move the slider to see which land in County {countyName} could be under water if the sea rose by that
          much.
        </p>
                {/* The projections let the map turn "RCP4.5 in 2100" into a flood level (null until they load) */}
        <FloodMap slug={slug} countyName={countyName} seaLevel={!loading && result.data ? result.data : null} />
      </section>

      <p className="sea-level-page__back">
        <Link to={countyPath(slug)}>See all climate projections for County {countyName}</Link>
      </p>
    </main>
  );
}