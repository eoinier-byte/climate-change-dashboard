import { useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getReport } from '../services/api';
import { ALL_SCENARIOS, SCENARIO_LABELS, SCENARIO_PLAIN_NAMES } from '../styles/scenarioColors';
import { ROUTES } from '../routes';

// What to tell the visitor when the report cannot be made (CCD-408)
function messageFor(error) {
  if (error?.status === 403) return 'Your session has ended. Please log in again to download the report.';
  if (error?.status === 404) return 'There is no report for this county.';
  if (error?.status === null || error?.status === undefined) {
    return 'We could not reach the server. Check your connection and try again.';
  }
  return 'We could not make the report. Please try again.';
}

// Saves the PDF the way a link with a "download" name does
function saveFile({ blob, filename }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// "Download PDF" on the county page (CCD-408): the one-page report of this county from the server (CCD-295).
// The report is for one scenario, so a choice sits next to the button; it starts on the first scenario ticked
// on the page. While the report is being made the button is disabled (so it cannot be clicked twice) and a
// message says so; if it fails, a message says why and the button changes to "Try again".
// Only a signed-in visitor can have the report (the server answers 403 to anyone else), so anyone else gets a
// link to the login page, which brings them back to this county afterwards (CCD-325).
export default function DownloadReport({ slug, scenarios = ALL_SCENARIOS }) {
  const { status } = useAuth();
  const location = useLocation();
  const selectId = useId();
  const working = useRef(false); // a second click in the same moment is ignored, before the screen updates
  const [choice, setChoice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (status === 'loading') return null;

  if (status !== 'signedIn') {
    return (
      <p className="download-report">
        <Link to={ROUTES.login} state={{ from: location }}>
          Log in to download the PDF report
        </Link>
      </p>
    );
  }

  // The scenario in the report: the visitor's choice, else the first one ticked on the page
  const scenario = choice ?? scenarios[0] ?? 'rcp45';

  const download = async () => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setMessage('');
    try {
      saveFile(await getReport(slug, scenario));
    } catch (error) {
      setMessage(messageFor(error));
    }
    working.current = false;
    setBusy(false);
  };

  return (
    <div className="download-report">
      <div className="download-report__row">
        <label htmlFor={selectId}>Scenario in the report</label>
        <select id={selectId} value={scenario} disabled={busy} onChange={(event) => setChoice(event.target.value)}>
          {ALL_SCENARIOS.map((value) => (
            <option key={value} value={value}>
              {SCENARIO_LABELS[value]}: {SCENARIO_PLAIN_NAMES[value]}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn--secondary" disabled={busy} onClick={download}>
          {busy ? 'Preparing PDF…' : message ? 'Try again' : 'Download PDF'}
        </button>
      </div>
      {busy && <p role="status">Making your report. This can take a few seconds.</p>}
      {message && <p role="alert">{message}</p>}
    </div>
  );
}
