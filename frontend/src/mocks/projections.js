// Mock API responses for the county projection charts (CCD-155, CCD-162).
// They copy the exact shape of CountyProjectionsSerializer in the backend,
// so the charts can be built before the real endpoint (CCD-84) is merged.
// Values are Cork's real annual figures from pipeline/data/processed/climate_data.csv.
// Note: Django REST Framework sends decimal numbers as strings (e.g. "9.815"),
// so the mock does the same.

// Cork, annual mean temperature
export const mockTemperature = {
  county: 'Cork',
  slug: 'cork',
  variable: 'temperature',
  season: 'annual',
  unit: '°C',
  change_unit: '°C',
  baseline_period: '1976-2005',
  baseline: '9.815',
  periods: ['2021-2050', '2071-2100'],
  scenarios: {
    // "values" and "change" start with the baseline, then one entry per period
    rcp26: { label: 'RCP2.6', values: ['9.815', '10.527', '10.545'], change: [0, '0.71', '0.73'] },
    rcp45: { label: 'RCP4.5', values: ['9.815', '10.620', '11.282'], change: [0, '0.80', '1.47'] },
    rcp85: { label: 'RCP8.5', values: ['9.815', '10.718', '12.525'], change: [0, '0.90', '2.71'] },
  },
  source: 'Climate Ireland TRANSLATE (mock data)',
};

// Cork, annual total precipitation (change is in %, not mm)
export const mockPrecipitation = {
  county: 'Cork',
  slug: 'cork',
  variable: 'precipitation',
  season: 'annual',
  unit: 'mm',
  change_unit: '%',
  baseline_period: '1976-2005',
  baseline: '1368.817',
  periods: ['2021-2050', '2071-2100'],
  scenarios: {
    rcp26: { label: 'RCP2.6', values: ['1368.817', '1426.539', '1439.906'], change: [0, '4.2', '5.2'] },
    rcp45: { label: 'RCP4.5', values: ['1368.817', '1408.939', '1439.765'], change: [0, '2.9', '5.2'] },
    rcp85: { label: 'RCP8.5', values: ['1368.817', '1405.153', '1477.806'], change: [0, '2.7', '8.0'] },
  },
  source: 'Climate Ireland TRANSLATE (mock data)',
};