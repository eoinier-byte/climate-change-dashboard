// Tests for the home page map helpers.
import { describe, expect, it } from 'vitest';
import { countyAverage, formatDegrees, valuesBySlug } from './homeMapData';

const answer = (values) => ({
  results: Object.entries(values).map(([slug, value]) => ({ county: { name: slug, slug }, value })),
});

describe('valuesBySlug', () => {
  it('turns the values the API sends as text into numbers', () => {
    expect(valuesBySlug(answer({ cork: '9.400', dublin: '10.250' }))).toEqual({ cork: 9.4, dublin: 10.25 });
  });

  it('leaves out counties without a usable value', () => {
    expect(valuesBySlug(answer({ cork: '9.4', dublin: null, kerry: '', mayo: 'abc', clare: undefined }))).toEqual({ cork: 9.4 });
  });

  it('gives nothing when there is no answer yet', () => {
    expect(valuesBySlug(null)).toEqual({});
    expect(valuesBySlug({})).toEqual({});
  });
});

describe('countyAverage', () => {
  it('is the mean of the county values', () => {
    expect(countyAverage(answer({ cork: '9', dublin: '10', kerry: '11' }))).toBe(10);
  });

  it('is null when no county has a value', () => {
    expect(countyAverage(answer({ cork: null }))).toBeNull();
    expect(countyAverage(null)).toBeNull();
  });
});

describe('formatDegrees', () => {
  it('writes one decimal and the unit, with a proper minus sign', () => {
    expect(formatDegrees(10.14)).toBe('10.1 °C');
    expect(formatDegrees(-0.5)).toBe('−0.5 °C');
  });
});
