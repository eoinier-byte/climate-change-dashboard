// A shared "loading" indicator for every page that waits for data (CCD-145).
//
// Props:
//   message - what is loading, e.g. "Loading county data…". Defaults to "Loading…".
//
// Use it INSTEAD of the page content while the request is pending, and only show the charts or
// the map once the data has arrived, so nothing is ever drawn with empty data:
//
//   if (!data) return <Loading message="Loading county data…" />;
//   return <ProjectionChart data={data} />;
//
// role="status" makes a screen reader announce the message when it appears. The spinner is
// decoration only (aria-hidden), so the status text is exactly the message.
import '../styles/loading.css';

export default function Loading({ message = 'Loading…' }) {
  return (
    <div className="loading" role="status">
      <span className="loading__spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
