import { useCallback, useEffect, useMemo } from 'react';
import { GeoJSON, MapContainer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import boundaries from '../data/countyBoundaries.json';
import { DEFAULT_PERIOD } from '../hooks/useCountyView';
import useMapData from '../hooks/useMapData';
import ErrorMessage from './ErrorMessage';
import Loading from './Loading';
import MapLegend from './MapLegend';
import { buildMapColours, NO_DATA_COLOUR } from './mapColours';
import '../styles/map-view.css';

// The map of the 26 counties (CCD-379). It draws the outlines and loads the value for every county
// from the API (CCD-380) with useMapData, showing the shared Loading and ErrorMessage on top of the map
// while it waits or if it fails. Each county is coloured by its value (CCD-381), with a legend underneath.
// Tooltips, clicks and the scenario controls are added by the later map stories (CCD-382 to CCD-384).
//
// Props: the choice to load. The defaults are the end-of-century temperature under RCP8.5; the
// scenario and period controls (CCD-383) will pass their own.

// The island of Ireland as [[south, west], [north, east]]. The map zooms to fit this,
// so it fills a phone and a desktop screen alike.
const IRELAND_BOUNDS = [
  [51.35, -10.75],
  [55.5, -5.9],
];

// Leaflet draws with SVG attributes, which cannot read CSS variables, so these are plain
// colours. The outline and the "no value" grey are neutral on purpose: green, amber and red are kept
// for the scenarios (the value colours are in mapColours.js).
const OUTLINE_STYLE = { color: '#4a5a53', weight: 1, fillColor: NO_DATA_COLOUR, fillOpacity: 1 };

// The counties on the map, to spot any that the API gave no value for
const COUNTY_SLUGS = boundaries.features.map((feature) => feature.properties.slug);

// Leaflet works out how far to zoom once, when the map is created, and never again, so a map
// whose box changes size (resizing the window, turning a phone sideways) ends up too small or
// cut off. This zooms to fit Ireland once the box is measured, and again whenever its size changes.
function FitToIreland() {
  const map = useMap();

  useEffect(() => {
    function fit() {
      map.invalidateSize();
      map.fitBounds(IRELAND_BOUNDS, { animate: false });
    }

    fit();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', fit);
      return () => window.removeEventListener('resize', fit);
    }
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
}

export default function MapView({ variable = 'temperature', scenario = 'rcp85', period = DEFAULT_PERIOD, season = 'annual' }) {
  const { data, loading, error, retry } = useMapData(variable, scenario, period, season);

  // The colours for these values; null until they arrive, so the counties start plain grey.
  // Leaflet only redraws when the style function changes, so this is rebuilt only with new data.
  const colours = useMemo(() => buildMapColours(data, COUNTY_SLUGS), [data]);
  const styleCounty = useCallback(
    (feature) => ({ ...OUTLINE_STYLE, fillColor: colours ? colours.colourFor(feature.properties.slug) : NO_DATA_COLOUR }),
    [colours],
  );

  return (
    <figure className="map-view">
      {/* The outlines are always drawn. Loading and errors sit on top of the map, so it never jumps. */}
      <div className="map-view__stage">
        <MapContainer
          className="map-view__map"
          bounds={IRELAND_BOUNDS}
          zoomSnap={0.25}
          minZoom={5}
          maxZoom={10}
          scrollWheelZoom={false}
          attributionControl={false}
        >
          <FitToIreland />
          <GeoJSON data={boundaries} style={styleCounty} />
        </MapContainer>
        {(loading || error) && (
          <div className="map-view__status">
            {error ? <ErrorMessage error={error} onRetry={retry} /> : <Loading message="Loading map data…" />}
          </div>
        )}
      </div>
      {/* The key. useMapData gives no data for a choice that is still loading, so it always matches the colours. */}
      {colours && <MapLegend choice={{ variable, scenario, period, season, unit: data.unit }} colours={colours} />}
      <figcaption className="map-view__credit">
        County boundaries &copy; Tailte &Eacute;ireann, licensed CC BY 4.0. Map drawn with Leaflet.
      </figcaption>
    </figure>
  );
}
