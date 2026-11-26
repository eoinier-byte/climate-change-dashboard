// A card with the projected sea-level rise for one year (CCD-171, CCD-172), e.g. "Cork, by 2050".
// One line per ticked scenario, with the unit, the baseline and the source underneath.
// The page shows two of these side by side: 2050 and 2100 (stacked on phones).
//
// Props:
//   data     - one response from GET /api/sea-level/{slug}/
//   year     - the year to show, e.g. 2050 or 2100
//   selected - the ticked scenarios, e.g. ['rcp26', 'rcp85']
import { useId } from 'react';
import { ALL_SCENARIOS, SCENARIO_COLORS, SCENARIO_LABELS } from '../styles/scenarioColors';

// The API only sends the source's short code, so give it a readable name
const SOURCE_NAMES = {
  ukcp18: 'Met Office UKCP18',
};

// Turns the API's text value into what the card shows, e.g. "22.827" -> "+22.8".
// Returns null when there is no value.
function formatRise(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (Number.isNaN(number)) return null;
  const sign = number > 0 ? '+' : ''; // a fall already has its own minus sign
  return `${sign}${number.toFixed(1)}`;
}

export default function SeaLevelCard({ data, year, selected = ALL_SCENARIOS }) {
  // id for the heading, so screen readers name the card after it
  const headingId = useId();

  // Inland county (or nothing loaded): there is no sea-level projection to show
  if (!data || data.has_coastline === false) {
    return (
      <article className="sea-level-card">
        <p>No coastline</p>
      </article>
    );
  }

  // Where this year is in the list of years, e.g. 2050 is at position 3 in [2020, 2030, ... 2100]
  const index = data.years.indexOf(year);
  // The ticked scenarios that the API has data for, in the usual order (RCP2.6, RCP4.5, RCP8.5)
  const scenarios = ALL_SCENARIOS.filter((scenario) => selected.includes(scenario) && data.series[scenario]);

  // The year is not in the data, or no scenario is left to show
  if (index === -1 || scenarios.length === 0) {
    return (
      <article className="sea-level-card" aria-labelledby={headingId}>
        <h3 id={headingId}>
          {data.county}, by {year}
        </h3>
        <p>No sea-level projection is available for {year}.</p>
      </article>
    );
  }

  // Every series has the same source, so read it from the first one
  const firstSeries = data.series[scenarios[0]];
  const source = SOURCE_NAMES[firstSeries.source] || firstSeries.source;

  return (
    <article className="sea-level-card" aria-labelledby={headingId}>
      <h3 id={headingId}>
        {data.county}, by {year}
      </h3>
      <ul className="sea-level-card__list">
        {scenarios.map((scenario) => {
          const rise = formatRise(data.series[scenario].values[index]);
          return (
            <li key={scenario} className="sea-level-card__row">
              {/* Coloured square that matches the chart line, plus the name, so colour is not the only cue */}
              <span
                className="sea-level-card__swatch"
                style={{ backgroundColor: SCENARIO_COLORS[scenario] }}
                aria-hidden="true"
              />
              <span className="sea-level-card__name">{SCENARIO_LABELS[scenario]}</span>
              <strong className="sea-level-card__value">
                {rise === null ? 'no value' : `${rise} ${data.unit}`}
              </strong>
            </li>
          );
        })}
      </ul>
      <p className="sea-level-card__note">
        Rise in mean sea level compared with the {data.baseline_period} average. Source: {source}.
      </p>
    </article>
  );
}