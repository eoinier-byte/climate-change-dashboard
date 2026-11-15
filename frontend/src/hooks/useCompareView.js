// The choices on the Compare page (CCD-207, CCD-378), kept in the URL so a shared link opens the same
// comparison.
//   mode    what is compared: scenarios (one county, two scenarios) or counties (one scenario, two
//           counties).                                                      Default: scenarios
//   county  the county (the first county, when comparing counties), as its slug.   Default: cork
//   county2 the second county, when comparing counties.                      Default: kerry
//   a, b    the two scenarios, when comparing scenarios, as 26, 45 or 85.   Defaults: 26 and 85
//   rcp     the scenario, when comparing counties, as 26, 45 or 85.         Default: 85
//   period  which future period, e.g. 2021-2050.                           Default: 2071-2100
// e.g. /compare?county=kerry&a=45&b=85&period=2021-2050
//      /compare?mode=counties&county=donegal&county2=kerry&rcp=45
// A setting that matches its default is left out of the URL. Neither the two scenarios nor the two
// counties are ever the same: comparing something with itself would only ever show zero.
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ALL_SCENARIOS } from '../styles/scenarioColors';
import { DEFAULT_PERIOD, PERIODS } from './useCountyView';

export const MODES = ['scenarios', 'counties'];
export const DEFAULT_MODE = 'scenarios';
export const DEFAULT_COUNTY = 'cork';
export const DEFAULT_SECOND_COUNTY = 'kerry';
export const DEFAULT_FIRST = 'rcp26';
export const DEFAULT_SECOND = 'rcp85';
export const DEFAULT_SCENARIO = 'rcp85';

// "45" -> 'rcp45'; anything that is not one of the three scenarios -> the fallback
function parseScenario(text, fallback) {
  const scenario = `rcp${text}`;
  return ALL_SCENARIOS.includes(scenario) ? scenario : fallback;
}

const short = (scenario) => scenario.replace('rcp', '');
const slugOf = (text, fallback) => (text ?? '').trim().toLowerCase() || fallback;

export default function useCompareView() {
  const [searchParams, setSearchParams] = useSearchParams();

  const mode = MODES.includes(searchParams.get('mode')) ? searchParams.get('mode') : DEFAULT_MODE;
  const period = PERIODS.includes(searchParams.get('period')) ? searchParams.get('period') : DEFAULT_PERIOD;

  const county = slugOf(searchParams.get('county'), DEFAULT_COUNTY);
  let county2 = slugOf(searchParams.get('county2'), DEFAULT_SECOND_COUNTY);
  // The same county twice (a typed or old link): keep the first and pick another for the second
  if (county2 === county) county2 = county === DEFAULT_SECOND_COUNTY ? DEFAULT_COUNTY : DEFAULT_SECOND_COUNTY;

  const first = parseScenario(searchParams.get('a')?.trim(), DEFAULT_FIRST);
  let second = parseScenario(searchParams.get('b')?.trim(), DEFAULT_SECOND);
  if (second === first) second = first === DEFAULT_SECOND ? DEFAULT_FIRST : DEFAULT_SECOND;

  const scenario = parseScenario(searchParams.get('rcp')?.trim(), DEFAULT_SCENARIO);

  // Writes settings into the URL, each one as [value, default] (left out when it is the default).
  // It starts from the URL as it is right now, so other settings are kept, and replace: true changes
  // the current history entry, so Back leaves the page rather than stepping through every choice.
  const update = useCallback(
    (changes) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(changes).forEach(([name, [value, defaultValue]]) => {
            if (value === defaultValue) next.delete(name);
            else next.set(name, value);
          });
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setMode = (value) => update({ mode: [value, DEFAULT_MODE] });
  const setPeriod = (value) => update({ period: [value, DEFAULT_PERIOD] });
  const setScenario = (value) => update({ rcp: [short(value), short(DEFAULT_SCENARIO)] });

  // Choosing the one that is already the other swaps them, so the two stay different
  const writeCounties = (nextFirst, nextSecond) =>
    update({ county: [nextFirst, DEFAULT_COUNTY], county2: [nextSecond, DEFAULT_SECOND_COUNTY] });
  const setCounty = (slug) => {
    // Comparing scenarios has only one county, and the second one is not in the URL
    if (mode !== 'counties') return update({ county: [slug, DEFAULT_COUNTY] });
    return writeCounties(slug, slug === county2 ? county : county2);
  };
  const setSecondCounty = (slug) => writeCounties(slug === county ? county2 : county, slug);

  const writeScenarios = (nextFirst, nextSecond) =>
    update({ a: [short(nextFirst), short(DEFAULT_FIRST)], b: [short(nextSecond), short(DEFAULT_SECOND)] });
  const setFirst = (value) => writeScenarios(value, value === second ? first : second);
  const setSecond = (value) => writeScenarios(value === first ? second : first, value);

  return {
    mode,
    county,
    county2,
    first,
    second,
    scenario,
    period,
    setMode,
    setCounty,
    setSecondCounty,
    setFirst,
    setSecond,
    setScenario,
    setPeriod,
  };
}
