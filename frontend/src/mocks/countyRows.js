// Mock responses for the county dashboard (CCD-149), for tests.
// They copy the exact shape of the real API:
//   GET /api/counties/cork/          -> mockCork
//   GET /api/projections/?county=cork -> mockCorkRows (the rows the dashboard uses)
// Values are Cork's real figures from pipeline/data/processed/climate_data.csv.
// Django REST Framework sends decimal numbers as strings, so the mock does the same.
import { mockPrecipitationSeasonal, mockTemperatureSeasonal } from './projections';

// One county with its present-day summary
export const mockCork = {
  id: 4,
  name: 'Cork',
  slug: 'cork',
  has_coastline: true,
  summary: {
    scenario: 'baseline',
    period: '1976-2005',
    season: 'annual',
    source: 'translate',
    temperature: { value: '9.815', unit: '°C' },
    precipitation: { value: '1368.817', unit: 'mm' },
  },
};

// Builds one row from the list endpoint, so the list below stays short to read
function row(variable, scenario, period, season, value, baselineValue, change, units) {
  return {
    county: 'cork',
    variable,
    scenario,
    period,
    season,
    baseline_period: '1976-2005',
    units,
    source: 'translate',
    value,
    baseline_value: baselineValue,
    projected_value: value,
    change,
  };
}

// Annual temperature: the baseline, then 3 scenarios x 2 periods
const temperatureRows = [
  row('temperature', 'baseline', '1976-2005', 'annual', '9.815', '9.815', '0.00', 'degC'),
  row('temperature', 'rcp26', '2021-2050', 'annual', '10.527', '9.815', '0.71', 'degC'),
  row('temperature', 'rcp26', '2071-2100', 'annual', '10.545', '9.815', '0.73', 'degC'),
  row('temperature', 'rcp45', '2021-2050', 'annual', '10.620', '9.815', '0.80', 'degC'),
  row('temperature', 'rcp45', '2071-2100', 'annual', '11.282', '9.815', '1.47', 'degC'),
  row('temperature', 'rcp85', '2021-2050', 'annual', '10.718', '9.815', '0.90', 'degC'),
  row('temperature', 'rcp85', '2071-2100', 'annual', '12.525', '9.815', '2.71', 'degC'),
];

// Annual precipitation (change is in %)
const precipitationRows = [
  row('precipitation', 'baseline', '1976-2005', 'annual', '1368.817', '1368.817', '0.0', 'mm'),
  row('precipitation', 'rcp26', '2021-2050', 'annual', '1426.539', '1368.817', '4.2', 'mm'),
  row('precipitation', 'rcp26', '2071-2100', 'annual', '1439.906', '1368.817', '5.2', 'mm'),
  row('precipitation', 'rcp45', '2021-2050', 'annual', '1408.939', '1368.817', '2.9', 'mm'),
  row('precipitation', 'rcp45', '2071-2100', 'annual', '1439.765', '1368.817', '5.2', 'mm'),
  row('precipitation', 'rcp85', '2021-2050', 'annual', '1405.153', '1368.817', '2.7', 'mm'),
  row('precipitation', 'rcp85', '2071-2100', 'annual', '1477.806', '1368.817', '8.0', 'mm'),
];

// Everything together, in the same mixed-up order the API could send it
export const mockCorkRows = [
  ...precipitationRows,
  ...mockPrecipitationSeasonal,
  ...temperatureRows,
  ...mockTemperatureSeasonal,
];