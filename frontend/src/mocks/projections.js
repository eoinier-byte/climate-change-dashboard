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


// Cork, precipitation by season for 2071-2100 (CCD-162).
// This copies one page of rows from the list endpoint (CCD-84):
// GET /api/projections/?county=cork&variable=precipitation&period=2071-2100
// One row per scenario and season. "change" is the % change from the 1976-2005 baseline.
export const mockPrecipitationSeasonal = [
  // Winter
  { county: 'cork', variable: 'precipitation', scenario: 'rcp26', period: '2071-2100', season: 'winter', baseline_period: '1976-2005', units: 'mm', source: 'translate', value: '478.775', baseline_value: '433.179', projected_value: '478.775', change: '10.5' },
  { county: 'cork', variable: 'precipitation', scenario: 'rcp45', period: '2071-2100', season: 'winter', baseline_period: '1976-2005', units: 'mm', source: 'translate', value: '490.804', baseline_value: '433.179', projected_value: '490.804', change: '13.3' },
  { county: 'cork', variable: 'precipitation', scenario: 'rcp85', period: '2071-2100', season: 'winter', baseline_period: '1976-2005', units: 'mm', source: 'translate', value: '528.778', baseline_value: '433.179', projected_value: '528.778', change: '22.1' },
  // Spring
  { county: 'cork', variable: 'precipitation', scenario: 'rcp26', period: '2071-2100', season: 'spring', baseline_period: '1976-2005', units: 'mm', source: 'translate', value: '297.141', baseline_value: '285.259', projected_value: '297.141', change: '4.2' },
  { county: 'cork', variable: 'precipitation', scenario: 'rcp45', period: '2071-2100', season: 'spring', baseline_period: '1976-2005', units: 'mm', source: 'translate', value: '292.905', baseline_value: '285.259', projected_value: '292.905', change: '2.7' },
  { county: 'cork', variable: 'precipitation', scenario: 'rcp85', period: '2071-2100', season: 'spring', baseline_period: '1976-2005', units: 'mm', source: 'translate', value: '301.208', baseline_value: '285.259', projected_value: '301.208', change: '5.6' },
  // Summer
  { county: 'cork', variable: 'precipitation', scenario: 'rcp26', period: '2071-2100', season: 'summer', baseline_period: '1976-2005', units: 'mm', source: 'translate', value: '258.611', baseline_value: '255.083', projected_value: '258.611', change: '1.4' },
  { county: 'cork', variable: 'precipitation', scenario: 'rcp45', period: '2071-2100', season: 'summer', baseline_period: '1976-2005', units: 'mm', source: 'translate', value: '245.907', baseline_value: '255.083', projected_value: '245.907', change: '-3.6' },
  { county: 'cork', variable: 'precipitation', scenario: 'rcp85', period: '2071-2100', season: 'summer', baseline_period: '1976-2005', units: 'mm', source: 'translate', value: '229.557', baseline_value: '255.083', projected_value: '229.557', change: '-10.0' },
  // Autumn
  { county: 'cork', variable: 'precipitation', scenario: 'rcp26', period: '2071-2100', season: 'autumn', baseline_period: '1976-2005', units: 'mm', source: 'translate', value: '405.379', baseline_value: '395.294', projected_value: '405.379', change: '2.6' },
  { county: 'cork', variable: 'precipitation', scenario: 'rcp45', period: '2071-2100', season: 'autumn', baseline_period: '1976-2005', units: 'mm', source: 'translate', value: '410.150', baseline_value: '395.294', projected_value: '410.150', change: '3.8' },
  { county: 'cork', variable: 'precipitation', scenario: 'rcp85', period: '2071-2100', season: 'autumn', baseline_period: '1976-2005', units: 'mm', source: 'translate', value: '418.263', baseline_value: '395.294', projected_value: '418.263', change: '5.8' },
];