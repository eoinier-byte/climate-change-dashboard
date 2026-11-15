// The key to the map colours (CCD-381): what is shown (variable, season, scenario, period, units)
// and which number range each colour stands for. The ranges are written out, so colour is not the only cue.
// Props:
//   "choice"  - { variable, scenario, period, season, unit } of the values on the map
//   "colours" - what buildMapColours (mapColours.js) gave back for those values
import { describeChoice } from './mapColours';

export default function MapLegend({ choice, colours }) {
  return (
    <div className="map-legend" role="group" aria-labelledby="map-legend-title">
      <p id="map-legend-title" className="map-legend__title">
        {describeChoice(choice)}
      </p>
      {colours.hasValues ? (
        <ol className="map-legend__bins">
          {colours.bins.map((bin) => (
            <li key={bin.label} className="map-legend__bin">
              <span className="map-legend__swatch" style={{ backgroundColor: bin.colour }} aria-hidden="true" />
              {bin.label}
            </li>
          ))}
        </ol>
      ) : (
        <p className="map-legend__note">There are no values for this choice.</p>
      )}
      {colours.hasValues && colours.missing > 0 && (
        <p className="map-legend__note">
          {colours.missing === 1 ? 'One county has' : `${colours.missing} counties have`} no value and{' '}
          {colours.missing === 1 ? 'is' : 'are'} shown in grey.
        </p>
      )}
    </div>
  );
}
