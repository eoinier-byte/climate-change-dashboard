// One map of Ireland for one scenario (home page). The 26 counties are SVG shapes coloured by their value.
// Hovering a county shows its name and value, clicking it opens its county page, and each county can be
// reached with the keyboard: Tab to it, Enter to open it.
//
// Props:
//   "scenario"      - 'rcp26', 'rcp45' or 'rcp85'
//   "name"          - the scenario's plain name, e.g. 'Middle path'
//   "rcp"           - the scenario's RCP name, e.g. 'RCP4.5'
//   "color"         - the scenario's colour, for the little square in the caption
//   "answers"       - what useMapData gave back for this scenario's three averages, in order (baseline,
//                     mid-century, end of century): [{ data, loading, error, retry }, ...]
//   "blend"         - which two averages the slider year is between: { lower, upper, fraction, nearest }
//                     (from periodBlend.js). The colours blend between the two; the numbers are the nearest one's.
//   "range"         - [min, max] of the scale shared by every map, or null for none
//   "onHover"       - called with the county slug that is under the mouse or focused, or null when none is
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { countyPath } from '../routes';
import ErrorMessage from './ErrorMessage';
import Loading from './Loading';
import { COUNTY_SHAPES, COUNTY_VIEW_BOX } from './countyShapes';
import { countyAverage, formatDegrees, valuesBySlug } from './homeMapData';
import { NO_DATA_COLOUR } from './mapColours';
import { mixColours, warmColour } from './warmRamp';
import '../styles/home-maps.css';

export default function MapTile({ name, rcp, color, answers, blend, range, onHover }) {
  const navigate = useNavigate();
  const stageRef = useRef(null);
  const [tip, setTip] = useState(null); // { slug, left, top } while a county is hovered or focused

  // The numbers shown (tooltip, labels, average) are the nearest average's. The colours blend the lower and
  // the upper average, which are the same one when the slider is exactly on a period's middle year.
  const { data } = answers[blend.nearest];
  const needed = [...new Set([blend.lower, blend.upper])].map((index) => answers[index]);
  const loading = needed.some((answer) => answer.loading);
  const error = needed.find((answer) => answer.error)?.error ?? null;
  const retry = () => needed.forEach((answer) => answer.error && answer.retry());
  const values = valuesBySlug(data);
  const lowerValues = valuesBySlug(answers[blend.lower].data);
  const upperValues = valuesBySlug(answers[blend.upper].data);
  const average = countyAverage(data);
  const min = range ? range[0] : Number(data?.min);
  const max = range ? range[1] : Number(data?.max);

  // A county's colour: its two nearest averages' colours, blended by how far along the slider is
  function fillFor(slug) {
    const from = lowerValues[slug];
    const to = upperValues[slug];
    if (from === undefined && to === undefined) return NO_DATA_COLOUR;
    if (from === undefined) return warmColour(to, min, max);
    if (to === undefined) return warmColour(from, min, max);
    return mixColours(warmColour(from, min, max), warmColour(to, min, max), blend.fraction);
  }

  const labelFor = (county) => {
    const value = values[county.slug];
    if (!data) return `${county.name}, ${rcp}`;
    return value === undefined ? `${county.name}, ${rcp}: no value` : `${county.name}, ${rcp}: ${formatDegrees(value)}`;
  };

  // Puts the tooltip above the point (x, y), measured from the top left of the map
  function showTip(slug, x, y) {
    setTip({ slug, left: x, top: y });
    onHover(slug);
  }

  function hideTip() {
    setTip(null);
    onHover(null);
  }

  function handleMove(event, slug) {
    const box = stageRef.current.getBoundingClientRect();
    showTip(slug, event.clientX - box.left, event.clientY - box.top);
  }

  // For the keyboard: the tooltip sits above the middle of the focused county
  function handleFocus(event, slug) {
    const box = stageRef.current.getBoundingClientRect();
    const shape = event.currentTarget.getBoundingClientRect();
    showTip(slug, shape.left + shape.width / 2 - box.left, shape.top - box.top);
  }

  const tipCounty = tip ? COUNTY_SHAPES.find((shape) => shape.slug === tip.slug) : null;

  return (
    <figure className="map-tile">
      <figcaption className="map-tile__caption">
        <span className="map-tile__swatch" style={{ backgroundColor: color }} aria-hidden="true" />
        {name} ({rcp})
        {average !== null && (
          <span className="map-tile__average" title="The mean of the 26 county values">
            county average {formatDegrees(average)}
          </span>
        )}
      </figcaption>

      <div className="map-tile__stage" ref={stageRef} onMouseLeave={hideTip}>
        <svg viewBox={COUNTY_VIEW_BOX} className="map-tile__svg" role="group" aria-label={`Map of Ireland: ${name} (${rcp})`}>
          {COUNTY_SHAPES.map((county) => {
            const fill = fillFor(county.slug);
            return (
              <path
                key={county.slug}
                d={county.d}
                className="map-tile__county"
                style={{ fill }}
                role="link"
                tabIndex={0}
                aria-label={`${labelFor(county)}, open county page`}
                onMouseMove={(event) => handleMove(event, county.slug)}
                onClick={() => navigate(countyPath(county.slug))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') navigate(countyPath(county.slug));
                }}
                onFocus={(event) => handleFocus(event, county.slug)}
                onBlur={hideTip}
              />
            );
          })}
        </svg>

        {tip && tipCounty && (
          <div className="map-tile__tip" style={{ left: tip.left, top: tip.top }} aria-hidden="true">
            <strong>{tipCounty.name}</strong>
            <span>{values[tip.slug] === undefined ? 'no value' : formatDegrees(values[tip.slug])}</span>
          </div>
        )}

        {/* Loading and errors sit on top of the outlines, so the map never jumps */}
        {(loading || error) && (
          <div className="map-tile__status">
            {error ? <ErrorMessage error={error} onRetry={retry} /> : <Loading message="Loading map data…" />}
          </div>
        )}
      </div>
    </figure>
  );
}
