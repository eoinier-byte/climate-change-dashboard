// The choices on the Compare page (CCD-207), kept in the URL so a shared link opens the same comparison:
//   county  which county, as its slug, e.g. kerry.                 Default: cork
//   a       the first scenario, as 26, 45 or 85.                   Default: 26
//   b       the second scenario, as 26, 45 or 85.                  Default: 85
//   period  which future period, e.g. 2021-2050.                   Default: 2071-2100
// e.g. /compare?county=kerry&a=45&b=85&period=2021-2050
// A setting that matches its default is left out of the URL. The two scenarios are never the same:
// comparing a scenario with itself would only ever show zero.
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ALL_SCENARIOS } from '../styles/scenarioColors';
import { DEFAULT_PERIOD, PERIODS } from './useCountyView';

export const DEFAULT_COUNTY = 'cork';
export const DEFAULT_FIRST = 'rcp26';
export const DEFAULT_SECOND = 'rcp85';

// "45" -> 'rcp45'; anything that is not one of the three scenarios -> the fallback
function parseScenario(text, fallback) {
  const scenario = `rcp${text}`;
  return ALL_SCENARIOS.includes(scenario) ? scenario : fallback;
}

const short = (scenario) => scenario.replace('rcp', '');

export default function useCompareView() {
  const [searchParams, setSearchParams] = useSearchParams();

  const county = (searchParams.get('county') ?? '').trim().toLowerCase() || DEFAULT_COUNTY;
  const period = PERIODS.includes(searchParams.get('period')) ? searchParams.get('period') : DEFAULT_PERIOD;

  const first = parseScenario(searchParams.get('a')?.trim(), DEFAULT_FIRST);
  let second = parseScenario(searchParams.get('b')?.trim(), DEFAULT_SECOND);
  // The same scenario twice (a typed or old link): keep the first and pick another for the second
  if (second === first) second = first === DEFAULT_SECOND ? DEFAULT_FIRST : DEFAULT_SECOND;

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

  const setCounty = (slug) => update({ county: [slug, DEFAULT_COUNTY] });
  const setPeriod = (value) => update({ period: [value, DEFAULT_PERIOD] });

  // Choosing the scenario that is already the other one swaps them, so the two stay different
  const writeScenarios = (nextFirst, nextSecond) =>
    update({ a: [short(nextFirst), short(DEFAULT_FIRST)], b: [short(nextSecond), short(DEFAULT_SECOND)] });
  const setFirst = (scenario) => writeScenarios(scenario, scenario === second ? first : second);
  const setSecond = (scenario) => writeScenarios(scenario === first ? second : first, scenario);

  return { county, first, second, period, setCounty, setFirst, setSecond, setPeriod };
}
