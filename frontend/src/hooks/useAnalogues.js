// Loads the climate analogues for one county, scenario and period (CCD-151, CCD-373).
//
//   const { data, loading, error, retry } = useAnalogues('cork', 'rcp85', '2071-2100');
//
//   data    - the answer of GET /api/counties/{slug}/analogues/: a list of up to three cities,
//             closest first, or null while loading or after an error
//   loading - true until the answer for THE CURRENT choice has arrived
//   error   - the ApiError if the request failed, otherwise null
//   retry   - function that asks again (for the Retry button of ErrorMessage)
//
// It works the same way as useMapData: when the county, scenario or period changes, the old request
// is cancelled, and a late answer for an old choice is ignored.
import { useEffect, useState } from 'react';
import { getAnalogues } from '../services/api';

export default function useAnalogues(slug, scenario, period) {
  // Bumped by retry(), so the same choice is requested again
  const [attempt, setAttempt] = useState(0);

  // The last answer, saved together with the key of the choice it was for.
  // { key, data } when it worked, or { key, error } when it failed.
  const [result, setResult] = useState(null);

  // One text that names the current choice and attempt, e.g. "cork|rcp85|2071-2100|0"
  const key = [slug, scenario, period, attempt].join('|');

  useEffect(() => {
    // "ignore" stops an old answer from overwriting a newer one
    let ignore = false;
    const controller = new AbortController();

    getAnalogues(slug, { scenario, period }, { signal: controller.signal })
      .then((data) => {
        if (!ignore) setResult({ key, data });
      })
      .catch((error) => {
        if (!ignore) setResult({ key, error });
      });

    // React runs this when the choice changes or the page closes
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [key, slug, scenario, period]);

  // An answer only counts if it is for the choice being shown now
  const current = result?.key === key ? result : null;

  return {
    data: current?.data ?? null,
    loading: current === null,
    error: current?.error ?? null,
    retry: () => setAttempt((count) => count + 1),
  };
}