// Tests for the warming-stripe colours and rows (CCD-391).
import { describe, expect, it } from 'vitest';
import { STRIPE_RAMP, buildStripes, stripeColor } from './stripeColors';
import { buildSeries } from './countyChartData';
import { mockCorkRows } from '../mocks/countyRows';

describe('stripeColor', () => {
  it('gives the coolest value the first blue and the warmest the last red', () => {
    expect(stripeColor(9.8, 9.8, 12.5)).toBe(STRIPE_RAMP[0]);
    expect(stripeColor(12.5, 9.8, 12.5)).toBe(STRIPE_RAMP[STRIPE_RAMP.length - 1]);
  });

  it('gives the value halfway between them the middle colour', () => {
    expect(stripeColor(1, 0, 2)).toBe(STRIPE_RAMP[3]);
  });

  it('mixes the two nearest colours for values in between', () => {
    const color = stripeColor(0.3, 0, 2);
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
    expect(STRIPE_RAMP).not.toContain(color);
  });

  it('never goes past the ends', () => {
    expect(stripeColor(-5, 0, 2)).toBe(STRIPE_RAMP[0]);
    expect(stripeColor(50, 0, 2)).toBe(STRIPE_RAMP[STRIPE_RAMP.length - 1]);
  });

  it('uses the middle colour when every value is the same', () => {
    expect(stripeColor(10, 10, 10)).toBe(STRIPE_RAMP[3]);
  });
});

describe('buildStripes', () => {
  const series = buildSeries(mockCorkRows, 'Cork', 'temperature');

  it('has one row per ticked scenario, each with the baseline and every future period', () => {
    const stripes = buildStripes(series, ['rcp26', 'rcp85']);
    expect(stripes.rows.map((row) => row.label)).toEqual(['RCP2.6', 'RCP8.5']);
    expect(stripes.periods).toEqual(['1976-2005', '2021-2050', '2071-2100']);
    stripes.rows.forEach((row) => expect(row.stripes.map((stripe) => stripe.period)).toEqual(stripes.periods));
  });

  it('writes each value to one decimal place with its unit', () => {
    const rcp85 = buildStripes(series, ['rcp85']).rows[0];
    expect(rcp85.stripes.map((stripe) => stripe.text)).toEqual(['9.8 °C', '10.7 °C', '12.5 °C']);
  });

  it('colours the baseline blue and the warmest value red', () => {
    const rcp85 = buildStripes(series, ['rcp85']).rows[0];
    expect(rcp85.stripes[0].color).toBe(STRIPE_RAMP[0]);
    expect(rcp85.stripes[2].color).toBe(STRIPE_RAMP[STRIPE_RAMP.length - 1]);
  });

  it('keeps the same colours whichever scenarios are ticked', () => {
    const all = buildStripes(series, ['rcp26', 'rcp45', 'rcp85']);
    const only26 = buildStripes(series, ['rcp26']);
    expect(only26.rows[0].stripes).toEqual(all.rows[0].stripes);
  });

  it('reports the coolest and warmest value, for the legend', () => {
    const { range } = buildStripes(series, ['rcp85']);
    expect(range.minText).toBe('9.8 °C');
    expect(range.maxText).toBe('12.5 °C');
  });

  it('names the county and the data source', () => {
    const stripes = buildStripes(series, ['rcp85']);
    expect(stripes.county).toBe('Cork');
    expect(stripes.source).toBe('Climate Ireland TRANSLATE');
  });

  it('leaves a stripe without a colour when the API has no value for it', () => {
    const missing = { ...series, scenarios: { rcp85: { ...series.scenarios.rcp85, values: ['9.815', null, '12.525'] } } };
    const row = buildStripes(missing, ['rcp85']).rows[0];
    expect(row.stripes[1]).toEqual({ period: '2021-2050', text: 'no data', color: null });
  });

  it('gives nothing when there is no series', () => {
    expect(buildStripes(null, ['rcp85'])).toBeNull();
  });
});
