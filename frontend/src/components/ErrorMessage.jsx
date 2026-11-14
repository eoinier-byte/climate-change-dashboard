// A shared error message with a Retry button, for any page that calls the API (CCD-146).
//
// Props:
//   error   - what went wrong. Usually the ApiError from services/api.js (see below).
//   onRetry - function that sends the request again. If it is not given, no button is shown.
//
// It never shows the error's own text ("API error 500 for /counties/", "Failed to fetch") or a
// stack trace. It picks a plain-language message from error.status instead:
//   null (the server could not be reached) -> check your connection
//   404                                    -> that data could not be found
//   500 or above                           -> the server had a problem
//   anything else                          -> a general message
//
// It looks at error.name and error.status instead of importing ApiError, so it keeps working
// in tests that replace services/api.js with fakes.
import '../styles/error-message.css';

const MESSAGES = {
  network: 'We could not reach the server. Check your internet connection and try again.',
  notFound: 'We could not find that information. It may have moved, or the address may be wrong.',
  server: 'The server had a problem and could not send the data. Please try again in a moment.',
  other: 'Something went wrong while loading the data. Please try again.',
};

function messageFor(error) {
  const isApiError = error?.name === 'ApiError';
  if (isApiError && error.status === null) return MESSAGES.network;
  if (isApiError && error.status === 404) return MESSAGES.notFound;
  if (isApiError && error.status >= 500) return MESSAGES.server;
  return MESSAGES.other;
}

export default function ErrorMessage({ error, onRetry }) {
  return (
    // role="alert" makes a screen reader read the message out as soon as it appears
    <div className="error-message" role="alert">
      <p className="error-message__text">{messageFor(error)}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
