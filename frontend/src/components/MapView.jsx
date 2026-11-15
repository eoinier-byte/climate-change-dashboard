import { useEffect } from 'react';
import { GeoJSON, MapContainer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import boundaries from '../data/countyBoundaries.json';
import '../styles/map-view.css';

// The map of the 26 counties (CCD-379). It only draws the outlines; colours, tooltips and
// the scenario controls are added by the later map stories (CCD-381 to CCD-384).

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

export default function MapView() {
  return (
    <figure className="map-view">
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
      <figcaption className="map-view__credit">
        County boundaries &copy; Tailte &Eacute;ireann, licensed CC BY 4.0. Map drawn with Leaflet.
      </figcaption>
    </figure>
  );
}
