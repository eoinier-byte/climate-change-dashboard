// The scenario and period chosen on the county page, kept in the URL (CCD-406),
// so a link like /county/cork?rcp=26,85&period=2021-2050 opens exactly the same view.
//
// URL settings and their defaults (used when a setting is missing or not valid):
//   rcp     which scenarios to show, as a comma list of 26, 45, 85.  Default: all three
//           e.g. ?rcp=85 (only RCP8.5) or ?rcp=26,85 (RCP2.6 and RCP8.5)
//   period  which future period the seasonal charts show.            Default: 2071-2100
//           e.g. ?period=2021-2050
// A setting that matches its default is left out of the URL, so the plain /county/cork stays clean.
import { useSearchParams } from 'react-router-dom';
import { ALL_SCENARIOS } from '../styles/scenarioColors';

export const DEFAULT_PERIOD = '2071-2100';
export const PERIODS = ['2021-2050', '2071-2100'];

// "26,85" -> ['rcp26', 'rcp85']. Unknown values are ignored; if nothing valid is left, all three.
export function parseScenarios(text) {
  if (!text) return ALL_SCENARIOS;

  const wanted = text.split(',').map((part) => `rcp${part.trim()}`);
  // Filter ALL_SCENARIOS (not "wanted") so the order is always RCP2.6, RCP4.5, RCP8.5 with no repeats
  const valid = ALL_SCENARIOS.filter((scenario) => wanted.includes(scenario));
  return valid.length > 0 ? valid : ALL_SCENARIOS;
}

// ['rcp26', 'rcp85'] -> "26,85" (the opposite of parseScenarios)
export function scenariosToText(scenarios) {
  return scenarios.map((scenario) => scenario.replace('rcp', '')).join(',');
}

// "2021-2050" -> "2021-2050"; anything that isn't a known period -> the default
export function parsePeriod(text) {
  return PERIODS.includes(text) ? text : DEFAULT_PERIOD;
}

// The hook the county page uses. It reads the choice from the URL and gives back
// functions that write a new choice into the URL (which re-draws the page).
export default function useCountyView() {
  const [searchParams, setSearchParams] = useSearchParams();

  const scenarios = parseScenarios(searchParams.get('rcp'));
  const period = parsePeriod(searchParams.get('period'));

  // Writes one setting into the URL, or removes it when it's the default.
  // replace: true changes the current history entry instead of adding one,
  // so the browser's Back button goes to the previous page, not the previous tick.
  function updateParam(name, value, defaultValue) {
    const next = new URLSearchParams(searchParams); // copy, so other settings are kept
    if (value === defaultValue) {
      next.delete(name);
    } else {
      next.set(name, value);
    }
    setSearchParams(next, { replace: true });
  }

  function setScenarios(list) {
    updateParam('rcp', scenariosToText(list), scenariosToText(ALL_SCENARIOS));
  }

  function setPeriod(value) {
    updateParam('period', value, DEFAULT_PERIOD);
  }

  return { scenarios, period, setScenarios, setPeriod };
}