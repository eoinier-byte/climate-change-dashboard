// Tests for the climate analogue helpers (CCD-151, CCD-373).
import { describe, expect, it } from 'vitest';
import { comparisonRows, pickScenario, similarityPercent, similarityWord } from './analogueData';
import { analogueRows } from '../test/analogueRows';

describe('pickScenario', () => {
  it('uses the highest-emissions ticked scenario', () => {
    expect(pickScenario(['rcp26', 'rcp45'])).toBe('rcp45');
    expect(pickScenario(['rcp26', 'rcp85'])).toBe('rcp85');
    expect(pickScenario(['rcp26'])).toBe('rcp26');
  });

  it('falls back to RCP8.5 when nothing is ticked', () => {
    expect(pickScenario([])).toBe('rcp85');
  });
});

describe('similarityWord', () => {
  it('turns the similarity score into High, Moderate or Low', () => {
    expect(similarityWord('0.812')).toBe('High');
    expect(similarityWord('0.75')).toBe('High');
    expect(similarityWord('0.745')).toBe('Moderate');
    expect(similarityWord('0.5')).toBe('Moderate');
    expect(similarityWord('0.3')).toBe('Low');
  });
});

describe('similarityPercent', () => {
  it('gives how full the bar is, from 0 to 100', () => {
    expect(similarityPercent('0.812')).toBe(81);
    expect(similarityPercent(1.5)).toBe(100);
    expect(similarityPercent(-1)).toBe(0);
    expect(similarityPercent('not a number')).toBe(0);
  });
});

describe('comparisonRows', () => {
  it("compares the county's projected climate with the city's climate today", () => {
    expect(comparisonRows(analogueRows[0])).toEqual([
      { label: 'Summer temperature', county: '16.0 °C', city: '16.2 °C', difference: '+0.2 °C' },
      { label: 'Winter temperature', county: '7.1 °C', city: '7.3 °C', difference: '+0.2 °C' },
      { label: 'Rainfall per year', county: '1,352 mm', city: '1,210 mm', difference: '-142 mm' },
    ]);
  });
});