// Tests for turning a sea-level projection into a flood map level (CCD-377).
// Cork's real projections (mocks/seaLevel.js): RCP4.5 is 9.594 cm in 2020 and 52.676 cm in 2100.
import { describe, expect, it } from 'vitest';
import { levelIndexForRise, riseAboveToday } from './floodLevel';
import { mockSeaLevelCork } from '../mocks/seaLevel';

describe('riseAboveToday', () => {
  it('is the projection for the year minus the 2020 projection, in cm', () => {
    expect(riseAboveToday(mockSeaLevelCork, 'rcp45', 2100)).toBeCloseTo(43.082); // 52.676 - 9.594
    expect(riseAboveToday(mockSeaLevelCork, 'rcp85', 2050)).toBeCloseTo(18.294); // 28.634 - 10.340
  });

  it('is 0 for 2020, which counts as today', () => {
    expect(riseAboveToday(mockSeaLevelCork, 'rcp26', 2020)).toBe(0);
  });

  it('is null for a missing scenario, a missing year or no projections', () => {
    expect(riseAboveToday(mockSeaLevelCork, 'rcp60', 2100)).toBeNull();
    expect(riseAboveToday(mockSeaLevelCork, 'rcp45', 2075)).toBeNull();
    expect(riseAboveToday(null, 'rcp45', 2100)).toBeNull();
  });
});

describe('levelIndexForRise', () => {
  it('picks the nearest 0.1 m step', () => {
    expect(levelIndexForRise(43.082, 21)).toBe(4); // 0.4 m
    expect(levelIndexForRise(65.064, 21)).toBe(7); // 0.7 m
    expect(levelIndexForRise(18.294, 21)).toBe(2); // 0.2 m
  });

  it('never goes below 0 m or above the top level', () => {
    expect(levelIndexForRise(-5, 21)).toBe(0);
    expect(levelIndexForRise(350, 21)).toBe(20); // 2 m is the highest layer
  });
});