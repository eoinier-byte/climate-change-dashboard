// The About page at /about (CCD-372): where the data comes from, what the scenarios mean,
// how the climate analogue and the flood map work, and what their limits are.
//
// Sections (each has an id, so other pages can link straight to it, e.g. /about#analogue-method):
//   1. Projections, not forecasts   (CCD-389)
//   2. The three scenarios          (CCD-389) - the names come from the map's scenario switch
//   3. How the climate analogue works (CCD-410)
//   4. How the flood map works      (CCD-390)
//   5. Limits of the projections    (CCD-390)
//   6. Data sources and licences    (CCD-390) - the list is in data/dataSources.js
import { DATA_SOURCES } from '../data/dataSources';
import { MAP_SCENARIOS } from '../hooks/useMapView';
import '../styles/about.css';

// A plain-language explanation of each scenario, by its code. The scenario NAMES are not typed here:
// they come from MAP_SCENARIOS (the map's switch), so the two always match.
const SCENARIO_EXPLANATIONS = {
  rcp26:
    'Countries cut greenhouse gas emissions quickly and steeply, so they fall close to zero later this century. ' +
    'This is the path closest to the Paris Agreement goal of keeping global warming well below 2 °C.',
  rcp45:
    'Emissions keep rising until around 2040 and then fall slowly, as countries take some action. ' +
    'There is less warming than if nothing is done, but more than with strong action.',
  rcp85:
    'Emissions keep rising through the century, with little done to cut them. ' +
    'This gives the most warming, and shows the highest risk.',
};

// The flood map's limits, from docs/flood-engine.md section 7
const FLOOD_LIMITS = [
  'It is not a flood forecast. It shows land that is below a chosen sea level and connected to the sea, not a real flood.',
  'It leaves out tides, storm surges and waves. Real coastal floods happen when a storm surge comes on top of a high tide.',
  'It leaves out flood defences such as sea walls and embankments, unless they show up in the height data.',
  'It leaves out rivers and rainfall. Only the sea is a source of water.',
  'The land heights include buildings and trees, so towns and woods can look higher than the ground and show less flooding than they should.',
  'Each square on the map is about 90 m across, and the heights can be out by up to 4 m, which is more than the 0 to 2 m range shown. The map is a rough guide only.',
  'Some estuaries count as land inside county boundaries, so they show as flooded even at 0 m.',
];

export default function About() {
  return (
    <main className="about-page">
      <h1>About</h1>
      <p className="about-page__intro">
        This dashboard shows how Ireland&apos;s climate could change in each of the 26 counties this century. This
        page explains where the numbers come from, what they mean and what they cannot tell you.
      </p>

      {/* Contents: links to each section further down the page */}
      <nav className="about-page__contents" aria-label="On this page">
        <ul>
          <li><a href="#projections">Projections, not forecasts</a></li>
          <li><a href="#scenarios">The three scenarios</a></li>
          <li><a href="#analogue-method">How the climate analogue works</a></li>
          <li><a href="#flood-map">How the flood map works</a></li>
          <li><a href="#limits">Limits of the projections</a></li>
          <li><a href="#sources">Data sources and licences</a></li>
        </ul>
      </nav>

      {/* 1. Projections, not forecasts (CCD-389) */}
      <section id="projections" aria-labelledby="projections-heading">
        <h2 id="projections-heading">Projections, not forecasts</h2>
        <p>
          A weather forecast tells you what the weather will be like on a particular day in the next week or so. A
          climate projection does not tell you the weather on any day. It shows how the average climate could change,
          for example the average temperature over 30 years, depending on how much greenhouse gas the world emits.
        </p>
        <p>
          That is why the dashboard shows 30-year averages (2021–2050 and 2071–2100) compared with the 1976–2005
          average, and why it shows three scenarios instead of one answer.
        </p>
      </section>

      {/* 2. The three scenarios (CCD-389). Names from the map's switch, in the same order. */}
      <section id="scenarios" aria-labelledby="scenarios-heading">
        <h2 id="scenarios-heading">The three scenarios</h2>
        <p>
          Nobody knows how much greenhouse gas the world will emit, so the projections follow three possible paths.
          Climate scientists call them RCPs (Representative Concentration Pathways).
        </p>
        <dl className="about-page__scenarios">
          {MAP_SCENARIOS.map(({ value, plain, rcp }) => (
            <div key={value} className="about-page__scenario">
              <dt>
                {plain} <span className="about-page__code">({rcp})</span>
              </dt>
              <dd>{SCENARIO_EXPLANATIONS[value]}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 3. How the climate analogue works (CCD-410) */}
      <section id="analogue-method" aria-labelledby="analogue-heading">
        <h2 id="analogue-heading">How the climate analogue works</h2>
        <p>
          On each county page, the climate analogue names a European city whose climate today is close to the
          county&apos;s projected future climate, for example &quot;Cork in 2071–2100 will feel like Brest today&quot;.
        </p>
        <p>
          To work out the county&apos;s future climate, we take its climate today (WorldClim, 1970–2000 averages) and
          add the change that TRANSLATE projects for the chosen scenario and period. Temperature changes are added;
          rainfall changes are applied as a percentage. Because both the county and the cities start from the same
          observed data, we compare changes from a baseline, not raw numbers from different climate models.
        </p>
        <p>
          We then compare three numbers with today&apos;s values in about 50 European cities: summer temperature
          (June to August), winter temperature (December to February) and yearly rainfall. The closest city is the
          match, and the next two are shown as well.
        </p>
        <p>
          The match is shown as a similarity score (Low, Moderate or High). It measures how close the three numbers
          are. <strong>It is not a probability and not a forecast.</strong>
        </p>
        <p>Limits:</p>
        <ul>
          <li>Only three numbers are compared. Sunshine, wind, humidity and extreme weather are not.</li>
          <li>The two baselines are slightly different periods (1970–2000 and 1976–2005).</li>
          <li>A city&apos;s value is the value of the map square it is in, about 12 × 18 km.</li>
        </ul>
      </section>

      {/* 4. How the flood map works (CCD-390) */}
      <section id="flood-map" aria-labelledby="flood-heading">
        <h2 id="flood-heading">How the flood map works</h2>
        <p>
          The flood map on the Flooding page shows which land in a coastal county is below a chosen sea level, from 0
          to 2 m above today&apos;s average, and connected to the sea. It is a simplified &quot;bathtub&quot; model: the
          sea is raised like water in a bath, and any low land it can reach is shown as flooded.
        </p>
        <p>Limits:</p>
        <ul>
          {FLOOD_LIMITS.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </section>

      {/* 5. Limits of the projections (CCD-390) */}
      <section id="limits" aria-labelledby="limits-heading">
        <h2 id="limits-heading">Limits of the projections</h2>
        <ul>
          <li>Projections come from climate models, which simplify the real world. Different models give different answers.</li>
          <li>
            They are 30-year averages over a whole county, so they do not show single hot days, storms, or differences
            within a county.
          </li>
          <li>
            The temperature and rainfall projections use the CMIP5 models and RCP scenarios. Newer CMIP6 projections
            exist, but the Climate Ireland portal still serves the CMIP5 data, so we use it for consistency.
          </li>
          <li>The sea-level numbers are the middle estimate (50th percentile) of each scenario. The real rise could be higher or lower.</li>
        </ul>
      </section>

      {/* 6. Data sources and licences (CCD-390). The list is in data/dataSources.js. */}
      <section id="sources" aria-labelledby="sources-heading">
        <h2 id="sources-heading">Data sources and licences</h2>
        <ul className="about-page__sources">
          {DATA_SOURCES.map((source) => (
            <li key={source.name} className="about-page__source">
              <h3>{source.name}</h3>
              <p>
                <strong>From:</strong> {source.provider}
              </p>
              <p>
                <strong>Used for:</strong> {source.usedFor}
              </p>
              <p>
                <strong>Licence:</strong> <a href={source.licenceUrl}>{source.licence}</a>
              </p>
              <p className="about-page__credit">{source.credit}</p>
              <p>
                <a href={source.link}>Go to the data or paper</a>
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}