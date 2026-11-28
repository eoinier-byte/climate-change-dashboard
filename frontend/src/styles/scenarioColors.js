// The scenario colours for charts and the map. Keep in sync with --color-rcp* in theme.css
// (theme.test.js fails if they drift apart). Colour must never be the only cue: also use
// line styles or labels (docs/data-flow.md).
export const SCENARIO_COLORS = {
  rcp26: '#2e7d32', // green
  rcp45: '#b45309', // amber
  rcp85: '#c62828', // red
};

// The three future scenarios, from lowest to highest emissions.
// Used by the "Show scenarios" tick boxes and the county page (CCD-158, CCD-165).
export const ALL_SCENARIOS = ['rcp26', 'rcp45', 'rcp85'];

export const SCENARIO_LABELS = {
  rcp26: 'RCP2.6',
  rcp45: 'RCP4.5',
  rcp85: 'RCP8.5',
};

// Plain-language names for the scenarios (CCD-426), the one list used across the site, so people who don't
// know the RCP codes still know what they are choosing. Shown next to the RCP code, e.g. "RCP4.5: Middle path".
// The longer explanation of each one is on the About page.
export const SCENARIO_PLAIN_NAMES = {
  rcp26: 'If the world cuts emissions',
  rcp45: 'Middle path',
  rcp85: 'If nothing is done',
};