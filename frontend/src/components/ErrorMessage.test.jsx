// Tests for the shared ErrorMessage (CCD-146).
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ErrorMessage from './ErrorMessage';

// Looks like the error services/api.js throws (name "ApiError" and a status),
// without importing it, so these tests don't depend on the API module
function apiError(status, message) {
  const error = new Error(message);
  error.name = 'ApiError';
  error.status = status;
  return error;
}

// [what happened, the error, what the person should read]
const cases = [
  ['the network fails', apiError(null, 'Could not reach the server. Check your connection and try again.'), /could not reach the server/i],
  ['the data is not found (404)', apiError(404, 'API error 404 for /counties/atlantis/'), /could not find that information/i],
  ['the server fails (500)', apiError(500, 'API error 500 for /counties/'), /server had a problem/i],
  ['the server is unavailable (503)', apiError(503, 'API error 503 for /counties/'), /server had a problem/i],
  ['the status is not one we know (400)', apiError(400, 'API error 400 for /map/'), /something went wrong/i],
  ['the error is not an ApiError at all', new TypeError('x is undefined'), /something went wrong/i],
  ['there is no error object', undefined, /something went wrong/i],
];

describe('ErrorMessage', () => {
  it.each(cases)('shows a suitable message when %s', (_what, error, expected) => {
    render(<ErrorMessage error={error} onRetry={() => {}} />);

    expect(screen.getByRole('alert').textContent).toMatch(expected);
  });

  it('never shows the raw error text or a stack trace', () => {
    const error = apiError(500, 'API error 500 for /counties/');
    error.stack = 'Error: boom\n    at apiGet (api.js:30:11)';
    render(<ErrorMessage error={error} onRetry={() => {}} />);

    const text = screen.getByRole('alert').textContent;
    expect(text).not.toMatch(/API error/);
    expect(text).not.toMatch(/\/counties\//);
    expect(text).not.toMatch(/at apiGet|api\.js/);
  });

  it('never shows the browser\'s raw network message', () => {
    render(<ErrorMessage error={new TypeError('Failed to fetch')} onRetry={() => {}} />);

    expect(screen.getByRole('alert').textContent).not.toMatch(/Failed to fetch/);
  });

  it('has a Retry button that calls onRetry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorMessage error={apiError(500, 'x')} onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows no Retry button when there is nothing to retry', () => {
    render(<ErrorMessage error={apiError(404, 'x')} />);

    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});

describe('ErrorMessage with a page that retries', () => {
  // A tiny page: it starts with an error, and Retry asks for the data again
  function Page({ load }) {
    const [data, setData] = useState(null);
    if (data) return <p>{data}</p>;
    return <ErrorMessage error={apiError(null, 'x')} onRetry={() => load().then(setData)} />;
  }

  it('Retry sends the request again, and the data replaces the message', async () => {
    const user = userEvent.setup();
    const load = vi.fn().mockResolvedValue('County data loaded');
    render(<Page load={load} />);
    expect(load).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('County data loaded')).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
