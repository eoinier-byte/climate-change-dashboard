// "Choose a county" dropdown for the county dashboard (CCD-159, CCD-166).
// Loads the 26 counties from GET /api/counties/ and opens the chosen county's page,
// so every chart on the page switches to that county.
// Props: "currentSlug" is the county being shown now, e.g. "cork".
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCounties } from '../services/api';
import { countyPath } from '../routes';

export default function CountySelect({ currentSlug }) {
  // The list of counties from the API: [{ name: 'Carlow', slug: 'carlow', ... }, ...]
  const [counties, setCounties] = useState([]);
  // useNavigate gives us a function that changes the page, like clicking a link
  const navigate = useNavigate();
  // useLocation gives the current URL, so we can keep its "?..." part when switching county
  const location = useLocation();

  // Load the list once, when the dropdown first appears
  useEffect(() => {
    let ignore = false; // stops a late answer updating a dropdown that has gone

    getCounties()
      .then((list) => {
        if (!ignore) setCounties(list);
      })
      .catch(() => {
        // If the list can't load, the dropdown stays hidden. The page still works.
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Nothing to choose from yet (still loading, or the API failed)
  if (counties.length === 0) return null;

  // When a county is picked, open its page, e.g. /county/kerry.
  // location.search is the "?rcp=...&period=..." part of the URL (CCD-406):
  // keeping it means the chosen scenarios and period stay the same for the new county.
  function handleChange(event) {
    navigate({ pathname: countyPath(event.target.value), search: location.search });
  }

  // If the URL has a county that is not in the list (e.g. /county/atlantis),
  // show the "Choose a county" option instead of a wrong county
  const known = counties.some((county) => county.slug === currentSlug);

  return (
    <div className="county-select">
      {/* htmlFor links the label to the dropdown, for screen readers and clicking */}
      <label htmlFor="county-select">Choose a county</label>
      <select id="county-select" value={known ? currentSlug : ''} onChange={handleChange}>
        {!known && (
          <option value="" disabled>
            Select…
          </option>
        )}
        {counties.map((county) => (
          <option key={county.slug} value={county.slug}>
            {county.name}
          </option>
        ))}
      </select>
    </div>
  );
}