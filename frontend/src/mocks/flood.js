// Example answer for GET /api/flood/{slug}/ (CCD-360, CCD-377), used when VITE_USE_MOCKS=true.
// These are Cork's REAL flood layers (backend/static/flood/cork/index.json, from Artur's flood engine).
// The 21 PNG images are copied into frontend/public/mock-flood/cork/, so the map works without the backend.
// Every other coastal county reuses Cork's layers with its own slug, like the other mocks.

// Flooded land in Cork in km², for sea levels 0.0, 0.1, 0.2 ... 2.0 m (21 values)
const CORK_AREAS_KM2 = [
  25.4745, 26.9892, 27.9936, 29.1114, 31.3794, 33.8418, 35.0649, 37.7703, 39.0906, 39.9492, 41.0589,
  41.9094, 42.849, 43.6509, 44.631, 46.7775, 47.8629, 48.7296, 49.9365, 50.9247, 52.3017,
];

// One cell of the elevation grid is 90 m × 90 m = 0.0081 km²
const CELL_KM2 = 0.0081;

export function mockFlood(slug) {
  return {
    slug,
    // [[south, west], [north, east]]: the corners of every PNG, in latitude and longitude
    bounds: [
      [51.40966213268661, -10.276807058529297],
      [52.39075056918082, -7.839974421834784],
    ],
    cell_size_m: 90.0,
    levels: CORK_AREAS_KM2.map((area, index) => {
      const cm = String(index * 10).padStart(3, '0'); // level 4 -> "040"
      return {
        level_m: index / 10,
        url: `/mock-flood/cork/level_${cm}.png`,
        flooded_cells: Math.round(area / CELL_KM2),
        flooded_area_km2: area,
      };
    }),
    attribution:
      'produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved',
    model_limits:
      "Indicative only: still-water 'bathtub' model with a connectivity check. No tides, storm surges or flood defences. See docs/flood-engine.md §7.",
  };
}