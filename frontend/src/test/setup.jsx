// Runs before every test file (set in vite.config.js).
// Leaflet needs a real browser to measure and draw the map, which jsdom cannot do,
// so every test sees a simple stand-in for react-leaflet (CCD-379).
// The stand-in shows how many county outlines were given to it, and each county's fill colour, so tests can check that.
import { vi } from 'vitest';

// No test talks to the real network (CCD-380). A page that loads data without its own fake API,
// like the home page with its map, waits for an answer that never comes, so it stays on "Loading".
// Tests that need real answers replace services/api.js (vi.mock) or fetch (see api.test.js).
vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

vi.mock('react-leaflet', async () => {
  const { fakeLayers, fakeMap, makeFakeLayer } = await import('./fakeLeafletMap');
  const { useEffect, useRef } = await import('react');
  return {
    MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
    // When the style is a function (as in MapView), also show each county's fill colour, so tests can check it
    // It also gives each county a fake layer (onEachFeature, as Leaflet does) and puts its element on the
    // page, so tests can use the tooltips, clicks and keyboard (CCD-382)
    GeoJSON: function GeoJSON({ data, style, onEachFeature }) {
      const holder = useRef(null);
      useEffect(() => {
        if (!onEachFeature) return undefined;
        const container = holder.current; // copied here, so the cleanup below uses the same element
        fakeLayers.clear();
        data.features.forEach((feature) => {
          const layer = makeFakeLayer();
          onEachFeature(feature, layer);
          layer.fire('add'); // Leaflet fires this once the shape is on the map
          fakeLayers.set(feature.properties.slug, layer);
          container.appendChild(layer.element);
        });
        return () => {
          fakeLayers.clear();
          container.replaceChildren();
        };
      }, [data, onEachFeature]);

      return (
        <div data-testid="county-outlines" data-counties={data.features.length}>
          {typeof style === 'function' &&
            data.features.map((feature) => (
              <span key={feature.properties.slug} data-testid={`county-${feature.properties.slug}`} data-fill={style(feature).fillColor} />
            ))}
          <div ref={holder} />
        </div>
      );
    },
    useMap: () => fakeMap,
  };
});
