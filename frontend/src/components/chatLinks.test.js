// Tests for the links under a chat answer (CCD-387)
import { describe, expect, it } from 'vitest';
import { answerCounty, answerLabel, chatLinks } from './chatLinks';

const RAIN_45_MID = { variable: 'precipitation', season: 'annual', scenario: 'rcp45', period: '2021-2050' };
const TEMP_85_END = { variable: 'temperature', season: 'annual', scenario: 'rcp85', period: '2071-2100' };

describe('answerCounty', () => {
  it('uses the last county the assistant looked up, written in any case', () => {
    const tools = [
      { name: 'get_projections', input: { county: 'kerry' } },
      { name: 'get_projections', input: { county: 'Cork' } },
    ];
    expect(answerCounty(tools, 'dublin')).toEqual({ name: 'Cork', slug: 'cork' });
  });

  it("falls back to the page's county, or null", () => {
    expect(answerCounty([{ name: 'rank_counties', input: {} }], 'dublin')).toEqual({ name: 'Dublin', slug: 'dublin' });
    expect(answerCounty([], undefined)).toBeNull();
    expect(answerCounty([{ name: 'get_projections', input: { county: 'atlantis' } }])).toBeNull();
  });
});

describe('answerLabel', () => {
  it('names the variable, scenario and period', () => {
    expect(answerLabel(RAIN_45_MID)).toBe('Rainfall · RCP4.5 · 2021–2050');
  });

  it('is null without a map view, or for one the pages cannot show', () => {
    expect(answerLabel(null)).toBeNull();
    expect(answerLabel({ ...RAIN_45_MID, period: '1976-2005' })).toBeNull();
  });
});

describe('chatLinks', () => {
  it("links a rainfall answer to the county's Rainfall section, but not to the Ireland map", () => {
    // The Ireland map only shows temperature, so a rainfall answer does not link to it
    expect(chatLinks({ mapAction: RAIN_45_MID, pageCounty: 'cork' })).toEqual([
      { label: "See it on Cork's page", to: '/county/cork?rcp=45&period=2021-2050#rainfall-heading' },
    ]);
  });

  it("links a temperature answer to the county's Temperature section and to the Ireland map", () => {
    expect(chatLinks({ mapAction: TEMP_85_END, pageCounty: 'kerry' })).toEqual([
      { label: "See it on Kerry's page", to: '/county/kerry?rcp=85&period=2071-2100#temperature-heading' },
      { label: 'Show RCP8.5, 2100 on the Ireland map', to: '/?rcp=85&year=2100' },
    ]);
  });

  it('only links to the Ireland map when the answer is not about one county', () => {
    expect(chatLinks({ mapAction: TEMP_85_END })).toEqual([
      { label: 'Show RCP8.5, 2100 on the Ireland map', to: '/?rcp=85&year=2100' },
    ]);
  });

  it('adds the flood map for a sea-level answer about a coastal county', () => {
    const tools = [{ name: 'get_sea_level', input: { county: 'cork' } }];
    expect(chatLinks({ mapAction: null, tools })).toEqual([
      { label: 'Open the flood map for Cork', to: '/sea-level?county=cork' },
    ]);
    // With a map view too, the flood map opens on the same scenario
    expect(chatLinks({ mapAction: RAIN_45_MID, tools }).at(-1).to).toBe('/sea-level?county=cork&rcp=45');
  });

  it('gives no flood map for an inland county', () => {
    const tools = [{ name: 'get_sea_level', input: { county: 'kildare' } }];
    expect(chatLinks({ mapAction: null, tools })).toEqual([]);
  });

  it('gives no links for a rainfall answer that is not about one county', () => {
    expect(chatLinks({ mapAction: RAIN_45_MID })).toEqual([]);
  });

  it('gives no links without a map view or a sea-level answer', () => {
    expect(chatLinks({ mapAction: null, pageCounty: 'cork' })).toEqual([]);
    expect(chatLinks({ mapAction: { ...RAIN_45_MID, scenario: 'rcp60' }, pageCounty: 'cork' })).toEqual([]);
  });
});