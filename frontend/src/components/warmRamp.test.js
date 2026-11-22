// Tests for the map colours: pale orange for the coolest value to dark red for the warmest.
import { describe, expect, it } from 'vitest';
import { legendRange, WARM_GRADIENT, WARM_RAMP, warmColour } from './warmRamp';

describe('warmColour', () => {
  it('gives the first colour for the lowest value and the last for the highest', () => {
    expect(warmColour(8.5, 8.5, 13)).toBe(WARM_RAMP[0]);
    expect(warmColour(13, 8.5, 13)).toBe(WARM_RAMP[WARM_RAMP.length - 1]);
  });

  it('gives the nearest end colour for a value outside the scale', () => {
    expect(warmColour(5, 8.5, 13)).toBe(WARM_RAMP[0]);
    expect(warmColour(20, 8.5, 13)).toBe(WARM_RAMP[WARM_RAMP.length - 1]);
  });

  it('gives a colour between two steps for a value between them', () => {
    // A scale of 0 to 5 has a step for each whole number, so 2.5 is half way from the 3rd colour to the 4th
    const colour = warmColour(2.5, 0, 5);
    expect(colour).toMatch(/^#[0-9a-f]{6}$/);
    expect(colour).not.toBe(WARM_RAMP[2]);
    expect(colour).not.toBe(WARM_RAMP[3]);
  });

  it('gets darker as the value rises', () => {
    const brightness = (hex) => [1, 3, 5].reduce((sum, start) => sum + parseInt(hex.slice(start, start + 2), 16), 0);
    const values = [8.5, 9.5, 10.5, 11.5, 12.5, 13];
    const levels = values.map((value) => brightness(warmColour(value, 8.5, 13)));
    expect([...levels].sort((a, b) => b - a)).toEqual(levels);
  });

  it('gives the first colour when there is no usable scale or value', () => {
    expect(warmColour(10, 5, 5)).toBe(WARM_RAMP[0]);
    expect(warmColour(NaN, 5, 10)).toBe(WARM_RAMP[0]);
    expect(warmColour(10, NaN, 10)).toBe(WARM_RAMP[0]);
  });
});

describe('WARM_GRADIENT', () => {
  it('lists every colour of the ramp, from left to right', () => {
    expect(WARM_GRADIENT.startsWith('linear-gradient(to right')).toBe(true);
    WARM_RAMP.forEach((colour) => expect(WARM_GRADIENT).toContain(colour));
  });
});

describe('legendRange', () => {
  it('rounds the ends out to the nearest half degree', () => {
    expect(legendRange([8.62, 12.71])).toEqual([8.5, 13]);
    expect(legendRange([9, 12])).toEqual([9, 12]);
  });

  it('gives null when there is no usable range', () => {
    expect(legendRange(null)).toBeNull();
    expect(legendRange([10, 10])).toBeNull();
    expect(legendRange([NaN, 12])).toBeNull();
  });
});

describe('mixColours', () => {
  it('gives the first colour at 0, the second at 1 and the middle halfway', async () => {
    const { mixColours } = await import('./warmRamp');
    expect(mixColours('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixColours('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixColours('#000000', '#fe0000', 0.5)).toBe('#7f0000');
  });
});
