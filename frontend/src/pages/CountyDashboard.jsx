// County dashboard page, e.g. /county/cork (CCD-148, CCD-149).
// Loads the county (CCD-142) and its projection rows (CCD-143) from the API,
// then shows today's climate and the temperature and rainfall charts,
// each with an annual line chart and a seasonal bar chart (CCD-157).
// The "Choose a county" dropdown switches every chart to another county (CCD-159, CCD-166).
// The "Show scenarios" tick boxes show or hide scenarios on every chart (CCD-158, CCD-165),
// and the period choice sets which period the seasonal charts show. Both are kept in the URL
// (e.g. /county/cork?rcp=26,85&period=2021-2050) so a shared link opens the same view (CCD-406).
//
// Page layout, top to bottom (CCD-180). Blocks still to be built have a reserved CountySlot,
// so they can be added without moving anything else:
//   1. Headline numbers  - county name, today's climate
//   2. Charts            - scenario/period controls, temperature, rainfall, sea level
//   3. "What this means for you" - slot for CCD-375 (impacts block)
//   4. Warming stripes   - slot for CCD-374
//   5. Climate analogue  - slot for CCD-373
//   6. Actions           - copy link (share); Download PDF goes here (CCD-408)
// Coastal counties also get a sea-level rise chart (CCD-407).
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import '../styles/county.css';
import CountySelect from '../components/CountySelect';
import CountySlot from '../components/CountySlot';
import ProjectionChart from '../components/ProjectionChart';
import PeriodFilter from '../components/PeriodFilter';
import ScenarioFilter from '../components/ScenarioFilter';
import SeaLevelChart from '../components/SeaLevelChart';
import SeasonalChart from '../components/SeasonalChart';
import ShareLink from '../components/ShareLink';
import { buildSeries, filterScenarios, seasonalRows } from '../components/countyChartData';
import useCountyView, { PERIODS } from '../hooks/useCountyView';
import { getCounty, getProjections, getSeaLevel } from '../services/api';
import { ROUTES } from '../routes';

// Formats a number string from the API for people to read,
// e.g. "1368.817" with 0 decimals -> "1,369"
function formatNumber(value, decimals) {
  return Number(value).toLocaleString('en-IE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function CountyDashboard() {
  // The county slug from the URL, e.g. "cork" from /county/cork
  const { slug } = useParams();

  // What the API sent back, saved together with the slug it was for.
  // { slug, county, rows, seaLevel } when it worked, or { slug, error } when it failed.
  const [result, setResult] = useState(null);

  // The scenarios and period chosen, read from the URL (?rcp=...&period=...).
  // Defaults when the URL has none: all three scenarios, 2071-2100. See hooks/useCountyView.js
  const { scenarios: selectedScenarios, period, setScenarios, setPeriod } = useCountyView();

  useEffect(() => {
    // If the user moves to another county before this one has loaded,
    // "ignore" stops the old answer from overwriting the new page.
    let ignore = false;

    // Ask for the county, its projections and its sea level at the same time.
    // If only the sea level fails, ".catch(() => null)" turns it into null,
    // so the rest of the page still shows and the sea-level chart shows a message.
    Promise.all([getCounty(slug), getProjections({ county: slug }), getSeaLevel(slug).catch(() => null)])
      .then(([county, rows, seaLevel]) => {
        if (!ignore) setResult({ slug, county, rows, seaLevel });
      })
      .catch((error) => {
        if (!ignore) setResult({ slug, error });
      });

    // React runs this "clean up" function when the slug changes or the page closes
    return () => {
      ignore = true;
    };
  }, [slug]);

  // Still loading: nothing back yet, or the answer is for a different county
  if (!result || result.slug !== slug) {
    return (
      <main>
        <h1>County dashboard</h1>
        <p role="status">Loading county data…</p>
      </main>
    );
  }

  // Something went wrong: a 404 means the county does not exist
  if (result.error) {
    const notFound = result.error.message.includes('404');
    return (
      <main className="county-page">
        <h1>{notFound ? 'County not found' : 'Something went wrong'}</h1>
        <p role="alert">
          {notFound
            ? `We don't have a county called "${slug}".`
            : 'We could not load the data for this county. Please try again later.'}
        </p>
        {/* Let people pick a real county straight away */}
        <CountySelect currentSlug={slug} />
        <Link to={ROUTES.home}>Back to the map</Link>
      </main>
    );
  }

  const { county, rows, seaLevel } = result;
  const summary = county.summary;

  // Only the rows for the ticked scenarios (the baseline row is always kept,
  // because the line charts start from it)
  const shownRows = rows.filter((row) => row.scenario === 'baseline' || selectedScenarios.includes(row.scenario));

  // Turn the API rows into what each chart needs
  const temperature = filterScenarios(buildSeries(rows, county.name, 'temperature'), selectedScenarios);
  const precipitation = filterScenarios(buildSeries(rows, county.name, 'precipitation'), selectedScenarios);
  const seasonalTemperature = seasonalRows(shownRows, 'temperature', period);
  const seasonalPrecipitation = seasonalRows(shownRows, 'precipitation', period);

  return (
    <main className="county-page">
      <CountySelect currentSlug={slug} />
      <h1>{county.name}</h1>
      <p className="county-page__intro">
        How the climate in County {county.name} is projected to change under three emissions scenarios, compared
        with the {summary.period} average.
      </p>

      {/* 1. Headline numbers: today's climate, the baseline (1976-2005) annual values */}
      <section aria-labelledby="today-heading">
        <h2 id="today-heading">Today's climate ({summary.period} average)</h2>
        <div className="county-page__stats">
          {summary.temperature && (
            <div className="stat-card">
              <p className="stat-card__label">Average temperature</p>
              <p className="stat-card__value">
                {formatNumber(summary.temperature.value, 1)} {summary.temperature.unit}
              </p>
            </div>
          )}
          {summary.precipitation && (
            <div className="stat-card">
              <p className="stat-card__label">Rainfall per year</p>
              <p className="stat-card__value">
                {formatNumber(summary.precipitation.value, 0)} {summary.precipitation.unit}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 2. Charts. One set of controls for every chart below. Changing them updates the URL. */}
      <div className="county-page__controls">
        <ScenarioFilter selected={selectedScenarios} onChange={setScenarios} />
        <PeriodFilter periods={PERIODS} selected={period} onChange={setPeriod} />
      </div>

      <section aria-labelledby="temperature-heading">
        <h2 id="temperature-heading">Temperature</h2>
        <ProjectionChart data={temperature} />
        <SeasonalChart rows={seasonalTemperature} countyName={county.name} />
      </section>

      <section aria-labelledby="rainfall-heading">
        <h2 id="rainfall-heading">Rainfall</h2>
        <ProjectionChart data={precipitation} />
        <SeasonalChart rows={seasonalPrecipitation} countyName={county.name} />
      </section>

      <section aria-labelledby="sea-level-heading">
        <h2 id="sea-level-heading">Sea level</h2>
        <SeaLevelChart data={seaLevel} selected={selectedScenarios} />
      </section>

      {/* 3-5. Reserved slots: put the finished block inside, e.g. <CountySlot ...><ImpactsBlock /></CountySlot> */}
      <CountySlot name="impacts" title="What this means for you" story="CCD-375" />
      <CountySlot name="stripes" title="Warming stripes" story="CCD-374" />
      <CountySlot name="analogue" title="Climate analogue" story="CCD-373" />

      {/* 6. Actions */}
      <section className="county-page__actions" aria-labelledby="actions-heading">
        <h2 id="actions-heading">Share this view</h2>
        <div className="county-page__action-buttons">
          <ShareLink />
          {/* The Download PDF button (CCD-408) goes here, next to the share button */}
        </div>
      </section>
    </main>
  );
}