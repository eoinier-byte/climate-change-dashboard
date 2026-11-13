// Tick boxes to show or hide each emissions scenario on the charts (CCD-158, CCD-165).
// Props:
//   "selected" - the scenarios ticked now, e.g. ['rcp26', 'rcp85']
//   "onChange" - called with the new list when a box is ticked or unticked
// At least one scenario always stays ticked, so the charts are never empty.
// ALL_SCENARIOS lives in scenarioColors.js: a component file may only export components
import { ALL_SCENARIOS, SCENARIO_COLORS, SCENARIO_LABELS } from '../styles/scenarioColors';

// A short description of each scenario, so people know what they are choosing
const DESCRIPTIONS = {
  rcp26: 'strong climate action',
  rcp45: 'some climate action',
  rcp85: 'high emissions',
};

// id of the hint text, so the disabled tick box can point to it (aria-describedby)
const HINT_ID = 'scenario-filter-hint';

export default function ScenarioFilter({ selected, onChange }) {
  // Only one scenario ticked: its box is disabled, so explain why
  const onlyOneLeft = selected.length === 1;

  // Runs when a box is clicked: add the scenario if it was unticked, remove it if it was ticked
  function handleToggle(scenario) {
    if (selected.includes(scenario)) {
      onChange(selected.filter((s) => s !== scenario));
    } else {
      // Keep the list in the usual order (RCP2.6, RCP4.5, RCP8.5), whatever order they are clicked in
      onChange(ALL_SCENARIOS.filter((s) => s === scenario || selected.includes(s)));
    }
  }

  return (
    // <fieldset> and <legend> group the tick boxes under one name for screen readers
    <fieldset className="scenario-filter">
      <legend>Show scenarios</legend>
      {ALL_SCENARIOS.map((scenario) => {
        const checked = selected.includes(scenario);
        // The last ticked box can't be unticked, so at least one scenario is always shown
        const isLastOne = checked && selected.length === 1;

        return (
          <label key={scenario} className="scenario-filter__option">
            <input
              type="checkbox"
              checked={checked}
              disabled={isLastOne}
              // A screen reader reads the hint below when it reaches the disabled box
              aria-describedby={isLastOne ? HINT_ID : undefined}
              onChange={() => handleToggle(scenario)}
            />
            {/* Coloured square that matches the chart line, plus the name, so colour is not the only cue */}
            <span
              className="scenario-filter__swatch"
              style={{ backgroundColor: SCENARIO_COLORS[scenario] }}
              aria-hidden="true"
            />
            {SCENARIO_LABELS[scenario]} ({DESCRIPTIONS[scenario]})
          </label>
        );
      })}
      {/* Shown only when one scenario is left, to explain why its box can't be unticked */}
      {onlyOneLeft && (
        <p id={HINT_ID} className="scenario-filter__hint">
          At least one scenario must be shown.
        </p>
      )}
    </fieldset>
  );
}