// Bar chart of how much two counties change under one scenario (CCD-378): the whole year and each season,
// for temperature (°C) or rainfall (%), with the two counties side by side on the same axes.
// Props:
//   measures     - the measures from compareCounties() (compareData.js)
//   variable     - 'temperature' or 'precipitation'
//   nameA, nameB - the counties' names, e.g. "Cork" and "Kerry"
//   scenarioLabel, period - e.g. "RCP8.5" and "2071-2100"
//   source       - the source's short code from the API rows, e.g. "translate"
// The two counties use two colours that are not the scenario colours (those mean scenarios everywhere
// else), and each bar is also named in the legend, the tooltip and the summary text.
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import ChartCard from './charts/ChartCard';
import { buildChartOptions } from './charts/chartOptions';
import { COUNTY_COLOURS, SEASON_NAMES, formatChange } from './compareData';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const SOURCE_NAMES = {
  translate: 'Climate Ireland TRANSLATE',
};

export default function CountyCompareChart({ measures, variable, nameA, nameB, scenarioLabel, period, source }) {
  const shown = measures.filter((measure) => measure.variable === variable && (measure.a || measure.b));
  if (shown.length === 0) return <p>No data is available for this chart.</p>;

  const isTemperature = variable === 'temperature';
  const unit = isTemperature ? '°C' : '%';
  const what = isTemperature ? 'temperature' : 'rainfall';
  const title = `Change in ${what} by season: ${nameA} and ${nameB}, ${scenarioLabel}, ${period} (${unit})`;

  // A missing value becomes null, so the chart leaves a gap instead of drawing 0
  const dataFor = (side) => shown.map((measure) => (measure[side] ? measure[side].change : null));
  const data = {
    labels: shown.map((measure) => SEASON_NAMES[measure.season]),
    datasets: [
      { label: nameA, data: dataFor('a'), backgroundColor: COUNTY_COLOURS.first },
      { label: nameB, data: dataFor('b'), backgroundColor: COUNTY_COLOURS.second },
    ],
  };

  // The same numbers in words, for screen readers: "Cork: Whole year +2.71 °C, Winter +2.63 °C. Kerry: …"
  const sentence = (name, side) =>
    `${name}: ${shown
      .filter((measure) => measure[side])
      .map((measure) => `${SEASON_NAMES[measure.season].toLowerCase()} ${formatChange(measure[side].change, measure)}`)
      .join(', ')}.`;
  const summary = `Change from the 1976-2005 average. ${sentence(nameA, 'a')} ${sentence(nameB, 'b')}`;

  const options = buildChartOptions({ yTitle: `${unit} change from 1976-2005`, unit });

  return (
    <ChartCard
      title={title}
      subtitle="Change in each period of the year compared with the 1976-2005 average"
      summary={summary}
      source={SOURCE_NAMES[source] || source}
    >
      <Bar data={data} options={options} role="img" aria-label={title} />
    </ChartCard>
  );
}
