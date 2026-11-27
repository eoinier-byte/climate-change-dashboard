import { useEffect, useState } from 'react';
import { GeoJSON, ImageOverlay, MapContainer, Pane, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import boundaries from '../data/countyBoundaries.json';
import { getFlood } from '../services/api';
import { ALL_SCENARIOS, SCENARIO_LABELS } from '../styles/scenarioColors';
import ErrorMessage from './ErrorMessage';
import { levelIndexForRise, riseAboveToday } from './floodLevel';
import Loading from './Loading';
import '../styles/flood-map.css';

// The flood map on the Flooding page (CCD-377, story CCD-169).
// It loads one coastal county's flood layers from GET /api/flood/{slug}/ (CCD-360): one see-through
// PNG per sea level, from 0 to 2 m in 0.1 m steps. The level can be chosen two ways:
//   - "Pick a sea level": a slider from 0 to 2 m
//   - "Use a scenario and year": e.g. RCP4.5 in 2100, turned into a level with the sea-level
//     projections the page has already loaded (floodLevel.js explains how)
// The matching PNG is laid over the county, and a counter shows how much more land is under water than at 0 m.
//
// Why "more than at 0 m": the 0 m layer already shows some flooded land, mostly low ground and small
// errors in the elevation data (see docs/api.md, Flood maps). So the counter shows the change from it.
//
// Props: slug (e.g. 'cork'), countyName (e.g. 'Cork'), and seaLevel: the county's answer from
// GET /sea-level/{slug}/, or null while it is loading or if it failed (then only the slider can be used).

// Where the controls start: the slider at 0.5 m, and RCP4.5 in 2100 for the scenario option
const DEFAULT_LEVEL_M = 0.5;
const DEFAULT_SCENARIO = 'rcp45';
const DEFAULT_YEAR = 2100;

// Leaflet draws with SVG attributes, which cannot read CSS variables, so these are plain colours.
// The chosen county gets a dark outline; the others are pale, so the eye goes to the right place.
const SELECTED_STYLE = { color: '#1b2a24', weight: 2, fillColor: '#f3f5f4', fillOpacity: 1 };
const OTHER_STYLE = { color: '#c9d1cd', weight: 1, fillColor: '#f3f5f4', fillOpacity: 1 };

// Zooms the map to the flood layer's corners. Leaflet only does this once, when the map is created,
// so this runs again whenever the corners change.
function FitToBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    map.fitBounds(bounds, { animate: false });
  }, [map, bounds]);
  return null;
}

// 0.5 -> "0.5 m"
const formatLevel = (metres) => `${metres.toFixed(1)} m`;
// 25.4745 -> "25.5"
const formatKm2 = (value) =>
  value.toLocaleString('en-IE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function FloodMap({ slug, countyName, seaLevel = null }) {
  // The answer from the API: { slug, data } when it worked, or { slug, error } when it failed
  const [result, setResult] = useState(null);
  // Goes up by one each time Retry is pressed, which makes the effect below run again
  const [attempt, setAttempt] = useState(0);
  // Which level the slider is on (0 = 0 m, 1 = 0.1 m, ...). null means "not moved yet": use the default.
  const [levelIndex, setLevelIndex] = useState(null);
  // How the level is chosen: 'level' (the slider) or 'scenario' (a scenario and a year)
  const [mode, setMode] = useState('level');
  const [scenario, setScenario] = useState(DEFAULT_SCENARIO);
  const [year, setYear] = useState(DEFAULT_YEAR);

  // Load the county's flood layers whenever the county changes (or Retry is pressed)
  useEffect(() => {
    let ignore = false; // stops a late answer for an old county replacing the new one

    getFlood(slug)
      .then((data) => {
        if (!ignore) setResult({ slug, data });
      })
      .catch((error) => {
        if (!ignore) setResult({ slug, error });
      });

    return () => {
      ignore = true;
    };
  }, [slug, attempt]);

  function handleRetry() {
    setResult(null);
    setAttempt((count) => count + 1);
  }

  // Still waiting if there is no answer yet, or the answer is for a different county
  const loading = !result || result.slug !== slug;
  const data = loading ? null : result.data;

  // The projected rise above today for the chosen scenario and year, in cm (null without projections).
  // The scenario option only counts when there is a rise to use, e.g. not while a new county loads.
  const rise = seaLevel ? riseAboveToday(seaLevel, scenario, year) : null;
  const useScenario = mode === 'scenario' && rise !== null;
  // The years to choose from: every projection year after the first (2020, which counts as "today")
  const years = seaLevel ? seaLevel.years.slice(1) : [];

  // Work out the level to show and the numbers for the counter
  let level = null;
  let today = null;
  let index = 0;
  if (data) {
    const levels = data.levels;
    const defaultIndex = Math.max(0, levels.findIndex((item) => item.level_m === DEFAULT_LEVEL_M));
    const wanted = useScenario ? levelIndexForRise(rise, levels.length) : (levelIndex ?? defaultIndex);
    index = Math.min(wanted, levels.length - 1);
    level = levels[index];
    today = levels[0]; // the 0 m layer
  }

  // Back to the slider: start it where the scenario left the map, so the map does not jump
  function chooseSlider() {
    setLevelIndex(index);
    setMode('level');
  }

  return (
    <figure className="flood-map">
      <div className="flood-map__stage">
        {data ? (
          <MapContainer
            className="flood-map__map"
            bounds={data.bounds}
            zoomSnap={0.25}
            minZoom={6}
            maxZoom={12}
            scrollWheelZoom={false}
            attributionControl={false}
          >
            <FitToBounds bounds={data.bounds} />
            {/* key={slug}: Leaflet keeps the first style it is given, so draw the outlines again for a new county */}
            <GeoJSON
              key={slug}
              data={boundaries}
              style={(feature) => (feature.properties.slug === slug ? SELECTED_STYLE : OTHER_STYLE)}
            />
            {/* Its own pane above the county shapes (Leaflet's shapes are at 400), so the flood is always on top */}
            <Pane name="flood" style={{ zIndex: 450 }}>
              <ImageOverlay url={level.url} bounds={data.bounds} opacity={1} />
            </Pane>
          </MapContainer>
        ) : (
          <div className="flood-map__map" />
        )}
        {(loading || result.error) && (
          <div className="flood-map__status">
            {loading ? (
              <Loading message="Loading flood map…" />
            ) : (
              <ErrorMessage error={result.error} onRetry={handleRetry} />
            )}
          </div>
        )}
      </div>

      {data && (
        <div className="flood-map__controls">
          {/* How to choose the level. The scenario option needs the projections, so it waits for them. */}
          <fieldset className="flood-map__mode">
            <legend>Choose the flood level</legend>
            <label>
              <input type="radio" name="flood-mode" checked={!useScenario} onChange={chooseSlider} /> Pick a sea
              level
            </label>
            <label>
              <input
                type="radio"
                name="flood-mode"
                checked={useScenario}
                disabled={!seaLevel}
                onChange={() => setMode('scenario')}
              />{' '}
              Use a scenario and year
            </label>
          </fieldset>

          {useScenario ? (
            <div className="flood-map__scenario">
              <div className="flood-map__pick">
                <label htmlFor="flood-scenario">Scenario</label>
                <select id="flood-scenario" value={scenario} onChange={(event) => setScenario(event.target.value)}>
                  {ALL_SCENARIOS.map((name) => (
                    <option key={name} value={name}>
                      {SCENARIO_LABELS[name]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flood-map__pick">
                <label htmlFor="flood-year">Year</label>
                <select id="flood-year" value={year} onChange={(event) => setYear(Number(event.target.value))}>
                  {years.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <p className="flood-map__projection">
                {SCENARIO_LABELS[scenario]} in {year}: the sea around County {countyName} is projected to be about{' '}
                <strong>{Math.round(rise)} cm</strong> above today's level, so the map shows{' '}
                <strong>{formatLevel(level.level_m)}</strong>.
              </p>
            </div>
          ) : (
            <>
              <label htmlFor="flood-level" className="flood-map__label">
                Sea level rise: <strong>{formatLevel(level.level_m)}</strong>
              </label>
              <input
                id="flood-level"
                type="range"
                min={0}
                max={data.levels.length - 1}
                step={1}
                value={index}
                aria-valuetext={formatLevel(level.level_m)}
                onChange={(event) => setLevelIndex(Number(event.target.value))}
              />
              <div className="flood-map__scale" aria-hidden="true">
                <span>{formatLevel(data.levels[0].level_m)}</span>
                <span>{formatLevel(data.levels.at(-1).level_m)}</span>
              </div>
            </>
          )}

          {/* aria-live: screen readers read the new number when the level changes */}
          <p className="flood-map__counter" aria-live="polite">
            <strong>{formatKm2(level.flooded_area_km2 - today.flooded_area_km2)} km²</strong> more land under
            water in County {countyName} than at today's sea level
            <span className="flood-map__total">
              {' '}
              ({formatKm2(level.flooded_area_km2)} km² in total at {formatLevel(level.level_m)},{' '}
              {formatKm2(today.flooded_area_km2)} km² at 0 m)
            </span>
          </p>

          <p className="flood-map__note">
            {/* The backend's text ends with a pointer to our docs, which means nothing to visitors */}
            {data.model_limits.replace(/\s*See docs\/\S+ §\d+\.?$/, '')} Some low land already shows as
            flooded at 0 m because of small errors in the elevation data, so the counter shows the extra land
            compared with 0 m.
          </p>
        </div>
      )}

      <figcaption className="flood-map__credit">
        {data && <>Elevation data {data.attribution}. </>}
        County boundaries &copy; Tailte &Eacute;ireann, licensed CC BY 4.0. Map drawn with Leaflet.
      </figcaption>
    </figure>
  );
}