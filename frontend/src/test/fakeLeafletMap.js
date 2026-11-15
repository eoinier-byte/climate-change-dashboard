// A stand-in for the Leaflet map object, used by the react-leaflet stand-in in setup.jsx.
// Tests can check what the app asked the map to do, e.g. expect(fakeMap.fitBounds).toHaveBeenCalled().
import { vi } from 'vitest';

export const fakeMap = {
  invalidateSize: vi.fn(),
  fitBounds: vi.fn(),
  getContainer: () => document.createElement('div'),
};

// Stand-ins for the county shapes Leaflet draws, so tests can hover, click and Tab to a county (CCD-382).
// setup.jsx makes one fake layer per county and lists it here by slug, e.g. fakeLayers.get('cork').
export const fakeLayers = new Map();

export function makeFakeLayer() {
  const handlers = {};
  // Leaflet draws each county as an SVG shape; a plain element stands in for it
  const element = document.createElement('div');
  const layer = {
    element,
    handlers,
    tooltip: null, // { content, options } once the app has called bindTooltip
    bindTooltip: vi.fn((content, options) => {
      layer.tooltip = { content, options };
      return layer;
    }),
    openTooltip: vi.fn(),
    closeTooltip: vi.fn(),
    bringToFront: vi.fn(),
    getElement: () => element,
    on: vi.fn((events) => {
      Object.assign(handlers, events);
      return layer;
    }),
    // Pretend Leaflet fired an event, e.g. layer.fire('click')
    fire: (name) => handlers[name]?.({ target: layer }),
  };
  return layer;
}
