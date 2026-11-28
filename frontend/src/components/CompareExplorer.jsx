// The Compare section (home page and /compare). Two ways to compare, chosen at the top:
//   - one county, up to seven things at once: the 1976-2005 baseline and each scenario at mid-century and at the
//     end of the century, or
//   - two counties under one scenario and one period.
// It shows the headline, a few highlights (the warmest and wettest season, the most warming, whether warming
// and rainfall go together), two dot charts of how each season changes, a scatterplot of temperature against
// rainfall with a point for every season, and a table with all the numbers. The sums are in explorerData.js.
// Props: prefix - how the choices are named in the URL (see hooks/useExplorerView.js)
import { useId, useState } from 'react';
import { COUNTIES } from '../data/counties';
import { useProjectionRows } from '../hooks/useCompareData';
import useExplorerView, { COUNTY_PERIODS, MODES } from '../hooks/useExplorerView';
import { ALL_SCENARIOS, SCENARIO_COLORS, SCENARIO_LABELS, SCENARIO_PLAIN_NAMES } from '../styles/scenarioColors';
import ErrorMessage from './ErrorMessage';
import Loading from './Loading';
import {
  COMBOS,
  PERIOD_NAMES,
  SEASONS,
  SEASON_LETTERS,
  SEASON_NAMES,
  buildChangePanel,
  buildHeadline,
  buildItems,
  buildPoints,
  buildScatter,
  buildSummary,
  buildTableRows,
} from './explorerData';
import '../styles/compare-explorer.css';

const MODE_NAMES = {
  scenarios: 'One county, several scenarios',
  counties: 'Two counties, one scenario',
};

const nameOf = (slug) => COUNTIES.find((county) => county.slug === slug)?.name ?? slug.charAt(0).toUpperCase() + slug.slice(1);

function CountySelect({ label, value, onChange }) {
  const id = useId();
  return (
    <div className="explorer__field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {!COUNTIES.some((county) => county.slug === value) && <option value={value}>{nameOf(value)}</option>}
        {COUNTIES.map((county) => (
          <option key={county.slug} value={county.slug}>
            {county.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// A little ring (mid-century) or disc (end of century) in the colour of an item, for keys and tick boxes
function Marker({ item }) {
  return <span className="explorer__marker" style={{ borderColor: item.colour, backgroundColor: item.fill }} aria-hidden="true" />;
}

// One chart of how each season changes: a row for each season, a dot for each item, on one scale with a line at 0
function ChangePanel({ title, subtitle, panel, items }) {
  return (
    <div className="explorer__panel" role="group" aria-label={title}>
      <h4>
        {title} <span>{subtitle}</span>
      </h4>
      <ul className="explorer__key" aria-label="Key">
        {items.map((item) => (
          <li key={item.key}>
            <Marker item={item} /> {item.label}
          </li>
        ))}
      </ul>
      {panel.rows.map((row) => (
        <div className="explorer__row" key={row.season}>
          <span className="explorer__row-label">{SEASON_NAMES[row.season]}</span>
          <div className="explorer__track">
            <span className="explorer__zero" style={{ left: `${panel.zero}%` }} aria-hidden="true" />
            {row.dots.map((dot) => (
              <span
                key={dot.item.key}
                className="explorer__dot"
                style={{ left: `${dot.left}%`, borderColor: dot.item.colour, backgroundColor: dot.item.fill }}
                title={dot.text}
                role="img"
                aria-label={dot.text}
              />
            ))}
          </div>
          <span className="explorer__gap">{row.gap}</span>
        </div>
      ))}
      <div className="explorer__row explorer__row--scale">
        <span />
        <div className="explorer__scale">
          <span>{panel.low}</span>
          <span>{panel.high}</span>
        </div>
        <span className="explorer__gap">{panel.hasGap ? 'gap' : ''}</span>
      </div>
    </div>
  );
}

function Scatter({ scatter, items, season, onSeason }) {
  const [hoverId, setHoverId] = useState(null);
  const hovered = scatter.points.find((point) => point.id === hoverId);
  return (
    <div className="explorer__scatter" role="group" aria-labelledby="explorer-scatter-title">
      <h4 id="explorer-scatter-title">
        Temperature against rainfall, by season
        <span>Each point is one season. Lines run from the 1976–2005 baseline when it is shown.</span>
      </h4>
      <div className="explorer__seasons" role="group" aria-label="Highlight a season">
        <span>Highlight a season:</span>
        {SEASONS.map((entry) => (
          <button key={entry} type="button" aria-pressed={season === entry} onClick={() => onSeason(season === entry ? null : entry)}>
            {SEASON_LETTERS[entry]} · {SEASON_NAMES[entry]}
          </button>
        ))}
      </div>
      <ul className="explorer__key" aria-label="Key">
        {items.map((item) => (
          <li key={item.key}>
            <Marker item={item} /> {item.label}
          </li>
        ))}
      </ul>
      <p className="explorer__axis">↑ Rainfall in the season (mm)</p>
      <div className="explorer__plot-wrap">
        <div className="explorer__yticks" aria-hidden="true">
          {scatter.yTicks.map((tick) => (
            <span key={tick.label} style={{ top: `${tick.top}%` }}>
              {tick.label}
            </span>
          ))}
        </div>
        <div className="explorer__plot">
          {scatter.yTicks.map((tick) => (
            <span key={tick.label} className="explorer__gridline" style={{ top: `${tick.top}%` }} aria-hidden="true" />
          ))}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {scatter.lines.map((line) => (
              <line
                key={line.id}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={line.colour}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                opacity={season && season !== line.season ? 0.1 : 0.5}
              />
            ))}
          </svg>
          {scatter.points.map((point) => (
            <button
              key={point.id}
              type="button"
              className="explorer__point"
              style={{
                left: `${point.left}%`,
                top: `${point.top}%`,
                borderColor: point.item.colour,
                backgroundColor: point.item.fill,
                color: point.item.fill === '#ffffff' ? point.item.colour : '#ffffff',
                opacity: season && season !== point.season ? 0.15 : 1,
                zIndex: hoverId === point.id ? 4 : 2,
              }}
              aria-label={`${SEASON_NAMES[point.season]}, ${point.item.long}: ${point.t.toFixed(1)} °C, ${Math.round(point.p)} mm`}
              onMouseEnter={() => setHoverId(point.id)}
              onMouseLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(point.id)}
              onBlur={() => setHoverId(null)}
            >
              {SEASON_LETTERS[point.season]}
            </button>
          ))}
          {hovered && (
            <div className="explorer__tip" style={{ left: `${hovered.left}%`, top: `${hovered.top}%` }} aria-hidden="true">
              <strong>
                {SEASON_NAMES[hovered.season]} · {hovered.item.long}
              </strong>
              <span>
                {hovered.t.toFixed(1)} °C · {Math.round(hovered.p)} mm
              </span>
            </div>
          )}
        </div>
        <div className="explorer__xticks" aria-hidden="true">
          {scatter.xTicks.map((tick) => (
            <span key={tick.label} style={{ left: `${tick.left}%` }}>
              {tick.label}
            </span>
          ))}
        </div>
      </div>
      <p className="explorer__axis explorer__axis--x">Average temperature in the season →</p>
    </div>
  );
}

// Every number behind the charts, for reading or for screen readers
function StatsTable({ rows }) {
  const signed = (value, places, unit) => (value === null ? '–' : `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(places)}${unit}`);
  return (
    <details className="explorer__details">
      <summary>Show the numbers in a table</summary>
      <div className="explorer__table-wrap">
        <table className="explorer__table">
          <caption>Temperature and rainfall by season, with the change from the 1976–2005 baseline</caption>
          <thead>
            <tr>
              <th scope="col">Compared</th>
              <th scope="col">Season</th>
              <th scope="col">Temperature</th>
              <th scope="col">Temperature change</th>
              <th scope="col">Rainfall</th>
              <th scope="col">Rainfall change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  <Marker item={row.item} /> {row.item.long}
                </th>
                <td>{SEASON_NAMES[row.season]}</td>
                <td>{row.t.toFixed(1)} °C</td>
                <td>{signed(row.dt, 2, ' °C')}</td>
                <td>{Math.round(row.p)} mm</td>
                <td>{signed(row.dp, 1, '%')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default function CompareExplorer({ prefix = '' }) {
  const view = useExplorerView({ prefix });
  const [season, setSeason] = useState(null);
  const counties = view.mode === 'counties';

  const first = useProjectionRows(view.county);
  const second = useProjectionRows(view.county2, { skip: !counties });

  const names = { first: nameOf(view.county), second: nameOf(view.county2) };
  const items = buildItems({
    mode: view.mode,
    combos: view.combos,
    scenario: view.scenario,
    period: view.period,
    nameFirst: names.first,
    nameSecond: names.second,
  });

  const loading = first.loading || second.loading;
  const failed = first.error ? first : second.error ? second : null;

  let body;
  if (loading) {
    body = <Loading message="Loading projections…" />;
  } else if (failed) {
    body = <ErrorMessage error={failed.error} onRetry={failed.retry} />;
  } else {
    const rowsByWho = { first: first.rows, second: second.rows };
    const points = buildPoints(items, rowsByWho);
    if (points.length === 0) {
      body = <p role="status">There are no projections to compare for this choice.</p>;
    } else {
      const summary = buildSummary(points);
      const headline = buildHeadline({
        mode: view.mode,
        items,
        rowsByWho,
        countyNames: names,
        scenario: view.scenario,
        period: view.period,
        sameCounty: view.county === view.county2,
      });
      const subtitle = counties ? `${SCENARIO_LABELS[view.scenario]}, ${PERIOD_NAMES[view.period]}` : 'change from 1976–2005';
      body = (
        <>
          {headline && <h3 className="explorer__headline">{headline}</h3>}
          <div className="explorer__tiles">
            {summary.tiles.map((tile) => (
              <div className="explorer__tile" key={tile.label}>
                <p className="explorer__tile-label">{tile.label}</p>
                <p className="explorer__tile-value">{tile.value}</p>
                <p className="explorer__tile-detail">{tile.detail}</p>
              </div>
            ))}
          </div>
          <div className="explorer__panels">
            <ChangePanel title="Temperature change" subtitle={subtitle} panel={buildChangePanel(points, items, 'temperature')} items={items} />
            <ChangePanel title="Rainfall change" subtitle={subtitle} panel={buildChangePanel(points, items, 'precipitation')} items={items} />
          </div>
          <Scatter scatter={buildScatter(points, items)} items={items} season={season} onSeason={setSeason} />
          <p className="explorer__note">{summary.note}</p>
          <StatsTable rows={buildTableRows(points)} />
        </>
      );
    }
  }

  return (
    <div className="explorer">
      <div className="explorer__controls">
        <fieldset className="explorer__mode">
          <legend>Compare</legend>
          {MODES.map((mode) => (
            <label key={mode}>
              <input type="radio" name={`${prefix}compare-mode`} checked={view.mode === mode} onChange={() => view.setMode(mode)} />
              {MODE_NAMES[mode]}
            </label>
          ))}
        </fieldset>

        <CountySelect label={counties ? 'First county' : 'County'} value={view.county} onChange={view.setCounty} />
        {counties && <CountySelect label="Second county" value={view.county2} onChange={view.setSecondCounty} />}

        {counties ? (
          <>
            <fieldset className="explorer__mode">
              <legend>Scenario</legend>
              {ALL_SCENARIOS.map((scenario) => (
                <label key={scenario}>
                  <input
                    type="radio"
                    name={`${prefix}compare-scenario`}
                    checked={view.scenario === scenario}
                    onChange={() => view.setScenario(scenario)}
                  />
                  <span className="explorer__swatch" style={{ backgroundColor: SCENARIO_COLORS[scenario] }} aria-hidden="true" />
                  {SCENARIO_LABELS[scenario]}: {SCENARIO_PLAIN_NAMES[scenario]}
                </label>
              ))}
            </fieldset>
            <fieldset className="explorer__mode">
              <legend>Period</legend>
              {COUNTY_PERIODS.map((period) => (
                <label key={period}>
                  <input type="radio" name={`${prefix}compare-period`} checked={view.period === period} onChange={() => view.setPeriod(period)} />
                  {period === COUNTY_PERIODS[0] ? 'Mid-century' : 'End of century'} ({period.replace('-', '–')})
                </label>
              ))}
            </fieldset>
          </>
        ) : (
          <fieldset className="explorer__combos">
            <legend>What to compare (tick up to seven)</legend>
            {COMBOS.map((combo) => {
              const [item] = buildItems({ mode: 'scenarios', combos: [combo.key] });
              return (
                <label key={combo.key} className="explorer__combo">
                  <input type="checkbox" checked={view.combos.includes(combo.key)} onChange={() => view.toggleCombo(combo.key)} />
                  <Marker item={item} /> {combo.label}
                </label>
              );
            })}
            <span className="explorer__hint">Hollow rings are mid-century (2021–2050), solid dots the end of the century (2071–2100).</span>
          </fieldset>
        )}
      </div>

      {body}
    </div>
  );
}