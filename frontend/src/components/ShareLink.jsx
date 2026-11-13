// "Copy link to this view" button for the county page actions (CCD-180).
// The URL already holds the county, scenarios and period (CCD-406),
// so copying it lets someone else open exactly the same view.
import { useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function ShareLink() {
  // The current page and its "?..." settings, e.g. /county/cork?rcp=85
  const location = useLocation();
  // '' (nothing yet), 'copied' or 'failed'
  const [status, setStatus] = useState('');

  // The full address, e.g. https://our-site/county/cork?rcp=85
  const link = `${window.location.origin}${location.pathname}${location.search}`;

  function handleClick() {
    // navigator.clipboard only exists on https (or localhost); fall back to a message otherwise
    if (!navigator.clipboard) {
      setStatus('failed');
      return;
    }
    navigator.clipboard
      .writeText(link)
      .then(() => setStatus('copied'))
      .catch(() => setStatus('failed'));
  }

  return (
    <div className="share-link">
      <button type="button" className="btn btn--secondary" onClick={handleClick}>
        Copy link to this view
      </button>
      {/* role="status" makes screen readers announce the message when it appears */}
      <p role="status" className="share-link__status">
        {status === 'copied' && 'Link copied.'}
        {status === 'failed' && "Couldn't copy the link. Copy it from the address bar instead."}
      </p>
    </div>
  );
}