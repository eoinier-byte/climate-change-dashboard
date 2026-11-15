// Warming stripes for one county (CCD-391): a row of coloured bars for each ticked scenario,
// from the baseline (1976-2005) to the end of the century, blue for cooler and red for warmer.
//
// Props:
//   series   - the annual temperature series from buildSeries(rows, name, 'temperature'),
//              with ALL scenarios (so the colours stay the same when a scenario is unticked)
//   selected - the ticked scenarios, e.g. ['rcp26', 'rcp85']
//
// Colour shows temperature only. Scenarios are named in text, never by colour, because
// red here means "warmer", not RCP8.5. Each bar also has a text label for screen readers.
import { buildStripes } from './stripeColors';
import '../styles/warming-stripes.css';

export default function WarmingStripes({ series, selected }) {
  const stripes = buildStripes(series, selected);
  if (!stripes || stripes.rows.length === 0) return null;

  return (
    <figure className="warming-stripes">
      <h3 className="warming-stripes__title">Warming stripes for {stripes.county}</h3>
      <p className="warming-stripes__subtitle">
        Average yearly temperature in each period, one row for each scenario.
      </p>

      {stripes.rows.map((row) => (
        <div className="warming-stripes__row" key={row.key}>
          <p className="warming-stripes__scenario">{row.label}</p>
          <ul className="warming-stripes__bars">
            {row.stripes.map((stripe) => (
              <li className="warming-stripes__bar-item" key={stripe.period}>
                <div
                  className={`warming-stripes__bar${stripe.color ? '' : ' warming-stripes__bar--empty'}`}
                  role="img"
                  aria-label={`${row.label}, ${stripe.period}: ${stripe.text}`}
                  style={stripe.color ? { backgroundColor: stripe.color } : undefined}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* The period under each column. Screen readers already hear it in each bar's label. */}
      <ul className="warming-stripes__axis" aria-hidden="true">
        {stripes.periods.map((period) => (
          <li key={period}>{period}</li>
        ))}
      </ul>

      <figcaption className="warming-stripes__caption">
        Colour shows temperature, not the scenario: blue is {stripes.range.minText}, red is{' '}
        {stripes.range.maxText}. <span className="warming-stripes__source">Source: {stripes.source}.</span>
      </figcaption>
    </figure>
  );
}
