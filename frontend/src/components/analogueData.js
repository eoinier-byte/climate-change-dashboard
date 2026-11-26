// Helper functions for the climate analogue block (CCD-151, CCD-373).
// They take rows from GET /api/counties/{slug}/analogues/ and turn them into what the block shows.
// Kept separate from the component so they are easy to test.
import { ALL_SCENARIOS } from '../styles/scenarioColors';

// The analogue endpoint takes ONE scenario, but the county page can have several ticked.
// Use the highest-emissions scenario that is ticked (the same rule as the seasonal charts),
// e.g. ['rcp26', 'rcp45'] -> 'rcp45'. Nothing ticked -> 'rcp85'.
export function pickScenario(selected) {
  const ticked = ALL_SCENARIOS.filter((scenario) => selected.includes(scenario));
  return ticked.length > 0 ? ticked[ticked.length - 1] : 'rcp85';
}

// Similarity is shown as a word and a bar, never as a bare percentage (wireframe 07).
// The API's similarity is between 0 and 1, and higher is closer.
const SIMILARITY_WORDS = [
  { from: 0.75, word: 'High' },
  { from: 0.5, word: 'Moderate' },
  { from: 0, word: 'Low' },
];

// e.g. "0.812" -> "High", "0.6" -> "Moderate", "0.3" -> "Low"
export function similarityWord(similarity) {
  const value = Number(similarity);
  const level = SIMILARITY_WORDS.find((step) => value >= step.from);
  return level ? level.word : 'Low';
}

// How full the similarity bar is, from 0 to 100, e.g. "0.812" -> 81
export function similarityPercent(similarity) {
  const value = Number(similarity);
  if (Number.isNaN(value)) return 0;
  return Math.round(Math.min(Math.max(value, 0), 1) * 100);
}

// The API's unit codes, as people write them
const UNIT_NAMES = { degC: '°C', mm: 'mm' };

function unitName(unit) {
  return UNIT_NAMES[unit] || unit;
}

// A number with a fixed number of decimals and thousands commas, e.g. 1352.4 -> "1,352"
function formatNumber(value, decimals) {
  return Number(value).toLocaleString('en-IE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// A difference with its sign, e.g. 0.18 -> "+0.2 °C", -142.4 -> "-142 mm", 0 -> "0.0 °C"
function formatDifference(value, decimals, unit) {
  const sign = Number(value.toFixed(decimals)) > 0 ? '+' : '';
  return `${sign}${formatNumber(value, decimals)} ${unit}`;
}

// One line of the comparison table: the county's projected value, the city's value today,
// and how different the city is (city minus county)
function comparisonRow(label, countyValue, cityValue, unit, decimals) {
  const county = Number(countyValue);
  const city = Number(cityValue);
  return {
    label,
    county: `${formatNumber(county, decimals)} ${unit}`,
    city: `${formatNumber(city, decimals)} ${unit}`,
    difference: formatDifference(city - county, decimals, unit),
  };
}

// The three lines of the comparison table for one city row from the API
export function comparisonRows(row) {
  const temperatureUnit = unitName(row.temperature_unit);
  const rainUnit = unitName(row.precipitation_unit);
  return [
    comparisonRow('Summer temperature', row.county_summer_temp, row.city_summer_temp, temperatureUnit, 1),
    comparisonRow('Winter temperature', row.county_winter_temp, row.city_winter_temp, temperatureUnit, 1),
    comparisonRow('Rainfall per year', row.county_annual_precip, row.city_annual_precip, rainUnit, 0),
  ];
}