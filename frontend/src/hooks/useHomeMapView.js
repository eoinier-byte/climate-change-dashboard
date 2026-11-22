// The choices on the home page maps: which scenarios are drawn side by side, which year the maps show,
// and whether the ▶ button is moving the slider on. They live in the URL, so a shared link opens the same maps:
//   rcp   the scenarios drawn, as a comma list of 26, 45, 85, or "none".  Default: all three
//         e.g. ?rcp=45 (only the middle path) or ?rcp=26,85
//   year  the year on the slider, 1990 to 2085.                           Default: 2085
//         e.g. /?rcp=45&year=2035 is the middle path, mid-century.
// The data is three 30-year averages (see components/periodBlend.js): 1976-2005 sits at 1990, 2021-2050 at
// 2035 and 2071-2100 at 2085, and the years between blend the colours of the two nearest.
// A setting that matches its default, or is not valid, is left out of the URL, so the plain / stays clean.
// The year is kept here as you move the slider and written to the URL a moment after you stop, so dragging
// does not rewrite the address on every pixel. Whether ▶ is running is not in the URL: a shared link opens paused.
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ALL_SCENARIOS } from '../styles/scenarioColors';
import { parseScenarios, scenariosToText } from './useCountyView';
import { YEAR_MAX, YEAR_MIN, SNAPSHOT_YEARS, blendAt, clampYear } from '../components/periodBlend';

// The three periods the maps are made from, from the past to the end of the century. year is the middle of
// the period's 30 years, which is where it sits on the slider.
export const HOME_PERIODS = [
  { period: '1976-2005', year: SNAPSHOT_YEARS[0], name: 'Baseline' },
  { period: '2021-2050', year: SNAPSHOT_YEARS[1], name: 'Mid-century' },
  { period: '2071-2100', year: SNAPSHOT_YEARS[2], name: 'End of century' },
];
export const DEFAULT_HOME_YEAR = YEAR_MAX;
export const DEFAULT_HOME_PERIOD = HOME_PERIODS[2].period;
export const PLAY_MS = 8000; // how long ▶ takes to run from 1990 to 2085
const FRAME_MS = 50;
const URL_DELAY_MS = 250;

// "26,85" -> ['rcp26', 'rcp85']; "none" -> []; nothing or nonsense -> all three
export function parseHomeScenarios(text) {
  if (text?.trim() === 'none') return [];
  return parseScenarios(text);
}

// The opposite of parseHomeScenarios
export function homeScenariosToText(scenarios) {
  return scenarios.length === 0 ? 'none' : scenariosToText(scenarios);
}

// "2035" -> 2035; anything that is not a whole year from 1990 to 2085 -> the default
export function parseHomeYear(text) {
  if (!/^\d{4}$/.test(text ?? '')) return DEFAULT_HOME_YEAR;
  const year = Number(text);
  return year >= YEAR_MIN && year <= YEAR_MAX ? year : DEFAULT_HOME_YEAR;
}

export default function useHomeMapView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [playing, setPlaying] = useState(false);

  const scenarios = parseHomeScenarios(searchParams.get('rcp'));
  const urlYear = parseHomeYear(searchParams.get('year')?.trim());
  const [year, setYearState] = useState(urlYear);
  const period = HOME_PERIODS[blendAt(year).nearest].period; // the average whose numbers are shown
  // ▶ is running until the end of the slider is reached, so it stops by itself without a state change in an effect
  const running = playing && year < YEAR_MAX;

  // Writes one setting into the URL, or removes it when it is the default. It starts from the URL as it is
  // right now, so other settings are kept. replace: true changes the current history entry instead of adding
  // one, so Back leaves the page rather than stepping through every tick.
  const updateParam = useCallback(
    (name, value, defaultValue) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (String(value) === String(defaultValue)) next.delete(name);
          else next.set(name, value);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setScenarios = useCallback(
    (list) => updateParam('rcp', homeScenariosToText(list), scenariosToText(ALL_SCENARIOS)),
    [updateParam],
  );

  // Ticks or unticks one scenario. The maps always stay in the order RCP2.6, RCP4.5, RCP8.5.
  const toggleScenario = useCallback(
    (scenario) => {
      const next = scenarios.includes(scenario)
        ? scenarios.filter((entry) => entry !== scenario)
        : ALL_SCENARIOS.filter((entry) => entry === scenario || scenarios.includes(entry));
      setScenarios(next);
    },
    [scenarios, setScenarios],
  );

  // A moment after the year stops changing (and not while ▶ is running), write it into the URL
  useEffect(() => {
    const whole = Math.round(year);
    if (running || whole === urlYear) return undefined;
    const timer = setTimeout(() => updateParam('year', whole, DEFAULT_HOME_YEAR), URL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [running, year, urlYear, updateParam]);

  // While playing, move the year on a little every frame. Reaching 2085 stops it.
  useEffect(() => {
    if (!running) return undefined;
    const step = ((YEAR_MAX - YEAR_MIN) / PLAY_MS) * FRAME_MS;
    const timer = setInterval(() => setYearState((current) => Math.min(YEAR_MAX, current + step)), FRAME_MS);
    return () => clearInterval(timer);
  }, [running]);

  // Moving the slider by hand stops ▶, so it does not fight the person's hand
  const setYear = useCallback((value) => {
    setPlaying(false);
    setYearState(clampYear(value));
  }, []);

  // Jumps to the middle year of a period (for the Baseline, Mid-century and End of century buttons)
  const setPeriod = useCallback(
    (value) => {
      const entry = HOME_PERIODS.find((item) => item.period === value);
      if (entry) setYear(entry.year);
    },
    [setYear],
  );

  // ▶ starts from the year showing, or from 1990 if the end is showing
  function togglePlay() {
    if (running) {
      setPlaying(false);
      return;
    }
    if (year >= YEAR_MAX) setYearState(YEAR_MIN);
    setPlaying(true);
  }

  return {
    scenarios,
    year: Math.round(year),
    yearExact: year, // not rounded, so the colours blend smoothly while ▶ runs
    period,
    playing: running,
    setScenarios,
    toggleScenario,
    showAll: () => setScenarios(ALL_SCENARIOS),
    setYear,
    setPeriod,
    togglePlay,
  };
}
