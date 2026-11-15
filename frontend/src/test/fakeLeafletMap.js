// A stand-in for the Leaflet map object, used by the react-leaflet stand-in in setup.jsx.
// Tests can check what the app asked the map to do, e.g. expect(fakeMap.fitBounds).toHaveBeenCalled().
import { vi } from 'vitest';

export const fakeMap = {
  invalidateSize: vi.fn(),
  fitBounds: vi.fn(),
  getContainer: () => document.createElement('div'),
};
