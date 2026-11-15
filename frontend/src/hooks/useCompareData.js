// Loads what the Compare page needs (CCD-207):
//
//   const { counties, rows, loading, error, retry } = useCompareData('cork');
//
//   counties - the county list for the dropdown ([] until it arrives, or if it cannot be loaded; the
//              page still works without it)
//   rows     - every projection row for the county (GET /api/projections/?county=cork), or null
//   loading  - true until the rows for THE CURRENT county have arrived
//   error    - the error if the rows could not be loaded, otherwise null
//   retry    - asks for the rows again (for the Retry button of ErrorMessage)
//
// Both scenarios, both periods and every season come in one request, so changing the scenarios or the
// period never needs another one. Only choosing another county does. If the old county's answer arrives
// late it is ignored, so the table can never show one county under another's name.
import { useEffect, useState } from 'react';
import { getCounties, getProjections } from '../services/api';

export default function useCompareData(slug) {
  const [counties, setCounties] = useState([]);
  const [attempt, setAttempt] = useState(0);
  // { key, rows } when it worked, or { key, error } when it failed
  const [result, setResult] = useState(null);

  const key = `${slug}|${attempt}`;

  // The county list is loaded once
  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    getCounties({ signal: controller.signal })
      .then((list) => {
        if (!ignore) setCounties(list);
      })
      .catch(() => {
        // Without the list the dropdown is hidden; the comparison itself still works
      });
    return () => {
      ignore = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    getProjections({ county: slug }, { signal: controller.signal })
      .then((rows) => {
        if (!ignore) setResult({ key, rows });
      })
      .catch((error) => {
        if (!ignore) setResult({ key, error });
      });
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [key, slug]);

  // An answer only counts if it is for the county being shown now
  const current = result?.key === key ? result : null;

  return {
    counties,
    rows: current?.rows ?? null,
    loading: current === null,
    error: current?.error ?? null,
    retry: () => setAttempt((count) => count + 1),
  };
}
