// The choices at the top of the Compare page (CCD-207, CCD-378): the mode (what is being compared), and
// the controls for that mode. They are plain dropdowns and radio buttons, so they work with the keyboard
// and a screen reader.
import { MAP_SCENARIOS, PERIOD_NAMES } from '../hooks/useMapView';
import { PERIODS } from '../hooks/useCountyView';

const MODE_NAMES = {
  scenarios: 'Two scenarios in one county',
  counties: 'Two counties under one scenario',
};

// Choose what to compare. Props: mode, modes (the list to offer), onChange(mode)
export function ModeSwitch({ mode, modes, onChange }) {
  return (
    <fieldset className="scenario-filter">
      <legend>Compare</legend>
      {modes.map((item) => (
        <label key={item} className="scenario-filter__option">
          <input type="radio" name="compare-mode" value={item} checked={item === mode} onChange={() => onChange(item)} />
          {MODE_NAMES[item]}
        </label>
      ))}
    </fieldset>
  );
}

// A dropdown of counties. The county list [{ name, slug }] can be empty (still loading, or it could not
// be loaded), and then nothing is shown.
function CountyField({ id, label, counties, value, onChange }) {
  if (counties.length === 0) return null;
  const known = counties.some((item) => item.slug === value);

  return (
    <div className="compare-controls__field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={known ? value : ''} onChange={(event) => onChange(event.target.value)}>
        {!known && (
          <option value="" disabled>
            Select…
          </option>
        )}
        {counties.map((item) => (
          <option key={item.slug} value={item.slug}>
            {item.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function ScenarioSelect({ id, label, value, onChange }) {
  return (
    <div className="compare-controls__field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {MAP_SCENARIOS.map((scenario) => (
          <option key={scenario.value} value={scenario.value}>
            {scenario.rcp}: {scenario.plain}
          </option>
        ))}
      </select>
    </div>
  );
}

function PeriodChoice({ period, onChange }) {
  return (
    <fieldset className="scenario-filter">
      <legend>Period</legend>
      {PERIODS.map((item) => (
        <label key={item} className="scenario-filter__option">
          <input type="radio" name="compare-period" value={item} checked={item === period} onChange={() => onChange(item)} />
          {PERIOD_NAMES[item] || item} ({item})
        </label>
      ))}
    </fieldset>
  );
}

// Comparing two scenarios in one county (CCD-207).
// Props: counties, county, first, second, period, onCounty, onFirst, onSecond, onPeriod
export default function CompareControls({ counties, county, first, second, period, onCounty, onFirst, onSecond, onPeriod }) {
  return (
    <div className="compare-controls">
      <CountyField id="compare-county" label="County" counties={counties} value={county} onChange={onCounty} />
      <ScenarioSelect id="compare-first" label="First scenario" value={first} onChange={onFirst} />
      <ScenarioSelect id="compare-second" label="Second scenario" value={second} onChange={onSecond} />
      <PeriodChoice period={period} onChange={onPeriod} />
    </div>
  );
}

// Comparing one scenario in two counties (CCD-378).
// Props: counties, county, county2, scenario, period, onCounty, onSecondCounty, onScenario, onPeriod
export function CountyCompareControls({
  counties,
  county,
  county2,
  scenario,
  period,
  onCounty,
  onSecondCounty,
  onScenario,
  onPeriod,
}) {
  return (
    <div className="compare-controls">
      <CountyField id="compare-county" label="First county" counties={counties} value={county} onChange={onCounty} />
      <CountyField id="compare-county2" label="Second county" counties={counties} value={county2} onChange={onSecondCounty} />
      <ScenarioSelect id="compare-scenario" label="Scenario" value={scenario} onChange={onScenario} />
      <PeriodChoice period={period} onChange={onPeriod} />
    </div>
  );
}
