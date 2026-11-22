// The choices in the Compare section, kept in the URL so a shared link opens the same comparison.
//   mode     scenarios (one county, up to seven things: the baseline and each scenario at mid-century and at the
//            end of the century) or counties (two counties, one scenario).               Default: scenarios
//   county   the county, or the first county when comparing counties, as its slug.      Default: cork
//   county2  the second county, when comparing counties.                                Default: dublin
//   set      what to compare in "scenarios" mode, a comma list of base, 26-mid, 26-end, 45-mid, 45-end,
//            85-mid, 85-end.                                                  Default: base,26-end,45-end,85-end
//   rcp      the scenario, when comparing counties, as 26, 45 or 85.                    Default: 85
//   period   the period, when comparing counties: 2021-2050 or 2071-2100.               Default: 2071-2100
// e.g. /compare?county=kerry&set=base,85-mid,85-end   or   /compare?mode=counties&county=donegal&county2=kerry&rcp=45
// A choice that matches its default is left out. useExplorerView({ prefix: 'cmp_' }) writes the same choices
// under other names (cmp_mode, cmp_county, ...), which the home page uses because its maps already use rcp.
// The two counties are never the same: comparing a county with itself would only ever show no difference.
// Which season is highlighted on the scatterplot is not kept in the URL.
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ALL_SCENARIOS } from '../styles/scenarioColors';
import { DEFAULT_COMBOS, PERIOD_OF, combosToText, parseCombos } from '../components/explorerData';

export const MODES = ['scenarios', 'counties'];
export const DEFAULT_MODE = 'scenarios';
export const DEFAULT_COUNTY = 'cork';
export const DEFAULT_SECOND_COUNTY = 'dublin';
export const DEFAULT_SCENARIO = 'rcp85';
export const COUNTY_PERIODS = [PERIOD_OF.mid, PERIOD_OF.end];
export const DEFAULT_PERIOD = PERIOD_OF.end;
const DEFAULT_SET_TEXT = combosToText(DEFAULT_COMBOS);

const slugOf = (text, fallback) => (text ?? '').trim().toLowerCase() || fallback;

export default function useExplorerView({ prefix = '' } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const read = (name) => searchParams.get(prefix + name);

  const mode = MODES.includes(read('mode')) ? read('mode') : DEFAULT_MODE;
  const county = slugOf(read('county'), DEFAULT_COUNTY);
  let county2 = slugOf(read('county2'), DEFAULT_SECOND_COUNTY);
  if (county2 === county) county2 = county === DEFAULT_SECOND_COUNTY ? DEFAULT_COUNTY : DEFAULT_SECOND_COUNTY;
  const combos = parseCombos(read('set'));
  const scenario = ALL_SCENARIOS.includes(`rcp${read('rcp')?.trim()}`) ? `rcp${read('rcp').trim()}` : DEFAULT_SCENARIO;
  const period = COUNTY_PERIODS.includes(read('period')) ? read('period') : DEFAULT_PERIOD;

  // Writes choices into the URL, each as [value, default] (left out when it is the default). It starts from the
  // URL as it is now, so other choices are kept, and replace: true changes the current history entry, so Back
  // leaves the page rather than stepping through every choice.
  const update = useCallback(
    (changes) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(changes).forEach(([name, [value, defaultValue]]) => {
            if (value === defaultValue) next.delete(prefix + name);
            else next.set(prefix + name, value);
          });
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, prefix],
  );

  const writeCounties = (first, second) => update({ county: [first, DEFAULT_COUNTY], county2: [second, DEFAULT_SECOND_COUNTY] });

  return {
    mode,
    county,
    county2,
    combos,
    scenario,
    period,
    setMode: (value) => update({ mode: [value, DEFAULT_MODE] }),
    setCounty: (slug) => {
      if (mode !== 'counties') return update({ county: [slug, DEFAULT_COUNTY] });
      // Choosing the county that is the other one swaps them, so the two stay different
      return writeCounties(slug, slug === county2 ? county : county2);
    },
    setSecondCounty: (slug) => writeCounties(slug === county ? county2 : county, slug),
    // Ticks or unticks one thing to compare; at least one stays ticked
    toggleCombo: (key) => {
      const next = combos.includes(key) ? combos.filter((entry) => entry !== key) : [...combos, key];
      if (next.length > 0) update({ set: [combosToText(next), DEFAULT_SET_TEXT] });
    },
    setScenario: (value) => update({ rcp: [value.replace('rcp', ''), DEFAULT_SCENARIO.replace('rcp', '')] }),
    setPeriod: (value) => update({ period: [value, DEFAULT_PERIOD] }),
  };
}
