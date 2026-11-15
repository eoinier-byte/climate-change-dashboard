// Tests for the map colours and legend wording (CCD-381). No browser needed: plain functions.
import { describe, expect, it } from 'vitest';
import {
  buildMapColours,
  describeChoice,
  formatValue,
  NO_DATA_COLOUR,
  PRECIPITATION_RAMP,
  RAMPS,
  TEMPERATURE_RAMP,
} from './mapColours';

// A short answer in the shape of GET /api/map/. "values" is { slug: number }.
function answerWith(values, extra = {}) {
  const numbers = Object.values(values);
  return {
    variable: 'temperature',
    unit: 'degC',
    min: Math.min(...numbers).toFixed(3),
    max: Math.max(...numbers).toFixed(3),
    results: Object.entries(values).map(([slug, value]) => ({
      county: { name: slug, slug, has_coastline: true },
      value: value === null ? null : value.toFixed(3),
      unit: 'degC',
    })),
    ...extra,
  };
}

const SLUGS = ['carlow', 'cork', 'dublin', 'donegal'];

// Red, green and blue parts (0 to 255) of a colour like '#4575b4'
const channels = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));

describe('colour ramps', () => {
  it.each(Object.entries(RAMPS))('%s has 7 different colours, written as #rrggbb', (name, ramp) => {
    expect(ramp).toHaveLength(7);
    expect(new Set(ramp).size).toBe(7);
    ramp.forEach((colour) => expect(colour).toMatch(/^#[0-9a-f]{6}$/));
  });

  it('runs from cooler (blue) to warmer (red) for temperature', () => {
    const [coolRed, , coolBlue] = channels(TEMPERATURE_RAMP[0]);
    const [warmRed, , warmBlue] = channels(TEMPERATURE_RAMP[6]);
    expect(coolBlue).toBeGreaterThan(coolRed);
    expect(warmRed).toBeGreaterThan(warmBlue);
  });

  it('runs from pale (dry) to dark (wet) for rainfall', () => {
    const brightness = (hex) => channels(hex).reduce((sum, part) => sum + part, 0);
    for (let step = 1; step < PRECIPITATION_RAMP.length; step += 1) {
      expect(brightness(PRECIPITATION_RAMP[step])).toBeLessThan(brightness(PRECIPITATION_RAMP[step - 1]));
    }
  });

  it('keeps the scenario colours (green, amber, red) out of the rainfall ramp', () => {
    expect(PRECIPITATION_RAMP).not.toContain('#2e7d32');
    expect(PRECIPITATION_RAMP).not.toContain('#b45309');
    expect(PRECIPITATION_RAMP).not.toContain('#c62828');
  });
});

describe('buildMapColours', () => {
  it('gives nothing until the answer has arrived', () => {
    expect(buildMapColours(null, SLUGS)).toBeNull();
    expect(buildMapColours(undefined, SLUGS)).toBeNull();
  });

  it('gives the lowest county the first colour, the highest the last, and one halfway the middle', () => {
    const colours = buildMapColours(answerWith({ carlow: 10, cork: 11, dublin: 12 }), SLUGS);
    expect(colours.colourFor('carlow')).toBe(TEMPERATURE_RAMP[0]);
    expect(colours.colourFor('cork')).toBe(TEMPERATURE_RAMP[3]);
    expect(colours.colourFor('dublin')).toBe(TEMPERATURE_RAMP[6]);
  });

  it('puts counties in the same step in the same colour', () => {
    const colours = buildMapColours(answerWith({ carlow: 10, cork: 10.1, dublin: 12 }), SLUGS);
    expect(colours.colourFor('cork')).toBe(colours.colourFor('carlow'));
  });

  it('reads values the API sends as text', () => {
    const answer = answerWith({ carlow: 9.4, dublin: 10.6 });
    expect(typeof answer.results[0].value).toBe('string');
    expect(buildMapColours(answer, SLUGS).colourFor('dublin')).toBe(TEMPERATURE_RAMP[6]);
  });

  it('uses the lowest and highest the API gives, so colours stay the same across a choice', () => {
    const answer = answerWith({ carlow: 10, dublin: 10 }, { min: '0.000', max: '20.000' });
    expect(buildMapColours(answer, SLUGS).colourFor('carlow')).toBe(TEMPERATURE_RAMP[3]);
  });

  it('works out the lowest and highest from the counties when the API gives none', () => {
    const answer = answerWith({ carlow: 10, cork: 11, dublin: 12 }, { min: null, max: undefined });
    const colours = buildMapColours(answer, SLUGS);
    expect(colours.colourFor('carlow')).toBe(TEMPERATURE_RAMP[0]);
    expect(colours.colourFor('dublin')).toBe(TEMPERATURE_RAMP[6]);
  });

  it('keeps a value outside the range at the nearest end instead of failing', () => {
    const answer = answerWith({ carlow: 5, dublin: 30 }, { min: '10.000', max: '20.000' });
    const colours = buildMapColours(answer, SLUGS);
    expect(colours.colourFor('carlow')).toBe(TEMPERATURE_RAMP[0]);
    expect(colours.colourFor('dublin')).toBe(TEMPERATURE_RAMP[6]);
  });

  it('uses the rainfall colours for rainfall', () => {
    const answer = answerWith({ carlow: 800, dublin: 1600 }, { variable: 'precipitation', unit: 'mm' });
    const colours = buildMapColours(answer, SLUGS);
    expect(colours.colourFor('carlow')).toBe(PRECIPITATION_RAMP[0]);
    expect(colours.colourFor('dublin')).toBe(PRECIPITATION_RAMP[6]);
  });

  it('gives grey to a county with no value, and counts them', () => {
    const colours = buildMapColours(answerWith({ carlow: 10, dublin: 12 }), SLUGS);
    expect(colours.colourFor('cork')).toBe(NO_DATA_COLOUR);
    expect(colours.colourFor('not-a-county')).toBe(NO_DATA_COLOUR);
    expect(colours.missing).toBe(2);
  });

  it('treats a value that is not a number as missing', () => {
    const colours = buildMapColours(answerWith({ carlow: 10, cork: null, dublin: 12 }), SLUGS);
    expect(colours.colourFor('cork')).toBe(NO_DATA_COLOUR);
    expect(colours.missing).toBe(2);
  });

  it('colours nothing when there are no results', () => {
    const colours = buildMapColours({ variable: 'temperature', unit: 'degC', min: null, max: null, results: [] }, SLUGS);
    expect(colours.hasValues).toBe(false);
    expect(colours.bins).toEqual([]);
    expect(colours.missing).toBe(4);
    expect(colours.colourFor('cork')).toBe(NO_DATA_COLOUR);
  });

  describe('when every county has the same value', () => {
    const colours = buildMapColours(answerWith({ carlow: 10, cork: 10, dublin: 10 }), SLUGS);

    it('uses the middle colour and a single legend entry', () => {
      expect(colours.colourFor('cork')).toBe(TEMPERATURE_RAMP[3]);
      expect(colours.bins).toEqual([{ colour: TEMPERATURE_RAMP[3], from: 10, to: 10, label: '10.0' }]);
    });
  });

  describe('legend entries', () => {
    const colours = buildMapColours(answerWith({ carlow: 10, dublin: 12 }), SLUGS);

    it('has one entry per colour, lowest first, in ramp order', () => {
      expect(colours.bins.map((bin) => bin.colour)).toEqual(TEMPERATURE_RAMP);
    });

    it('covers the whole range with no gaps', () => {
      expect(colours.bins[0].from).toBe(10);
      expect(colours.bins[6].to).toBe(12);
      for (let index = 1; index < 7; index += 1) {
        expect(colours.bins[index].from).toBe(colours.bins[index - 1].to);
      }
    });

    it('matches the colours the counties get', () => {
      const answer = answerWith({ carlow: 10.9, dublin: 12, cork: 10 });
      const built = buildMapColours(answer, SLUGS);
      const bin = built.bins.find((candidate) => candidate.colour === built.colourFor('carlow'));
      expect(10.9).toBeGreaterThanOrEqual(bin.from);
      expect(10.9).toBeLessThanOrEqual(bin.to);
    });

    it('writes the ranges with one decimal for temperature', () => {
      expect(colours.bins[0].label).toBe('10.0–10.3');
      expect(colours.bins[6].label).toBe('11.7–12.0');
    });

    it('writes whole numbers for rainfall', () => {
      const rain = buildMapColours(answerWith({ carlow: 800, dublin: 1600 }, { variable: 'precipitation', unit: 'mm' }), SLUGS);
      expect(rain.bins[0].label).toBe('800–914');
      expect(rain.bins[6].label).toBe('1486–1600');
    });

    it('uses two decimals when the steps are too small for one', () => {
      const narrow = buildMapColours(answerWith({ carlow: 9.4, dublin: 9.6 }), SLUGS);
      expect(narrow.bins[0].label).toBe('9.40–9.43');
    });
  });
});

describe('formatValue', () => {
  it('uses a proper minus sign for values below zero', () => {
    expect(formatValue(-1.25, 'temperature', 0.5)).toBe('−1.3');
  });
});

describe('describeChoice', () => {
  it('names the variable, season, scenario, period and unit', () => {
    expect(describeChoice({ variable: 'temperature', scenario: 'rcp85', period: '2071-2100', season: 'annual', unit: 'degC' })).toBe(
      'Average temperature, whole year, RCP8.5, 2071–2100 (°C)',
    );
  });

  it('works for rainfall in a season', () => {
    expect(describeChoice({ variable: 'precipitation', scenario: 'rcp45', period: '2021-2050', season: 'winter', unit: 'mm' })).toBe(
      'Rainfall, winter, RCP4.5, 2021–2050 (mm)',
    );
  });

  it('calls the baseline scenario Baseline', () => {
    expect(describeChoice({ variable: 'temperature', scenario: 'baseline', period: '1976-2005', season: 'annual', unit: 'degC' })).toBe(
      'Average temperature, whole year, Baseline, 1976–2005 (°C)',
    );
  });

  it('falls back to the usual unit for the variable when the answer has none', () => {
    expect(describeChoice({ variable: 'precipitation', scenario: 'rcp26', period: '2071-2100', season: 'annual' })).toContain('(mm)');
  });
});
