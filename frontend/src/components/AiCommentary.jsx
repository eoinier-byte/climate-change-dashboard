// The "AI-generated summary" block near the top of the county page (CCD-285, CCD-454).
//
// A short plain-English summary of the county, written by an AI from the county's own data (backend: CCD-197).
// It follows the page's scenario: the highest-emissions scenario that is ticked, the same rule as the climate
// analogue (the endpoint takes one scenario at a time).
//
// States:
//   - loading: a message, because the first request for a county and scenario takes a few seconds
//     while the text is written (it is cached after that)
//   - no summary available (503, or any other failure): the whole block is hidden, since the page is
//     complete without it
//   - loaded: the label, the summary, then temperature, rainfall, scenarios, analogue and, for a coastal
//     county only, sea level
//
// Props:
//   slug     - the county's slug, e.g. "cork"
//   selected - the ticked scenarios, e.g. ['rcp26', 'rcp85']
import useCommentary from '../hooks/useCommentary';
import Loading from './Loading';
import { pickScenario } from './analogueData';
import { SCENARIO_LABELS, SCENARIO_PLAIN_NAMES } from '../styles/scenarioColors';
import '../styles/commentary.css';

// The detail lines under the summary, in order. sea_level is null for an inland county and is skipped.
const DETAILS = [
  ['temperature', 'Temperature'],
  ['precipitation', 'Rainfall'],
  ['scenarios', 'Scenarios'],
  ['analogue', 'Climate analogue'],
  ['sea_level', 'Sea level'],
];

export default function AiCommentary({ slug, selected }) {
  const scenario = pickScenario(selected);
  const { commentary, loading } = useCommentary(slug, scenario);

  // Nothing came back: leave no empty box or heading behind
  if (!loading && !commentary) return null;

  return (
    <section className="commentary" aria-labelledby="commentary-heading">
      <h2 id="commentary-heading">AI-generated summary</h2>
      {loading ? (
        <Loading message="Writing the summary. This can take a few seconds the first time." />
      ) : (
        <>
          <p className="commentary__note">
            Written by an AI from the data on this page, for {SCENARIO_LABELS[scenario]}: {SCENARIO_PLAIN_NAMES[scenario]}.
            It can make mistakes, so check the charts for the exact figures.
          </p>
          <p className="commentary__summary">{commentary.summary}</p>
          <ul className="commentary__list">
            {DETAILS.filter(([field]) => commentary[field]).map(([field, label]) => (
              <li key={field}>
                <strong>{label}:</strong> {commentary[field]}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
