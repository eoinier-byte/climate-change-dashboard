// Mock responses for the sea-level chart (CCD-407), for tests.
// They copy the exact shape of GET /api/sea-level/{slug}/ (SeaLevelSeriesSerializer).
// Cork's values are real, from pipeline/data/processed/sea_level.csv (Met Office UKCP18).
// Django REST Framework sends decimal numbers as strings, so the mock does the same.

// Cork: a coastal county, one series per scenario, one value every 10 years
export const mockSeaLevelCork = {
  county: 'Cork',
  slug: 'cork',
  has_coastline: true,
  unit: 'cm',
  baseline_period: '1981-2000',
  years: [2020, 2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100],
  series: {
    rcp26: {
      values: ['9.614', '14.007', '18.447', '22.827', '27.069', '31.196', '35.152', '39.003', '42.702'],
      provenance: 'UKCP18',
      source: 'ukcp18',
    },
    rcp45: {
      values: ['9.594', '14.125', '19.026', '24.419', '29.966', '35.758', '41.572', '47.070', '52.676'],
      provenance: 'UKCP18',
      source: 'ukcp18',
    },
    rcp85: {
      values: ['10.340', '15.516', '21.618', '28.634', '36.525', '45.355', '54.809', '64.857', '75.404'],
      provenance: 'UKCP18',
      source: 'ukcp18',
    },
  },
};

// Kildare: an inland county. The API still answers, but with no data
export const mockSeaLevelInland = {
  county: 'Kildare',
  slug: 'kildare',
  has_coastline: false,
  unit: null,
  baseline_period: null,
  years: [],
  series: {},
};