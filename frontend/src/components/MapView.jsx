import { useEffect } from 'react';
import { GeoJSON, MapContainer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import boundaries from '../data/countyBoundaries.json';
import { DEFAULT_PERIOD } from '../hooks/useCountyView';
import useMapData from '../hooks/useMapData';
import ErrorMessage from './ErrorMessage';
import Loading from './Loading';
import '../styles/map-view.css';

// The map of the 26 counties (CCD-379). It draws the outlines and loads the value for every county
// from the API (CCD-380) with useMapData, showing the shared Loading and ErrorMessage on top of the map
// while it waits or if it fails. Colours, tooltips and the scenario controls are added by the later
// map stories (CCD-381 to CCD-384), which will use that data.
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
// colours. They are neutral on purpose: green, amber and red are kept for the scenarios.
const OUTLINE_STYLE = { color: '#4a5a53', weight: 1, fillColor: '#dfe6e2', fillOpacity: 1 };

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
  // Only the loading and error state is used here for now; the values are coloured in by CCD-381
  const { loading, error, retry } = useMapData(variable, scenario, period, season);

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
          <GeoJSON data={boundaries} style={OUTLINE_STYLE} />
        </MapContainer>
        {(loading || error) && (
          <div className="map-view__status">
            {error ? <ErrorMessage error={error} onRetry={retry} /> : <Loading message="Loading map data…" />}
          </div>
        )}
      </div>
      <figcaption className="map-view__credit">
        County boundaries &copy; Tailte &Eacute;ireann, licensed CC BY 4.0. Map drawn with Leaflet.
      </figcaption>
    </figure>
  );
}
