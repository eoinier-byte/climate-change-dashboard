// Mock answer for GET /api/counties/cork/impacts/ (CCD-364, CCD-375), in the same shape the
// real endpoint sends: one row per indicator, scenario and period. Cork's real figures from
// pipeline/data/processed/impact_indicators.csv. Decimal numbers are strings, change is a number.
// Used by the tests and by docs; the app never imports this file.

// Builds one row so the list below stays short and easy to read
function row(indicator, scenario, period, projected, baseline, change, units) {
  return {
    scenario,
    baseline_period: '1976-2005',
    units,
    source: 'translate',
    value: projected,
    county: 'cork',
    period,
    season: 'annual',
    baseline_value: baseline,
    projected_value: projected,
    change,
    indicator,
  };
}

export const mockImpactsCork = [
  row('frost_days', 'baseline', '1976-2005', '30.826', '30.826', 0.0, 'days'),
  row('frost_days', 'rcp26', '2021-2050', '22.462', '30.826', -8.36, 'days'),
  row('frost_days', 'rcp26', '2071-2100', '22.451', '30.826', -8.38, 'days'),
  row('frost_days', 'rcp45', '2021-2050', '20.714', '30.826', -10.11, 'days'),
  row('frost_days', 'rcp45', '2071-2100', '14.580', '30.826', -16.25, 'days'),
  row('frost_days', 'rcp85', '2021-2050', '19.336', '30.826', -11.49, 'days'),
  row('frost_days', 'rcp85', '2071-2100', '6.417', '30.826', -24.41, 'days'),
  row('growing_season_length', 'baseline', '1976-2005', '332.867', '332.867', 0.0, 'days'),
  row('growing_season_length', 'rcp26', '2021-2050', '338.072', '332.867', 5.2, 'days'),
  row('growing_season_length', 'rcp26', '2071-2100', '339.316', '332.867', 6.45, 'days'),
  row('growing_season_length', 'rcp45', '2021-2050', '339.452', '332.867', 6.58, 'days'),
  row('growing_season_length', 'rcp45', '2071-2100', '351.506', '332.867', 18.64, 'days'),
  row('growing_season_length', 'rcp85', '2021-2050', '343.824', '332.867', 10.96, 'days'),
  row('growing_season_length', 'rcp85', '2071-2100', '356.572', '332.867', 23.7, 'days'),
  row('heating_degree_days', 'baseline', '1976-2005', '2123.712', '2123.712', 0.0, 'degC_days'),
  row('heating_degree_days', 'rcp26', '2021-2050', '1903.908', '2123.712', -219.8, 'degC_days'),
  row('heating_degree_days', 'rcp26', '2071-2100', '1899.887', '2123.712', -223.83, 'degC_days'),
  row('heating_degree_days', 'rcp45', '2021-2050', '1871.423', '2123.712', -252.29, 'degC_days'),
  row('heating_degree_days', 'rcp45', '2071-2100', '1684.118', '2123.712', -439.59, 'degC_days'),
  row('heating_degree_days', 'rcp85', '2021-2050', '1846.074', '2123.712', -277.64, 'degC_days'),
  row('heating_degree_days', 'rcp85', '2071-2100', '1359.013', '2123.712', -764.7, 'degC_days'),
  row('summer_days', 'baseline', '1976-2005', '1.630', '1.630', 0.0, 'days'),
  row('summer_days', 'rcp26', '2021-2050', '3.235', '1.630', 1.6, 'days'),
  row('summer_days', 'rcp26', '2071-2100', '3.516', '1.630', 1.89, 'days'),
  row('summer_days', 'rcp45', '2021-2050', '3.220', '1.630', 1.59, 'days'),
  row('summer_days', 'rcp45', '2071-2100', '5.609', '1.630', 3.98, 'days'),
  row('summer_days', 'rcp85', '2021-2050', '3.920', '1.630', 2.29, 'days'),
  row('summer_days', 'rcp85', '2071-2100', '13.888', '1.630', 12.26, 'days'),
];