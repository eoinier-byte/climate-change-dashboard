// Tests for the county outlines drawn as SVG (home page maps).
import { describe, expect, it } from 'vitest';
import { buildShapes, COUNTY_SHAPES, COUNTY_VIEW_BOX } from './countyShapes';

describe('buildShapes', () => {
  const square = (lon, lat, size = 1) => [
    [
      [lon, lat],
      [lon + size, lat],
      [lon + size, lat + size],
      [lon, lat + size],
      [lon, lat],
    ],
  ];
  const features = {
    features: [
      { properties: { name: 'West', slug: 'west' }, geometry: { type: 'Polygon', coordinates: square(-10, 52) } },
      {
        properties: { name: 'East', slug: 'east' },
        geometry: { type: 'MultiPolygon', coordinates: [square(-8, 52), square(-7, 54)] },
      },
    ],
  };

  it('gives one path for each county, with its name and slug', () => {
    const { shapes } = buildShapes(features);
    expect(shapes.map(({ slug, name }) => [slug, name])).toEqual([
      ['west', 'West'],
      ['east', 'East'],
    ]);
  });

  it('closes every ring, and draws a county with two parts as two rings', () => {
    const { shapes } = buildShapes(features);
    expect(shapes[0].d.match(/M/g)).toHaveLength(1);
    expect(shapes[1].d.match(/M/g)).toHaveLength(2);
    expect(shapes[1].d.match(/Z/g)).toHaveLength(2);
  });

  it('puts north at the top: a county further north has smaller y numbers', () => {
    const { shapes } = buildShapes(features);
    const firstY = (d) => Number(d.slice(1).split('L')[0].split(' ')[1]);
    const second = buildShapes({ features: [features.features[1]] }).shapes[0];
    // In "East" the second part (54 degrees north) comes after the first (52 degrees north)
    const rings = second.d.split('Z').filter(Boolean);
    expect(firstY(rings[1])).toBeLessThan(firstY(rings[0]));
    expect(shapes).toHaveLength(2);
  });

  it('narrows east-west distances, because a degree of longitude is shorter than one of latitude here', () => {
    const { viewBox } = buildShapes({ features: [features.features[0]] });
    const [, , width, height] = viewBox.split(' ').map(Number);
    expect(width).toBeLessThan(height);
  });

  it('copes with no counties', () => {
    expect(buildShapes({ features: [] })).toEqual({ shapes: [], viewBox: '0 0 1 1' });
  });
});

describe('the 26 counties of Ireland', () => {
  it('has a shape for each county, with a unique slug', () => {
    expect(COUNTY_SHAPES).toHaveLength(26);
    expect(new Set(COUNTY_SHAPES.map((shape) => shape.slug)).size).toBe(26);
    expect(COUNTY_SHAPES.every((shape) => shape.d.startsWith('M') && shape.d.endsWith('Z'))).toBe(true);
  });

  it('has a view box that is taller than it is wide, like Ireland', () => {
    const [x, y, width, height] = COUNTY_VIEW_BOX.split(' ').map(Number);
    expect([x, y]).toEqual([0, 0]);
    expect(height).toBeGreaterThan(width);
  });
});
