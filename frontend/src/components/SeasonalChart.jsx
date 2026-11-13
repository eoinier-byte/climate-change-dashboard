// Bar chart of the change for each season: % change in precipitation (CCD-162)
// or °C change in temperature (CCD-157).
// It takes the rows from the list endpoint (GET /api/projections/) as the "rows" prop,
// and the county's display name (e.g. "Cork") as the "countyName" prop.
// The rows say which variable they are, so the chart works out its own title and unit.
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { buildSeasonalChartData, buildSeasonalSummary, changeUnit } from './seasonalChartData';

// Chart.js only includes the parts you register, which keeps the bundle small
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// The list endpoint only sends the source's short code, so map it to a readable name
const SOURCE_NAMES = {
  translate: 'Climate Ireland TRANSLATE',
};

export default function SeasonalChart({ rows, countyName }) {
  // No rows: show a message instead of an empty chart
  if (!rows || rows.length === 0) {
    return <p>No seasonal data is available for this selection.</p>;
  }

  const { period, variable, baseline_period: baselinePeriod } = rows[0];
  const unit = changeUnit(variable); // "%" for precipitation, "°C" for temperature

  // e.g. "Change in precipitation by season in Cork, 2071-2100 (%)"
  //   or "Change in temperature by season in Cork, 2071-2100 (°C)"
  const title = `Change in ${variable} by season in ${countyName}, ${period} (${unit})`;
  const source = SOURCE_NAMES[rows[0].source] || rows[0].source;

  // Chart.js settings: title on top, legend underneath, the unit on the side axis
  const options = {
    responsive: true,
    plugins: {
      title: { display: true, text: title },
      legend: { position: 'bottom' },
    },
    scales: {
      y: { title: { display: true, text: `${unit} change from ${baselinePeriod}` } },
    },
  };

  return (
    <figure className="projection-chart">
      {/* role="img" + aria-label tell screen readers what the chart is */}
      <Bar data={buildSeasonalChartData(rows)} options={options} role="img" aria-label={title} />
      <figcaption>
        {buildSeasonalSummary(rows)} Source: {source}.
      </figcaption>
    </figure>
  );
}