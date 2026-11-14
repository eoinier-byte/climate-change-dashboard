// Choice of future period for the seasonal charts (CCD-406).
// Props:
//   "periods"  - the periods to offer, e.g. ['2021-2050', '2071-2100']
//   "selected" - the period chosen now, e.g. '2071-2100'
//   "onChange" - called with the new period when another one is picked

// Plain-language names, so people don't have to read the years to know which is which
const PERIOD_NAMES = {
  '2021-2050': 'Mid-century',
  '2071-2100': 'End of century',
};

export default function PeriodFilter({ periods, selected, onChange }) {
  return (
    // Radio buttons: only one period can be chosen. <fieldset> + <legend> name the group.
    // Arrow keys move between the options, so it works with the keyboard.
    <fieldset className="scenario-filter">
      <legend>Seasonal charts show</legend>
      {periods.map((period) => (
        <label key={period} className="scenario-filter__option">
          <input
            type="radio"
            name="period"
            value={period}
            checked={period === selected}
            onChange={() => onChange(period)}
          />
          {PERIOD_NAMES[period] || period} ({period})
        </label>
      ))}
    </fieldset>
  );
}