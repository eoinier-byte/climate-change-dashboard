// Tests for turning impacts API rows into cards (CCD-375)
import { describe, expect, it } from 'vitest';
import { INDICATORS, buildImpacts } from './impactsData';
import { mockImpactsCork } from '../mocks/impacts';

const ALL = ['rcp26', 'rcp45', 'rcp85'];

describe('buildImpacts', () => {
  it('makes one card per indicator, in the agreed order, for a full response', () => {
    const cards = buildImpacts(mockImpactsCork, '2071-2100', ALL);

    expect(cards.map((card) => card.code)).toEqual(INDICATORS.map((indicator) => indicator.code));
    // every card has a line for each ticked scenario
    for (const card of cards) {
      expect(card.projections.map((line) => line.scenario)).toEqual(ALL);
    }
  });

  it('writes plain-language lines with units, and the difference adds up', () => {
    const cards = buildImpacts(mockImpactsCork, '2071-2100', ['rcp85']);
    const byCode = Object.fromEntries(cards.map((card) => [card.code, card]));

    // Frost days: 30.8 today and 6.4 under RCP8.5 are shown as 31 and 6, so "25 fewer"
    expect(byCode.frost_days.today).toBe('31 days a year');
    expect(byCode.frost_days.projections[0].text).toBe('6 days a year, 25 fewer than today');

    // Hot days keep one decimal because the numbers are small
    expect(byCode.summer_days.today).toBe('1.6 days a year');
    expect(byCode.summer_days.projections[0].text).toBe('13.9 days a year, 12.3 more than today');

    // Heating need is a percentage, never "days"
    expect(byCode.heating_degree_days.today).toBe('2,124 degree days a year');
    expect(byCode.heating_degree_days.projections[0].text).toBe('36% less heating needed than today');
  });

  it('uses the chosen period and only the ticked scenarios', () => {
    const cards = buildImpacts(mockImpactsCork, '2021-2050', ['rcp26']);
    const frost = cards.find((card) => card.code === 'frost_days');

    expect(frost.projections).toHaveLength(1);
    expect(frost.projections[0].scenarioLabel).toBe('RCP2.6');
    // 22.5 in 2021-2050 under RCP2.6
    expect(frost.projections[0].text).toBe('22 days a year, 9 fewer than today');
  });

  it('hides an indicator the response does not include, instead of showing 0', () => {
    const withoutHotDays = mockImpactsCork.filter((row) => row.indicator !== 'summer_days');
    const cards = buildImpacts(withoutHotDays, '2071-2100', ALL);

    expect(cards.map((card) => card.code)).not.toContain('summer_days');
    expect(cards).toHaveLength(3);
  });

  it('hides an indicator whose numbers are missing (null)', () => {
    const noNumbers = mockImpactsCork.map((row) =>
      row.indicator === 'frost_days' ? { ...row, projected_value: null } : row,
    );
    const cards = buildImpacts(noNumbers, '2071-2100', ALL);

    expect(cards.map((card) => card.code)).not.toContain('frost_days');
  });

  it('leaves out a scenario line that has no data, but keeps the rest of the card', () => {
    const noRcp45 = mockImpactsCork.filter((row) => !(row.indicator === 'frost_days' && row.scenario === 'rcp45'));
    const frost = buildImpacts(noRcp45, '2071-2100', ALL).find((card) => card.code === 'frost_days');

    expect(frost.projections.map((line) => line.scenario)).toEqual(['rcp26', 'rcp85']);
  });

  it('ignores indicators it does not know how to explain', () => {
    const extra = [...mockImpactsCork, { ...mockImpactsCork[2], indicator: 'icing_days' }];
    const cards = buildImpacts(extra, '2071-2100', ALL);

    expect(cards.map((card) => card.code)).not.toContain('icing_days');
  });

  it('returns no cards for an empty response', () => {
    expect(buildImpacts([], '2071-2100', ALL)).toEqual([]);
  });
});