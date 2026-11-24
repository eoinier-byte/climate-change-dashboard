// "Share image" button (CCD-392): saves a picture (PNG) of part of the page, so someone can send it to a friend
// or put it in a document. It is used under the warming stripes and under the home page maps.
//
// Props:
//   targetRef - a React ref (useRef) on the element to photograph, e.g. the stripes or the map with its legend.
//               The labels (title, scenario names, periods, legend, source) are part of that element,
//               so they are in the picture too.
//   filename  - the name of the downloaded file, without ".png", e.g. "warming-stripes-cork"
//   label     - the button text (default "Share image")
//
// The picture is made in the browser by the html-to-image library. Anything marked data-share-exclude (for
// example the line that shows the hovered county on the home page maps) is left out of it.
import { useState } from 'react';
import { toPng } from 'html-to-image';
import '../styles/share-image.css';

// Leaves out anything that is only for the screen, such as hover text.
// (Text pieces of the page have no "matches", so they are always kept.)
function withoutMarked(node) {
  return !(node.matches && node.matches('[data-share-exclude]'));
}

// Saves the picture as a file: a hidden link is made and clicked, like pressing a download link
function download(dataUrl, filename) {
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = dataUrl;
  // Some browsers (older Firefox) only follow a link that is on the page
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export default function ShareImage({ targetRef, filename, label = 'Share image' }) {
  // '' (nothing yet), 'working', 'done' or 'failed'
  const [status, setStatus] = useState('');

  async function handleClick() {
    const node = targetRef.current;
    if (!node) {
      setStatus('failed');
      return;
    }
    setStatus('working');
    try {
      const dataUrl = await toPng(node, {
        // The page behind the stripes is white, but a PNG would be see-through without this
        backgroundColor: '#ffffff',
        // Twice the pixels, so the text stays sharp when the picture is shared or printed
        pixelRatio: 2,
        filter: withoutMarked,
      });
      download(dataUrl, filename);
      setStatus('done');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <div className="share-image">
      <button type="button" className="btn btn--secondary" onClick={handleClick} disabled={status === 'working'}>
        {label}
      </button>
      {/* role="status" makes screen readers announce the message when it appears */}
      <p role="status" className="share-image__status">
        {status === 'working' && 'Preparing the image…'}
        {status === 'done' && 'Image downloaded.'}
        {status === 'failed' && "Couldn't make the image. Please try again."}
      </p>
    </div>
  );
}
