// Compare two counties under one scenario (CCD-378): the controls, a sentence about the difference, two
// charts with both counties on the same axes (temperature and rainfall change by season), and a table
// with each county's baseline and projection and the difference (the second county minus the first).
// Both counties use the same scenario and period. The sums are in compareData.js, from stored values only.
import { CountyCompareControls } from './CompareControls';
import CountyCompareChart from './CountyCompareChart';
import ErrorMessage from './ErrorMessage';
import Loading from './Loading';
import ProjectedCell from './ProjectedCell';
import {
  SEASON_NAMES,
  VARIABLE_NAMES,
  compareCounties,
  countySummaryLines,
  formatDifference,
  formatValue,
} from './compareData';
import { useProjectionRows } from '../hooks/useCompareData';
import { PERIOD_NAMES } from '../hooks/useMapView';
import { SCENARIO_LABELS } from '../styles/scenarioColors';

// Props: view (from useCompareView), counties (the county list, [] until it arrives)
export default function CountyComparison({ view, counties }) {
  const first = useProjectionRows(view.county);
  const second = useProjectionRows(view.county2);

  const nameOf = (slug) =>
    counties.find((county) => county.slug === slug)?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);
  const nameA = nameOf(view.county);
  const nameB = nameOf(view.county2);
  const label = SCENARIO_LABELS[view.scenario];

  // Retry asks again for whichever county failed
  const failed = [first, second].filter((result) => result.error);
  const retry = () => failed.forEach((result) => result.retry());

  let body;
  if (failed.length > 0) {
    body = <ErrorMessage error={failed[0].error} onRetry={retry} />;
  } else if (first.loading || second.loading) {
    // Wait for both, so the table never has one county's numbers and a gap for the other
    body = <Loading message="Loading projections…" />;
  } else {
    const measures = compareCounties(first.rows, second.rows, view.scenario, view.period);
    // "<second county> warms X more than <first county>", the same order as the table (second minus first)
    const lines = countySummaryLines(measures, label, nameA, nameB);
    const source = first.rows.find((row) => row.source)?.source;

    body =
      measures.length === 0 ? (
        <p role="status">There are no projections to compare for this choice.</p>
      ) : (
        <section aria-labelledby="compare-heading">
          <h2 id="compare-heading">
            {nameA} compared with {nameB} under {label}, {PERIOD_NAMES[view.period]?.toLowerCase()} ({view.period})
          </h2>

          {lines.length > 0 && (
            <ul className="compare-summary">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}

          {['temperature', 'precipitation'].map((variable) => (
            <CountyCompareChart
              key={variable}
              measures={measures}
              variable={variable}
              nameA={nameA}
              nameB={nameB}
              scenarioLabel={label}
              period={view.period}
              source={source}
            />
          ))}

          <div className="compare-table-wrap">
            <table className="compare-table">
              <caption className="compare-table__caption">
                {nameA} and {nameB} under {label} in {view.period}, with the difference ({nameB} minus {nameA})
              </caption>
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col">{nameA} baseline (1976-2005)</th>
                  <th scope="col" className="compare-table__scenario compare-table__scenario--county1">
                    {nameA}
                  </th>
                  <th scope="col">{nameB} baseline (1976-2005)</th>
                  <th scope="col" className="compare-table__scenario compare-table__scenario--county2">
                    {nameB}
                  </th>
                  <th scope="col">
                    Difference ({nameB} minus {nameA})
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
                    <td>{formatValue(measure.baselineB, measure)}</td>
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
      <CountyCompareControls
        counties={counties}
        county={view.county}
        county2={view.county2}
        scenario={view.scenario}
        period={view.period}
        onCounty={view.setCounty}
        onSecondCounty={view.setSecondCounty}
        onScenario={view.setScenario}
        onPeriod={view.setPeriod}
      />
      {body}
    </>
  );
}
