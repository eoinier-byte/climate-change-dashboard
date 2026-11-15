// The "What this means for you" block on the county page (CCD-375).
// It turns the projections into everyday impacts: hot days, frost days, the growing season
// and how much heating homes need, using the impacts endpoint (CCD-364):
//   GET /api/counties/{slug}/impacts/
//
// Props (all come from the county page):
//   slug           - the county, e.g. "cork"
//   scenarios      - the ticked scenarios, e.g. ['rcp26', 'rcp85']
//   period         - the chosen period, e.g. '2071-2100'
//   baselinePeriod - the "today" period the figures are compared with, e.g. '1976-2005'
//
// It loads its own data, so if the impacts endpoint fails, the rest of the county page still works.
import { useEffect, useState } from 'react';
import ErrorMessage from './ErrorMessage';
import Loading from './Loading';
import { buildImpacts } from './impactsData';
import { getImpacts } from '../services/api';
import '../styles/impacts.css';

export default function ImpactsBlock({ slug, scenarios, period, baselinePeriod }) {
  // What the API sent back, saved with the slug it was for:
  // { slug, rows } when it worked, or { slug, error } when it failed
  const [result, setResult] = useState(null);

  useEffect(() => {
    // "ignore" stops an old answer from overwriting a newer county (same idea as the county page)
    let ignore = false;

    getImpacts(slug)
      .then((rows) => {
        if (!ignore) setResult({ slug, rows });
      })
      .catch((error) => {
        if (!ignore) setResult({ slug, error });
      });

    return () => {
      ignore = true;
    };
  }, [slug]);

  // Still loading, or the answer is for a different county
  if (!result || result.slug !== slug) {
    return <Loading message="Loading everyday impacts…" />;
  }

  if (result.error) {
    return <ErrorMessage error={result.error} />;
  }

  // Only the cards for the chosen period and the ticked scenarios.
  // Changing the tick boxes or the period re-draws this without asking the server again.
  const cards = buildImpacts(result.rows, period, scenarios);

  if (cards.length === 0) {
    return <p>No everyday impact figures are available for this county and period yet.</p>;
  }

  return (
    <div className="impacts">
      {/* Says which period and baseline the numbers are for (the scenario is on every line) */}
      <p className="impacts__intro">
        What the projections mean day to day in {period}, compared with the {baselinePeriod} average.
      </p>

      <div className="impacts__grid">
        {cards.map((card) => (
          <article key={card.code} className="impact-card" aria-labelledby={`impact-${card.code}`}>
            <h3 id={`impact-${card.code}`} className="impact-card__title">
              {card.label}
            </h3>
            <p className="impact-card__explain">{card.explain}</p>
            <p className="impact-card__today">
              <strong>Today:</strong> <span>{card.today}</span>
            </p>
            <ul className="impact-card__list">
              {card.projections.map((line) => (
                <li key={line.scenario} className={`impact-card__line impact-card__line--${line.scenario}`}>
                  {/* The scenario name is written out, so colour is never the only cue */}
                  <span className="impact-card__scenario">{line.scenarioLabel}:</span>{' '}
                  <span>{line.text}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <p className="impacts__source">
        County averages from Met Éireann TRANSLATE (CC BY 4.0). Individual years will vary.
      </p>
    </div>
  );
}