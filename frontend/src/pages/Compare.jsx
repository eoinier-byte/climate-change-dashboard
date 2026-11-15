// The Compare page, /compare (CCD-207). Pick a county, two scenarios and a period, and the page shows what
// each scenario projects, how much each changes from the 1976-2005 baseline, and the difference
// between them (the second minus the first) for temperature and rainfall, for the whole year and each
// season. The choices are kept in the URL (see hooks/useCompareView.js), so a shared link opens the same
// comparison. The sums are in components/compareData.js and use the stored values only.
// Comparing two counties is the next piece (CCD-378).
import CompareControls from '../components/CompareControls';
import ErrorMessage from '../components/ErrorMessage';
import Loading from '../components/Loading';
import {
  SEASON_NAMES,
  VARIABLE_NAMES,
  compareScenarios,
  formatChange,
  formatDifference,
  formatValue,
  summaryLines,
} from '../components/compareData';
import useCompareData from '../hooks/useCompareData';
import useCompareView from '../hooks/useCompareView';
import { PERIOD_NAMES } from '../hooks/useMapView';
import { SCENARIO_LABELS } from '../styles/scenarioColors';
import '../styles/compare.css';

// One scenario's cell: the projected value, and how far it is from the baseline
function ScenarioCell({ projected, measure }) {
  if (!projected) return <td>No data</td>;
  return (
    <td>
      <span className="compare-table__value">{formatValue(projected.value, measure)}</span>
      <span className="compare-table__change">{formatChange(projected.change, measure)} from baseline</span>
    </td>
  );
}

export default function Compare() {
  const view = useCompareView();
  const { counties, rows, loading, error, retry } = useCompareData(view.county);

  // Until the county list arrives (or if it cannot be loaded) the name is made from the slug
  const countyName =
    counties.find((county) => county.slug === view.county)?.name ?? view.county.charAt(0).toUpperCase() + view.county.slice(1);
  const labelA = SCENARIO_LABELS[view.first];
  const labelB = SCENARIO_LABELS[view.second];

  let body;
  if (loading) {
    body = <Loading message="Loading projections…" />;
  } else if (error) {
    body = <ErrorMessage error={error} onRetry={retry} />;
  } else {
    const measures = compareScenarios(rows, view.first, view.second, view.period);
    const lines = summaryLines(measures, labelA, labelB, countyName);

    body =
      measures.length === 0 ? (
        <p role="status">There are no projections to compare for this choice.</p>
      ) : (
        <section aria-labelledby="compare-heading">
          <h2 id="compare-heading">
            {countyName}: {labelA} compared with {labelB}, {PERIOD_NAMES[view.period]?.toLowerCase()} ({view.period})
          </h2>

          {lines.length > 0 && (
            <ul className="compare-summary">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}

          <div className="compare-table-wrap">
            <table className="compare-table">
              <caption className="compare-table__caption">
                {labelA} and {labelB} for {countyName} in {view.period}, with the difference ({labelB} minus {labelA})
              </caption>
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col">Baseline (1976-2005)</th>
                  <th scope="col" className={`compare-table__scenario compare-table__scenario--${view.first}`}>
                    {labelA}
                  </th>
                  <th scope="col" className={`compare-table__scenario compare-table__scenario--${view.second}`}>
                    {labelB}
                  </th>
                  <th scope="col">
                    Difference ({labelB} minus {labelA})
                  </th>
                </tr>
              </thead>
              <tbody>
                {measures.map((measure) => (
                  <tr key={`${measure.variable}-${measure.season}`}>
                    <th scope="row">
                      {VARIABLE_NAMES[measure.variable]}, {SEASON_NAMES[measure.season].toLowerCase()}
                    </th>
                    <td>{formatValue(measure.baseline, measure)}</td>
                    <ScenarioCell projected={measure.a} measure={measure} />
                    <ScenarioCell projected={measure.b} measure={measure} />
                    <td className="compare-table__difference">{formatDifference(measure.difference, measure)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="compare-note">
            Temperature change is in °C. Rainfall change is a percentage of the baseline, and the difference is in mm.
          </p>
        </section>
      );
  }

  return (
    <main className="compare-page">
      <h1>Compare</h1>
      <p className="compare-page__intro">
        See how the climate in a county is projected to change under two different emissions scenarios, and how big
        the difference between them is.
      </p>
      <CompareControls
        counties={counties}
        county={view.county}
        first={view.first}
        second={view.second}
        period={view.period}
        onCounty={view.setCounty}
        onFirst={view.setFirst}
        onSecond={view.setSecond}
        onPeriod={view.setPeriod}
      />
      {body}
    </main>
  );
}
