// Checks on the county boundary file used by the map (CCD-379).
// It is a simplified copy of the Tailte Éireann file in pipeline/data/boundaries/.
import { statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import boundaries from './countyBoundaries.json';
import { COUNTIES } from './counties';

// Every [longitude, latitude] pair in a shape, however deeply it is nested
function allPoints(coordinates) {
  return typeof coordinates[0] === 'number' ? [coordinates] : coordinates.flatMap(allPoints);
}

describe('county boundaries', () => {
  it('has one outline for each of the 26 counties, with the same slugs as the API', () => {
    const slugs = boundaries.features.map((feature) => feature.properties.slug).sort();
    expect(slugs).toEqual(COUNTIES.map((county) => county.slug).sort());
  });

  it('gives every outline a proper name', () => {
    boundaries.features.forEach((feature) => {
      const { name, slug } = feature.properties;
      expect(name.toLowerCase()).toBe(slug);
      expect(COUNTIES.find((county) => county.slug === slug).name).toBe(name);
    });
  });

  it('uses shapes the map can draw', () => {
    boundaries.features.forEach((feature) => {
      expect(['Polygon', 'MultiPolygon']).toContain(feature.geometry.type);
    });
  });

  it('is in longitude and latitude, inside Ireland', () => {
    boundaries.features.forEach((feature) => {
      allPoints(feature.geometry.coordinates).forEach(([longitude, latitude]) => {
        expect(longitude).toBeGreaterThan(-10.8);
        expect(longitude).toBeLessThan(-5.9);
        expect(latitude).toBeGreaterThan(51.3);
        expect(latitude).toBeLessThan(55.5);
      });
    });
  });

  it('stays small, so the home page loads quickly (the original file is 4.9 MB)', () => {
    const file = join(dirname(fileURLToPath(import.meta.url)), 'countyBoundaries.json');
    expect(statSync(file).size).toBeLessThan(150 * 1024);
  });
});
