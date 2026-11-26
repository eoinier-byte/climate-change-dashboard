// Example answers of GET /api/counties/{slug}/analogues/ for tests (CCD-151, CCD-373).
// Same shape as Artur's contract in docs/api-examples.md (CCD-358). The numbers are made up,
// but chosen so the expected text is easy to work out by hand.

// One city row. The county's values are the same in every row (they don't depend on the city).
function row(rank, city, country, similarity, summer, winter, rain) {
  return {
    county: 'cork',
    scenario: 'rcp85',
    period: '2071-2100',
    rank,
    city,
    country,
    latitude: '48.000',
    longitude: '-4.000',
    similarity,
    city_summer_temp: summer,
    city_winter_temp: winter,
    city_annual_precip: rain,
    county_summer_temp: '16.020',
    county_winter_temp: '7.110',
    county_annual_precip: '1352.400',
    temperature_unit: 'degC',
    precipitation_unit: 'mm',
    city_baseline_period: '1970-2000',
    change_baseline_period: '1976-2005',
    source: 'worldclim',
  };
}

// Cork's three closest cities, closest first.
// Brest compared with Cork: summer +0.2 °C (16.2 - 16.02), winter +0.2 °C (7.3 - 7.11), rain -142 mm (1210 - 1352.4)
export const analogueRows = [
  row(1, 'Brest', 'France', '0.812', '16.200', '7.300', '1210.000'),
  row(2, 'Plymouth', 'United Kingdom', '0.745', '15.700', '6.400', '1010.000'),
  row(3, 'Lorient', 'France', '0.701', '16.600', '6.900', '1420.000'),
];