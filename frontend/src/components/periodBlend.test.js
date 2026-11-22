import { describe, expect, it } from 'vitest';
import { YEAR_MAX, YEAR_MIN, blendAt, clampYear } from './periodBlend';

describe('clampYear', () => {
  it('keeps whole years on the slider', () => {
    expect(clampYear(2000.4)).toBe(2000);
    expect(clampYear(1950)).toBe(YEAR_MIN);
    expect(clampYear(2100)).toBe(YEAR_MAX);
  });
});

describe('blendAt', () => {
  it('is exactly one average at the middle year of each period', () => {
    expect(blendAt(1990)).toEqual({ lower: 0, upper: 0, fraction: 0, nearest: 0 });
    expect(blendAt(2035)).toEqual({ lower: 1, upper: 1, fraction: 0, nearest: 1 });
    expect(blendAt(2085)).toEqual({ lower: 2, upper: 2, fraction: 0, nearest: 2 });
  });

  it('is between the baseline and mid-century before 2035', () => {
    const at = blendAt(2012.5); // halfway from 1990 to 2035
    expect(at).toMatchObject({ lower: 0, upper: 1, fraction: 0.5 });
  });

  it('is between mid-century and the end of the century after 2035', () => {
    const at = blendAt(2060); // halfway from 2035 to 2085
    expect(at).toMatchObject({ lower: 1, upper: 2, fraction: 0.5 });
  });

  it('names the nearer average', () => {
    expect(blendAt(2000).nearest).toBe(0);
    expect(blendAt(2025).nearest).toBe(1);
    expect(blendAt(2050).nearest).toBe(1);
    expect(blendAt(2070).nearest).toBe(2);
  });
});
