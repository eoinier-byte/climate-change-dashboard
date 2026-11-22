// The Compare section of the home page (under the maps): the interactive comparison in CompareExplorer.
// Props: prefix, see hooks/useExplorerView.js
import CompareExplorer from './CompareExplorer';
import '../styles/compare.css';

export default function CompareSection({ prefix = '' }) {
  return <CompareExplorer prefix={prefix} />;
}
