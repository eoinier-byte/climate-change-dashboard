// The 26 county outlines as SVG paths, for the maps on the home page (see MapTile.jsx).
// The outlines come from data/countyBoundaries.json (longitude and latitude). No React here, so it is easy to test.
//
// Longitude and latitude cannot be drawn as x and y directly: a degree of longitude is shorter than a
// degree of latitude in Ireland, so the map would look too wide. x is scaled by the cosine of the middle
// latitude to correct for that, and y is flipped because SVG counts downwards.
import boundaries from '../data/countyBoundaries.json';

const SCALE = 100; // SVG units per degree of latitude. Only sets the size of the numbers, not the look.
const PADDING = 2;

// The rings of one feature as a list of rings, whether it is a Polygon or a MultiPolygon
function ringsOf(geometry) {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}

// features: a GeoJSON FeatureCollection with properties { name, slug }.
// Returns { shapes: [{ slug, name, d }], viewBox: "minX minY width height" }.
export function buildShapes(featureCollection) {
  const features = featureCollection.features;
  const points = features.flatMap((feature) => ringsOf(feature.geometry).flat());
  if (points.length === 0) return { shapes: [], viewBox: '0 0 1 1' };

  const lats = points.map(([, lat]) => lat);
  const lons = points.map(([lon]) => lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const squash = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);

  const x = (lon) => (lon - minLon) * squash * SCALE + PADDING;
  const y = (lat) => (maxLat - lat) * SCALE + PADDING;
  const round = (n) => Math.round(n * 10) / 10;

  const shapes = features.map((feature) => {
    const d = ringsOf(feature.geometry)
      .map((ring) => `M${ring.map(([lon, lat]) => `${round(x(lon))} ${round(y(lat))}`).join('L')}Z`)
      .join('');
    return { slug: feature.properties.slug, name: feature.properties.name, d };
  });

  const width = round((maxLon - minLon) * squash * SCALE + PADDING * 2);
  const height = round((maxLat - minLat) * SCALE + PADDING * 2);
  return { shapes, viewBox: `0 0 ${width} ${height}` };
}

// Built once, when the file is first loaded
export const { shapes: COUNTY_SHAPES, viewBox: COUNTY_VIEW_BOX } = buildShapes(boundaries);
