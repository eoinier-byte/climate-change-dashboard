// Runs before every test file (set in vite.config.js).
// Leaflet needs a real browser to measure and draw the map, which jsdom cannot do,
// so every test sees a simple stand-in for react-leaflet (CCD-379).
// The stand-in shows how many county outlines were given to it, so tests can check that.
import { vi } from 'vitest';

vi.mock('react-leaflet', async () => {
  const { fakeMap } = await import('./fakeLeafletMap');
  return {
    MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
    GeoJSON: ({ data }) => <div data-testid="county-outlines" data-counties={data.features.length} />,
    useMap: () => fakeMap,
  };
});
