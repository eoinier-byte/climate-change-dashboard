// Loads the map values for one choice of variable, scenario and period (CCD-380).
//
//   const { data, loading, error, retry } = useMapData('temperature', 'rcp85', '2071-2100');
//
//   data    - the answer of GET /api/map/: { unit, min, max, results: [one value per county] },
//             or null while loading or after an error
//   loading - true until the answer for THE CURRENT choice has arrived
//   error   - the ApiError if the request failed, otherwise null
//   retry   - function that asks again (for the Retry button of ErrorMessage)
//
// season is the fourth choice the endpoint needs. It defaults to "annual" until the map has a
// season control.
//
// When the choice changes (the slider moves, another scenario is clicked) the request for the old
// choice is cancelled, and if its answer still arrives late it is ignored, so the map can never
// show values for a choice that is no longer selected.
import { useEffect, useState } from 'react';
import { getMap } from '../services/api';

export default function useMapData(variable, scenario, period, season = 'annual') {
  // Bumped by retry(), so the same choice is requested again
  const [attempt, setAttempt] = useState(0);

  // The last answer, saved together with the key of the choice it was for.
  // { key, data } when it worked, or { key, error } when it failed.
  const [result, setResult] = useState(null);

  // One text that names the current choice and attempt, e.g. "temperature|rcp85|2071-2100|annual|0"
  const key = [variable, scenario, period, season, attempt].join('|');

  useEffect(() => {
    // "ignore" stops an old answer from overwriting a newer one
    let ignore = false;
    const controller = new AbortController();

    getMap({ variable, scenario, period, season }, { signal: controller.signal })
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
  }, [key, variable, scenario, period, season]);

  // An answer only counts if it is for the choice being shown now
  const current = result?.key === key ? result : null;

  return {
    data: current?.data ?? null,
    loading: current === null,
    error: current?.error ?? null,
    retry: () => setAttempt((count) => count + 1),
  };
}
