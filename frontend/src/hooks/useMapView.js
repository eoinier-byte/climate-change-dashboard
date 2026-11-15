// The choices on the home page map (CCD-383): which emissions scenario, which period, and whether the
// ▶ button is stepping through the periods. The map itself (MapView) is told these as props.
//
// The scenario and period live in the URL (CCD-384), so a shared link opens the same map:
//   rcp   which scenario, as 26, 45 or 85.                      Default: 85
//   year  the last year of the period, 2050 or 2100.             Default: 2100
//   e.g. /?rcp=45&year=2050 is the middle path, mid-century (2021-2050).
// A setting that matches its default, or is not valid, is left out of the URL, so the plain / stays clean.
// Whether the ▶ button is running is not in the URL: a shared link opens paused.
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ALL_SCENARIOS, SCENARIO_LABELS } from '../styles/scenarioColors';
import { DEFAULT_PERIOD, PERIODS } from './useCountyView';

export const DEFAULT_SCENARIO = 'rcp85';

// How long the ▶ button stays on each period before moving on
export const STEP_MS = 2500;

// "45" -> 'rcp45'; anything that is not one of the three scenarios -> the default
export function parseScenario(text) {
  const scenario = `rcp${text}`;
  return ALL_SCENARIOS.includes(scenario) ? scenario : DEFAULT_SCENARIO;
}

// "2050" -> '2021-2050'; anything that is not the last year of a period -> the default
export function parseYear(text) {
  return PERIODS.find((period) => period.endsWith(`-${text}`)) ?? DEFAULT_PERIOD;
}

// '2021-2050' -> "2050" (the opposite of parseYear)
export function periodToYear(period) {
  return period.slice(-4);
}

// Plain-language names for the scenarios, with the RCP name for people who know it
const PLAIN_NAMES = {
  rcp26: 'If the world cuts emissions',
  rcp45: 'Middle path',
  rcp85: 'If nothing is done',
};
export const MAP_SCENARIOS = ALL_SCENARIOS.map((value) => ({
  value,
  plain: PLAIN_NAMES[value],
  rcp: SCENARIO_LABELS[value],
}));

// Plain-language names for the periods (the same ones as the county page filter)
export const PERIOD_NAMES = {
  '2021-2050': 'Mid-century',
  '2071-2100': 'End of century',
};

export default function useMapView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [playing, setPlaying] = useState(false);

  const scenario = parseScenario(searchParams.get('rcp')?.trim());
  const period = parseYear(searchParams.get('year')?.trim());

  // Writes one setting into the URL, or removes it when it is the default. It starts from the URL as it
  // is right now, so other settings are kept. replace: true changes the current history entry instead of
  // adding one, so Back leaves the page rather than stepping through every slider move.
  const updateParam = useCallback(
    (name, value, defaultValue) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value === defaultValue) next.delete(name);
          else next.set(name, value);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setScenario = useCallback(
    (value) => updateParam('rcp', value.replace('rcp', ''), DEFAULT_SCENARIO.replace('rcp', '')),
    [updateParam],
  );
  const setPeriodValue = useCallback(
    (value) => updateParam('year', periodToYear(value), periodToYear(DEFAULT_PERIOD)),
    [updateParam],
  );

  // While playing, wait a moment, then move to the next period. Reaching the last one stops it.
  useEffect(() => {
    if (!playing) return undefined;
    const next = PERIODS.indexOf(period) + 1;
    const timer = setTimeout(() => {
      if (next < PERIODS.length) setPeriodValue(PERIODS[next]);
      if (next >= PERIODS.length - 1) setPlaying(false);
    }, STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, period, setPeriodValue]);

  // Choosing a period by hand stops the ▶ button, so it does not move the map under the person's hand
  function setPeriod(next) {
    setPlaying(false);
    setPeriodValue(next);
  }

  // ▶ starts from the current period, or from the first one if the last is showing
  function togglePlay() {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (period === PERIODS[PERIODS.length - 1]) setPeriodValue(PERIODS[0]);
    setPlaying(true);
  }

  return { scenario, period, playing, setScenario, setPeriod, togglePlay };
}
