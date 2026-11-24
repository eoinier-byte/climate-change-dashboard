// The warming stripes with a "Share image" button under them (CCD-392).
// The button saves a PNG of the stripes with their labels (county, scenario names, periods, source).
//
// Props:
//   series   - the annual temperature series with ALL scenarios, as for WarmingStripes
//   selected - the ticked scenarios, e.g. ['rcp26', 'rcp85']
//   slug     - the county's slug, e.g. "cork", used in the file name (warming-stripes-cork.png)
import { useRef } from 'react';
import ShareImage from './ShareImage';
import WarmingStripes from './WarmingStripes';
import { buildStripes } from './stripeColors';

export default function ShareableStripes({ series, selected, slug }) {
  // The element that is photographed: the stripes and their labels, without the button
  const stripesRef = useRef(null);

  // Nothing to draw (no scenario ticked, or no data): no stripes, so no button for a blank picture
  const stripes = buildStripes(series, selected);
  if (!stripes || stripes.rows.length === 0) return null;

  return (
    <>
      <div ref={stripesRef}>
        <WarmingStripes series={series} selected={selected} />
      </div>
      <div className="share-actions">
        <ShareImage targetRef={stripesRef} filename={`warming-stripes-${slug}`} />
      </div>
    </>
  );
}
