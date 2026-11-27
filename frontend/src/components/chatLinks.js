// The links under a chat answer (CCD-387): they take the person from Boreas's answer to the part of
// the site that shows it. Worked out from what the server sent with the answer:
//   mapAction  the "done" event's map_action, e.g. { variable: 'precipitation', season: 'annual',
//              scenario: 'rcp45', period: '2021-2050' }, or null when the answer has no map view
//   tools      the "tool" events, e.g. [{ name: 'get_sea_level', input: { county: 'cork' } }]
//   pageCounty the county page the person is on (e.g. 'cork'), or undefined
//
// The links it can give:
//   "See it on Cork's page"              /county/cork?rcp=45&period=2021-2050#rainfall-heading
//   "Show RCP4.5, 2050 on the Ireland map" /?rcp=45&year=2050 (the home page map)
//   "Open the flood map for Cork"         /sea-level?county=cork&rcp=45 (sea-level answers, coastal counties)
import { isCoastal } from '../data/coastalCounties';
import { COUNTIES } from '../data/counties';
import { PERIODS } from '../hooks/useCountyView';
import { ROUTES, countyPath } from '../routes';
import { SCENARIO_LABELS } from '../styles/scenarioColors';

// The section of the county page for each variable (the ids of its headings)
const SECTION = { temperature: 'temperature-heading', precipitation: 'rainfall-heading' };
const VARIABLE_NAMES = { temperature: 'Temperature', precipitation: 'Rainfall' };

// 'rcp45' -> '45' (how the URLs write a scenario)
const rcpNumber = (scenario) => scenario.replace('rcp', '');
// '2021-2050' -> '2050' (how the home map writes a period)
const lastYear = (period) => period.slice(-4);

// Only use a map view the pages can show: a known scenario and one of the two future periods
function isValid(mapAction) {
  return Boolean(mapAction && SCENARIO_LABELS[mapAction.scenario] && PERIODS.includes(mapAction.period));
}

// The county the answer is about: the last county the assistant looked up, otherwise the page's county.
// Gives { name, slug }, or null when there is none.
export function answerCounty(tools = [], pageCounty) {
  const looked = [...tools].reverse().find((tool) => tool.input?.county)?.input.county;
  const slug = (looked ?? pageCounty)?.toLowerCase(); // the assistant may write "Cork"
  return COUNTIES.find((county) => county.slug === slug) ?? null;
}

// A short line saying what the answer shows, e.g. "Rainfall · RCP4.5 · 2021–2050", or null
export function answerLabel(mapAction) {
  if (!isValid(mapAction)) return null;
  const parts = [VARIABLE_NAMES[mapAction.variable], SCENARIO_LABELS[mapAction.scenario], mapAction.period.replace('-', '–')];
  return parts.filter(Boolean).join(' · ');
}

// The list of links for one answer, each { label, to }. An empty list means no links.
export function chatLinks({ mapAction, tools = [], pageCounty }) {
  const links = [];
  const county = answerCounty(tools, pageCounty);
  const valid = isValid(mapAction);

  if (valid) {
    const { variable, scenario, period } = mapAction;

    // The county's own page, scrolled to the Temperature or Rainfall section
    if (county && SECTION[variable]) {
      const query = new URLSearchParams({ rcp: rcpNumber(scenario), period });
      links.push({
        label: `See it on ${county.name}'s page`,
        to: `${countyPath(county.slug)}?${query}#${SECTION[variable]}`,
      });
    }

    // The home page map of Ireland (it shows yearly temperature, so the label names the scenario and year)
    const query = new URLSearchParams({ rcp: rcpNumber(scenario), year: lastYear(period) });
    links.push({ label: `Show ${SCENARIO_LABELS[scenario]}, ${lastYear(period)} on the Ireland map`, to: `/?${query}` });
  }

  // A sea-level answer about a coastal county: its flood map
  const aboutSeaLevel = tools.some((tool) => tool.name === 'get_sea_level');
  if (aboutSeaLevel && county && isCoastal(county.slug)) {
    const query = new URLSearchParams({ county: county.slug });
    if (valid) query.set('rcp', rcpNumber(mapAction.scenario));
    links.push({ label: `Open the flood map for ${county.name}`, to: `${ROUTES.seaLevel}?${query}` });
  }

  return links;
}