// Compare two scenarios in one county (CCD-207): the controls, then a table of what each scenario
// projects, how much each changes from the 1976-2005 baseline, and the difference between them (the
// second minus the first) for temperature and rainfall, for the whole year and each season.
// The sums are in compareData.js and use the stored values only.
import CompareControls from './CompareControls';
import ErrorMessage from './ErrorMessage';
import Loading from './Loading';
import ProjectedCell from './ProjectedCell';
import {
  SEASON_NAMES,
  VARIABLE_NAMES,
  compareScenarios,
  formatDifference,
  formatValue,
  summaryLines,
} from './compareData';
import { useProjectionRows } from '../hooks/useCompareData';
import { PERIOD_NAMES } from '../hooks/useMapView';
import { SCENARIO_LABELS } from '../styles/scenarioColors';

// Props: view (from useCompareView), counties (the county list, [] until it arrives)
export default function ScenarioComparison({ view, counties }) {
  const { rows, loading, error, retry } = useProjectionRows(view.county);

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
                    <ProjectedCell projected={measure.a} measure={measure} />
                    <ProjectedCell projected={measure.b} measure={measure} />
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
    <>
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
    </>
  );
}
