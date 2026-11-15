// One cell of the Compare table (CCD-207, CCD-378): what one side projects, and how far that is from its
// baseline, e.g. "10.5 °C" with "+0.73 °C from baseline" under it. "No data" if the API has no row.
// Props: projected ({ value, change } or null), measure (one object from compareData.js)
import { formatChange, formatValue } from './compareData';

export default function ProjectedCell({ projected, measure }) {
  if (!projected) return <td>No data</td>;
  return (
    <td>
      <span className="compare-table__value">{formatValue(projected.value, measure)}</span>
      <span className="compare-table__change">{formatChange(projected.change, measure)} from baseline</span>
    </td>
  );
}
