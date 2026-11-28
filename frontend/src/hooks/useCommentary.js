// Loads the AI-written summary for one county and scenario (CCD-285).
//
//   const { commentary, loading } = useCommentary('cork', 'rcp45');
//
//   commentary - the texts { summary, temperature, precipitation, scenarios, analogue, sea_level },
//                or null while loading or when none is available
//   loading    - true until the answer for THE CURRENT county and scenario has arrived
//
// The summary is optional, so there is no error to show: a 503 (none available right now) or any other
// failure just gives commentary: null and the page hides the block.
// Works like useAnalogues: a change of county or scenario cancels the old request, and a late answer for
// an old choice is ignored.
import { useEffect, useState } from 'react';
import { getCommentary } from '../services/api';

export default function useCommentary(slug, scenario) {
  // The last answer, saved with the key of the choice it was for: { key, commentary } (commentary is null on failure)
  const [result, setResult] = useState(null);
  const key = `${slug}|${scenario}`;

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    getCommentary(slug, scenario, { signal: controller.signal })
      .then((data) => {
        if (!ignore) setResult({ key, commentary: data?.commentary ?? null });
      })
      .catch(() => {
        if (!ignore) setResult({ key, commentary: null });
      });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [key, slug, scenario]);

  const current = result?.key === key ? result : null;
  return { commentary: current?.commentary ?? null, loading: current === null };
}
