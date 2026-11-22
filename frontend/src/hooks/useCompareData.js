// The data the Compare page needs (CCD-207, CCD-378), as two small hooks.
//
//   const counties = useCounties();
//   const { rows, loading, error, retry } = useProjectionRows('cork');
//
// useCounties gives the county list for the dropdowns ([] until it arrives, or if it cannot be loaded;
// the page still works without it).
//
// useProjectionRows gives every projection row for one county (GET /api/projections/?county=cork), or
// null while loading. Both scenarios, both periods and every season come in one request, so changing the
// scenarios or the period never needs another one. Only choosing another county does. If the old county's
// answer arrives late it is ignored, so the table can never show one county under another's name.
// useProjectionRows(slug, { skip: true }) asks for nothing (for the second county when only one is compared).
//   loading - true until the rows for THE CURRENT county have arrived
//   error   - the error if the rows could not be loaded, otherwise null
//   retry   - asks for the rows again (for the Retry button of ErrorMessage)
import { useEffect, useState } from 'react';
import { getCounties, getProjections } from '../services/api';

export function useCounties() {
  const [counties, setCounties] = useState([]);

  // The county list is loaded once
  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    getCounties({ signal: controller.signal })
      .then((list) => {
        if (!ignore) setCounties(list);
      })
      .catch(() => {
        // Without the list the dropdowns are hidden; the comparison itself still works
      });
    return () => {
      ignore = true;
      controller.abort();
    };
  }, []);

  return counties;
}

export function useProjectionRows(slug, { skip = false } = {}) {
  const [attempt, setAttempt] = useState(0);
  // { key, rows } when it worked, or { key, error } when it failed
  const [result, setResult] = useState(null);

  const key = `${slug}|${attempt}`;

  useEffect(() => {
    if (skip) return undefined;
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
  }, [key, slug, skip]);

  // An answer only counts if it is for the county being shown now
  const current = result?.key === key ? result : null;

  return {
    rows: current?.rows ?? null,
    loading: !skip && current === null,
    error: current?.error ?? null,
    retry: () => setAttempt((count) => count + 1),
  };
}
