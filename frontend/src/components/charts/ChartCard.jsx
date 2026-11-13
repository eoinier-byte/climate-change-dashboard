// The frame around every chart (CCD-160, CCD-167): title, short subtitle, the chart itself,
// then a one-sentence summary and the data source underneath.
// Every chart uses it, so they all look and read the same way.
// Props:
//   title    - e.g. "Temperature in Cork (annual), °C"
//   subtitle - optional, e.g. "Compared with the 1976-2005 average"
//   summary  - the sentence screen readers read instead of the chart
//   source   - e.g. "Climate Ireland TRANSLATE"
//   children - the chart (a <Line> or <Bar>)
import '../../styles/charts.css';

export default function ChartCard({ title, subtitle, summary, source, children }) {
  return (
    // <figure> + <figcaption> tie the summary and source to the chart for screen readers
    <figure className="chart-card">
      <h3 className="chart-card__title">{title}</h3>
      {subtitle && <p className="chart-card__subtitle">{subtitle}</p>}
      <div className="chart-card__chart">{children}</div>
      <figcaption className="chart-card__caption">
        {summary} <span className="chart-card__source">Source: {source}.</span>
      </figcaption>
    </figure>
  );
}