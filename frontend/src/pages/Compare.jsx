// The Compare page, /compare (CCD-207, CCD-378). Two things can be compared, chosen at the top:
//   - two scenarios in one county (components/ScenarioComparison.jsx), or
//   - two counties under one scenario (components/CountyComparison.jsx).
// Either way the page shows each side's projection, its change from the 1976-2005 baseline, and the
// difference between them (the second minus the first). The choices are kept in the URL (see
// hooks/useCompareView.js), so a shared link opens the same comparison.
import { ModeSwitch } from '../components/CompareControls';
import CountyComparison from '../components/CountyComparison';
import ScenarioComparison from '../components/ScenarioComparison';
import { useCounties } from '../hooks/useCompareData';
import useCompareView, { MODES } from '../hooks/useCompareView';
import '../styles/compare.css';

export default function Compare() {
  const view = useCompareView();
  const counties = useCounties();

  return (
    <main className="compare-page">
      <h1>Compare</h1>
      <p className="compare-page__intro">
        See how the climate is projected to change under two different emissions scenarios, or compare two
        counties under the same scenario, and how big the difference between them is.
      </p>
      <ModeSwitch mode={view.mode} modes={MODES} onChange={view.setMode} />
      {view.mode === 'counties' ? (
        <CountyComparison view={view} counties={counties} />
      ) : (
        <ScenarioComparison view={view} counties={counties} />
      )}
    </main>
  );
}
