// The controls above the home page map (CCD-383): a scenario switch, a period slider and a ▶ button
// that steps through the periods. It only shows the choices; the home page (MapExplorer) holds them.
// Props:
//   "scenario"         - the scenario chosen now, e.g. 'rcp85'
//   "period"           - the period chosen now, e.g. '2071-2100'
//   "playing"          - true while ▶ is stepping through the periods
//   "onScenarioChange" - called with the new scenario
//   "onPeriodChange"   - called with the new period
//   "onTogglePlay"     - called when ▶ or ⏸ is pressed
import { useId } from 'react';
import { PERIODS } from '../hooks/useCountyView';
import { MAP_SCENARIOS, PERIOD_NAMES } from '../hooks/useMapView';
import { SCENARIO_COLORS } from '../styles/scenarioColors';
import '../styles/map-controls.css';

// "2071-2100" -> "2071–2100"
const periodText = (period) => period.replace('-', '–');
const periodLabel = (period) => `${PERIOD_NAMES[period] ?? ''} (${periodText(period)})`.trim();

export default function MapControls({ scenario, period, playing, onScenarioChange, onPeriodChange, onTogglePlay }) {
  const name = useId();
  const sliderId = useId();

  return (
    <div className="map-controls">
      {/* Radio buttons: one scenario at a time. Arrow keys move between them. */}
      <fieldset className="map-controls__scenarios">
        <legend>Scenario</legend>
        {MAP_SCENARIOS.map(({ value, plain, rcp }) => (
          <label key={value} className="map-controls__option">
            <input
              type="radio"
              name={name}
              value={value}
              checked={value === scenario}
              onChange={() => onScenarioChange(value)}
            />
            {/* Same colour as on the charts, plus the name, so colour is not the only cue */}
            <span className="map-controls__swatch" style={{ backgroundColor: SCENARIO_COLORS[value] }} aria-hidden="true" />
            {plain} ({rcp})
          </label>
        ))}
      </fieldset>

      <div className="map-controls__period">
        <label htmlFor={sliderId} className="map-controls__period-label">
          Period: {periodLabel(period)}
        </label>
        <div className="map-controls__slider-row">
          <button type="button" className="map-controls__play" onClick={onTogglePlay}>
            <span aria-hidden="true">{playing ? '⏸' : '▶'}</span> {playing ? 'Pause' : 'Play'}
          </button>
          <div className="map-controls__slider">
            <input
              id={sliderId}
              type="range"
              min={0}
              max={PERIODS.length - 1}
              step={1}
              value={Math.max(PERIODS.indexOf(period), 0)}
              aria-valuetext={periodLabel(period)}
              onChange={(event) => onPeriodChange(PERIODS[Number(event.target.value)])}
            />
            {/* The stops under the slider. The label above already says which is chosen. */}
            <div className="map-controls__stops" aria-hidden="true">
              {PERIODS.map((stop) => (
                <span key={stop}>{periodText(stop)}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
