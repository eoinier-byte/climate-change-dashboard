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
  const { fakeMap } = await import('./fakeLeafletMap');
  return {
    MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
    // When the style is a function (as in MapView), also show each county's fill colour, so tests can check it
    GeoJSON: ({ data, style }) => (
      <div data-testid="county-outlines" data-counties={data.features.length}>
        {typeof style === 'function' &&
          data.features.map((feature) => (
            <span key={feature.properties.slug} data-testid={`county-${feature.properties.slug}`} data-fill={style(feature).fillColor} />
          ))}
      </div>
    ),
    useMap: () => fakeMap,
  };
});
