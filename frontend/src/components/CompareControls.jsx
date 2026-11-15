// The choices at the top of the Compare page (CCD-207): which county, which two scenarios and which
// period. They are plain dropdowns and radio buttons, so they work with the keyboard and a screen reader.
// Props:
//   counties   - the county list [{ name, slug }]; the county dropdown is hidden while it is empty
//   county     - the slug chosen now
//   first, second - the two scenarios chosen now, e.g. 'rcp26' and 'rcp85'
//   period     - the period chosen now
//   onCounty, onFirst, onSecond, onPeriod - called with the new choice
import { MAP_SCENARIOS, PERIOD_NAMES } from '../hooks/useMapView';
import { PERIODS } from '../hooks/useCountyView';

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

export default function CompareControls({ counties, county, first, second, period, onCounty, onFirst, onSecond, onPeriod }) {
  const known = counties.some((item) => item.slug === county);

  return (
    <div className="compare-controls">
      {counties.length > 0 && (
        <div className="compare-controls__field">
          <label htmlFor="compare-county">County</label>
          <select id="compare-county" value={known ? county : ''} onChange={(event) => onCounty(event.target.value)}>
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
      )}

      <ScenarioSelect id="compare-first" label="First scenario" value={first} onChange={onFirst} />
      <ScenarioSelect id="compare-second" label="Second scenario" value={second} onChange={onSecond} />

      <fieldset className="scenario-filter">
        <legend>Period</legend>
        {PERIODS.map((item) => (
          <label key={item} className="scenario-filter__option">
            <input type="radio" name="compare-period" value={item} checked={item === period} onChange={() => onPeriod(item)} />
            {PERIOD_NAMES[item] || item} ({item})
          </label>
        ))}
      </fieldset>
    </div>
  );
}
