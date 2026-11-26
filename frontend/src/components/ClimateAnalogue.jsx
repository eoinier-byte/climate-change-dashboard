// The climate analogue block on the county page (CCD-151, CCD-373): which European city's climate
// today is closest to the county's projected future climate (wireframes 07 and 08).
//
// It follows the page's controls:
//   - scenario: the highest-emissions ticked scenario (the endpoint takes one scenario at a time)
//   - period:   the period chosen on the page, e.g. 2071-2100
// It shows the best match with a similarity word and bar (never a bare percentage), a summer /
// winter / rainfall comparison, and the next two cities. If the API returns no cities, it shows
// the "No close analogue available" state instead of forcing a match.
//
// Props:
//   slug       - the county's slug, e.g. "cork"
//   countyName - e.g. "Cork"
//   selected   - the ticked scenarios, e.g. ['rcp26', 'rcp85']
//   period     - the chosen period, e.g. "2071-2100"
import { Link } from 'react-router-dom';
import useAnalogues from '../hooks/useAnalogues';
import ErrorMessage from './ErrorMessage';
import Loading from './Loading';
import { SCENARIO_LABELS } from '../styles/scenarioColors';
import { ROUTES } from '../routes';
import { comparisonRows, pickScenario, similarityPercent, similarityWord } from './analogueData';
import '../styles/analogue.css';

// The short explanation under the block, in both the match and no-match states
function HowItWorks() {
  return (
    <p className="analogue__how">
      <strong>How matching works:</strong> we compare the county&apos;s projected summer and winter temperature and
      yearly rainfall with today&apos;s values in European cities, and pick the closest. It&apos;s a rough guide, not a
      forecast: sunshine, wind and extreme weather are not compared. Sources: Met &Eacute;ireann TRANSLATE,
      WorldClim 2.1. <Link to={ROUTES.about}>Read the method</Link>
    </p>
  );
}

export default function ClimateAnalogue({ slug, countyName, selected, period }) {
  const scenario = pickScenario(selected);
  const scenarioLabel = SCENARIO_LABELS[scenario];
  const { data, loading, error, retry } = useAnalogues(slug, scenario, period);

  if (loading) return <Loading message="Finding a match…" />;
  if (error) return <ErrorMessage error={error} onRetry={retry} />;

  // No city came back: say so honestly instead of forcing a match (wireframe 08)
  if (data.length === 0) {
    return (
      <div className="analogue analogue--none">
        <h3>No close analogue available</h3>
        <p>
          Under {scenarioLabel}, County {countyName}&apos;s projected climate for {period} is not close to any city in
          our comparison set today, so we can&apos;t offer an honest match.
        </p>
        <HowItWorks />
      </div>
    );
  }

  // Closest first (the API already sorts by rank; sorting again keeps us safe)
  const [best, ...others] = [...data].sort((a, b) => a.rank - b.rank);
  const word = similarityWord(best.similarity);

  return (
    <div className="analogue">
      <p className="analogue__headline">
        Under {scenarioLabel}, by {period} County {countyName}&apos;s climate is projected to be most like{' '}
        <strong>
          {best.city}, {best.country}
        </strong>{' '}
        today.
      </p>

      {/* Similarity as a word plus a bar. The bar is drawn with CSS; the word is what screen readers hear. */}
      <div className="analogue__similarity">
        <p>
          Similarity: <strong>{word}</strong> match
        </p>
        <div className="analogue__bar" role="img" aria-label={`Similarity: ${word}`}>
          <span className="analogue__bar-fill" style={{ width: `${similarityPercent(best.similarity)}%` }} />
        </div>
        <div className="analogue__bar-labels" aria-hidden="true">
          <span>Low</span>
          <span>Moderate</span>
          <span>High</span>
        </div>
      </div>

      {/* The real numbers side by side, so people can judge the match themselves */}
      <table className="analogue__table">
        <caption>
          County {countyName} in {period} ({scenarioLabel}) compared with {best.city} today (
          {best.city_baseline_period} average)
        </caption>
        <thead>
          <tr>
            <th scope="col">Measure</th>
            <th scope="col">
              {countyName}, {period}
            </th>
            <th scope="col">{best.city} today</th>
            <th scope="col">Difference</th>
          </tr>
        </thead>
        <tbody>
          {comparisonRows(best).map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.county}</td>
              <td>{row.city}</td>
              <td>{row.difference}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* The next two closest cities, with their similarity word */}
      {others.length > 0 && (
        <p className="analogue__others">
          Also close:{' '}
          {others
            .map((city) => `${city.city}, ${city.country} (${similarityWord(city.similarity).toLowerCase()} match)`)
            .join('; ')}
          .
        </p>
      )}

      <HowItWorks />
    </div>
  );
}