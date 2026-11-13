// Line chart of projected sea-level rise for one county (CCD-407),
// with the same colours and line styles as the temperature and rainfall charts.
// Props:
//   "data"     - one response from GET /api/sea-level/{slug}/
//   "selected" - the scenarios ticked in "Show scenarios", e.g. ['rcp26', 'rcp85']
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { buildSeaLevelChartData, buildSeaLevelSummary, hasSeaLevelData } from './seaLevelChartData';
import { ALL_SCENARIOS } from '../styles/scenarioColors';

// Chart.js only includes the parts you register, which keeps the bundle small
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// The API only sends the source's short code, so map it to a readable name
const SOURCE_NAMES = {
  ukcp18: 'Met Office UKCP18',
};

export default function SeaLevelChart({ data, selected = ALL_SCENARIOS }) {
  // Inland county: explain why there is no chart, instead of showing an empty one
  if (data && data.has_coastline === false) {
    return <p>County {data.county} has no coastline, so there is no sea-level projection for it.</p>;
  }

  // Coastal county but no data came back
  if (!hasSeaLevelData(data)) {
    return <p>No sea-level data is available for this county.</p>;
  }

  // e.g. "Sea-level rise at Cork's coast, cm"
  const title = `Sea-level rise at ${data.county}'s coast, ${data.unit}`;
  const firstSeries = Object.values(data.series)[0];
  const source = SOURCE_NAMES[firstSeries.source] || firstSeries.source;

  // Chart.js settings: title on top, legend underneath, unit and baseline on the side axis
  const options = {
    responsive: true,
    plugins: {
      title: { display: true, text: title },
      legend: { position: 'bottom' },
    },
    scales: {
      y: { title: { display: true, text: `${data.unit} rise since ${data.baseline_period}` } },
    },
  };

  return (
    <figure className="projection-chart">
      {/* role="img" + aria-label tell screen readers what the chart is */}
      <Line data={buildSeaLevelChartData(data, selected)} options={options} role="img" aria-label={title} />
      <figcaption>
        {buildSeaLevelSummary(data, selected)} Source: {source}.
      </figcaption>
    </figure>
  );
}