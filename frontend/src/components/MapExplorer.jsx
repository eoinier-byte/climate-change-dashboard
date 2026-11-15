// The home page map with its controls (CCD-383): the scenario switch, the period slider and the ▶ button
// sit above the map, and the map reloads whenever a choice changes.
//
// One colour scale for every choice: the lowest value is the coolest county in the baseline and the
// highest is the warmest county under RCP8.5 at the end of the century. Without it each map would be
// coloured between its own lowest and highest county, so switching scenario or pressing ▶ would only
// change the legend numbers and never make the map look warmer. The two extra requests are made once.
import { useMemo } from 'react';
import useMapData from '../hooks/useMapData';
import { PERIODS } from '../hooks/useCountyView';
import useMapView from '../hooks/useMapView';
import MapControls from './MapControls';
import { sharedRange } from './mapColours';
import MapView from './MapView';

const VARIABLE = 'temperature';
const SEASON = 'annual';
const BASELINE_PERIOD = '1976-2005';

export default function MapExplorer() {
  const view = useMapView();

  // The coolest and warmest of all the maps. Until both have arrived (or if one fails), the map uses its own range.
  const coolest = useMapData(VARIABLE, 'baseline', BASELINE_PERIOD, SEASON);
  const warmest = useMapData(VARIABLE, 'rcp85', PERIODS[PERIODS.length - 1], SEASON);
  const colourRange = useMemo(() => sharedRange([coolest.data, warmest.data]), [coolest.data, warmest.data]);

  return (
    <>
      <MapControls
        scenario={view.scenario}
        period={view.period}
        playing={view.playing}
        onScenarioChange={view.setScenario}
        onPeriodChange={view.setPeriod}
        onTogglePlay={view.togglePlay}
      />
      <MapView
        variable={VARIABLE}
        season={SEASON}
        scenario={view.scenario}
        period={view.period}
        colourRange={colourRange}
      />
    </>
  );
}
