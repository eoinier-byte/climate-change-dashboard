// The maps on the home page: the scenarios to draw, the year slider with its ▶ button, and one map for each
// ticked scenario, side by side on one colour scale. It replaces the single map of MapExplorer.
//
// The data is three 30-year averages (baseline, mid-century, end of century), so all three are requested for
// every scenario at once (the baseline is the same for all of them, so seven requests in all). The slider runs
// from 1990 to 2085, the middle years of the three periods; between two of them each county's colour is a
// smooth blend of its two colours (see periodBlend.js), and the numbers shown are the nearest period's own.
// The lowest and highest value across every scenario and period (the baseline and RCP8.5 at the end of the
// century) set the colour scale, so a warmer choice looks warmer.
// The choices live in the URL (useHomeMapView), so a link opens the same maps.
import { useId, useState } from 'react';
import useHomeMapView, { HOME_PERIODS } from '../hooks/useHomeMapView';
import useMapData from '../hooks/useMapData';
import { MAP_SCENARIOS } from '../hooks/useMapView';
import { SCENARIO_COLORS } from '../styles/scenarioColors';
import MapTile from './MapTile';
import { formatDegrees, valuesBySlug } from './homeMapData';
import { COUNTY_SHAPES } from './countyShapes';
import { YEAR_MAX, YEAR_MIN, blendAt } from './periodBlend';
import { sharedRange } from './mapColours';
import { legendRange, WARM_GRADIENT } from './warmRamp';
import '../styles/home-maps.css';

const VARIABLE = 'temperature';
const SEASON = 'annual';
const [BASELINE, MID, END] = HOME_PERIODS;

// "2071-2100" -> "2071–2100"
const periodText = (period) => period.replace('-', '–');

export default function HomeMaps() {
  const view = useHomeMapView();
  const scenarioName = useId();
  const sliderId = useId();
  const [hoverSlug, setHoverSlug] = useState(null);

  // Which two averages the year is between, and the nearer one (its numbers are the ones shown)
  const blend = blendAt(view.yearExact);
  const nearest = HOME_PERIODS[blend.nearest];

  // The baseline is the same for every scenario, so it is asked for once, as the "baseline" scenario.
  // Each scenario's three averages, in order: [baseline, mid-century, end of century].
  const baseline = useMapData(VARIABLE, 'baseline', BASELINE.period, SEASON);
  const answers = {
    rcp26: [baseline, useMapData(VARIABLE, 'rcp26', MID.period, SEASON), useMapData(VARIABLE, 'rcp26', END.period, SEASON)],
    rcp45: [baseline, useMapData(VARIABLE, 'rcp45', MID.period, SEASON), useMapData(VARIABLE, 'rcp45', END.period, SEASON)],
    rcp85: [baseline, useMapData(VARIABLE, 'rcp85', MID.period, SEASON), useMapData(VARIABLE, 'rcp85', END.period, SEASON)],
  };

  // The coolest and warmest of all the maps. Until both have arrived (or if one fails) each map uses its own range.
  const coolest = baseline;
  const warmest = answers.rcp85[2];
  const range = sharedRange([coolest.data, warmest.data]);
  const scale = legendRange(range);

  const shown = MAP_SCENARIOS.filter(({ value }) => view.scenarios.includes(value));

  // What the line under the maps says: the hovered county with its value on every map shown
  let hoverText = 'Hover a county to see its values; click to open its dashboard.';
  if (hoverSlug) {
    const name = COUNTY_SHAPES.find((shape) => shape.slug === hoverSlug)?.name ?? hoverSlug;
    const parts = shown.map(({ value, rcp }) => {
      const number = valuesBySlug(answers[value][blend.nearest].data)[hoverSlug];
      return number === undefined ? null : `${rcp} ${formatDegrees(number)}`;
    });
    const known = parts.filter(Boolean);
    hoverText = known.length > 0 ? `${name}: ${known.join(' · ')}` : name;
  }

  return (
    <div className="home-maps">
      <div className="home-maps__controls">
        <fieldset className="home-maps__scenarios">
          <legend>Scenarios on the map</legend>
          {MAP_SCENARIOS.map(({ value, plain, rcp }) => (
            <label key={value} className="home-maps__option">
              <input
                type="checkbox"
                name={scenarioName}
                checked={view.scenarios.includes(value)}
                onChange={() => view.toggleScenario(value)}
              />
              <span className="home-maps__swatch" style={{ backgroundColor: SCENARIO_COLORS[value] }} aria-hidden="true" />
              {plain} ({rcp})
            </label>
          ))}
          <span className="home-maps__hint">Tick several to see them side by side.</span>
        </fieldset>

        <div className="home-maps__period">
          <div className="home-maps__period-head">
            <label htmlFor={sliderId} className="home-maps__period-label">
              Year: {view.year}
            </label>
            <span className="home-maps__period-note">
              Numbers from the nearest average: {nearest.name.toLowerCase()}, {periodText(nearest.period)}
            </span>
          </div>
          <div className="home-maps__slider-row">
            <button type="button" className="home-maps__play" onClick={view.togglePlay}>
              <span aria-hidden="true">{view.playing ? '⏸' : '▶'}</span> {view.playing ? 'Pause' : 'Play'}
            </button>
            <div className="home-maps__slider">
              <input
                id={sliderId}
                type="range"
                min={YEAR_MIN}
                max={YEAR_MAX}
                step={1}
                value={view.year}
                aria-valuetext={`${view.year}, nearest average ${nearest.name} (${periodText(nearest.period)})`}
                onChange={(event) => view.setYear(Number(event.target.value))}
              />
              {/* The three averages under the slider: each is a button, so one can be picked directly */}
              <div className="home-maps__stops">
                {HOME_PERIODS.map((entry) => (
                  <button
                    key={entry.period}
                    type="button"
                    className="home-maps__stop"
                    aria-pressed={entry.year === view.year}
                    onClick={() => view.setPeriod(entry.period)}
                  >
                    {entry.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="home-maps__surface" role="region" aria-label="County maps">
        {shown.length === 0 ? (
          <div className="home-maps__empty">
            <p className="home-maps__empty-title">No scenario selected</p>
            <p>Tick at least one scenario above to draw its map. Tick several to compare them side by side.</p>
            <button type="button" className="btn btn--secondary" onClick={view.showAll}>
              Show all three
            </button>
          </div>
        ) : (
          <div className="home-maps__grid">
            {shown.map(({ value, plain, rcp }) => (
              <MapTile
                key={value}
                scenario={value}
                name={plain}
                rcp={rcp}
                color={SCENARIO_COLORS[value]}
                answers={answers[value]}
                blend={blend}
                range={scale ?? range}
                onHover={setHoverSlug}
              />
            ))}
          </div>
        )}

        {shown.length > 0 && (
          <div className="home-maps__key">
            <p className="home-maps__hover" aria-live="off">
              {hoverText}
            </p>
            {scale && (
              <div className="home-maps__legend">
                <span>{formatDegrees(scale[0])}</span>
                <span className="home-maps__gradient" style={{ background: WARM_GRADIENT }} aria-hidden="true" />
                <span>{formatDegrees(scale[1])}</span>
                <span>annual average temperature</span>
              </div>
            )}
          </div>
        )}
        <p className="home-maps__credit">
          One colour scale for every scenario and year, so maps can be compared. The data is three 30-year averages; years between them blend their colours. County boundaries &copy; Tailte
          &Eacute;ireann, CC BY 4.0. Source: TRANSLATE.
        </p>
      </div>
    </div>
  );
}
