// Line chart of one county's projections for one variable and season
// (annual temperature for CCD-156, and reused for precipitation in CCD-163).
// It takes one response from the projections API as the "data" prop.
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
import { buildChartData, buildSummary } from './chartData';
import ChartCard from './charts/ChartCard';
import { buildChartOptions } from './charts/chartOptions';

// Chart.js only includes the parts you register, which keeps the bundle small
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// Turns "temperature" into "Temperature"
function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function ProjectionChart({ data }) {
  // No data, or no scenarios: show a message instead of an empty chart
  if (!data || !data.scenarios || Object.keys(data.scenarios).length === 0) {
    return <p>No projection data is available for this selection.</p>;
  }

  // e.g. "Temperature in Cork (annual), °C"
  const title = `${capitalise(data.variable)} in ${data.county} (${data.season}), ${data.unit}`;

  // Shared settings (CCD-160): unit on the side axis and in the tooltip.
  // The tooltip shows the actual value (e.g. °C or mm), the same as the side axis.
  const options = buildChartOptions({ yTitle: data.unit, unit: data.unit });

  return (
    <ChartCard
      title={title}
      subtitle={`Each line starts at the ${data.baseline_period} average`}
      summary={buildSummary(data)}
      source={data.source}
    >
      {/* role="img" + aria-label tell screen readers what the chart is */}
      <Line data={buildChartData(data)} options={options} role="img" aria-label={title} />
    </ChartCard>
  );
}