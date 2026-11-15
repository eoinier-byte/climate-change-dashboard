// The choices on the home page map (CCD-383): which emissions scenario, which period, and whether the
// ▶ button is stepping through the periods. The map itself (MapView) is told these as props.
// Kept in one hook so CCD-384 can move scenario and period into the URL without touching the screen.
import { useEffect, useState } from 'react';
import { ALL_SCENARIOS, SCENARIO_LABELS } from '../styles/scenarioColors';
import { DEFAULT_PERIOD, PERIODS } from './useCountyView';

export const DEFAULT_SCENARIO = 'rcp85';

// How long the ▶ button stays on each period before moving on
export const STEP_MS = 2500;

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
  const [scenario, setScenario] = useState(DEFAULT_SCENARIO);
  const [period, setPeriodValue] = useState(DEFAULT_PERIOD);
  const [playing, setPlaying] = useState(false);

  // While playing, wait a moment, then move to the next period. Reaching the last one stops it.
  useEffect(() => {
    if (!playing) return undefined;
    const next = PERIODS.indexOf(period) + 1;
    const timer = setTimeout(() => {
      if (next < PERIODS.length) setPeriodValue(PERIODS[next]);
      if (next >= PERIODS.length - 1) setPlaying(false);
    }, STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, period]);

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
