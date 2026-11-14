// Tests for the shared Loading indicator (CCD-145).
import { useEffect, useState } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Loading from './Loading';

describe('Loading', () => {
  it('is a status, so screen readers announce it, with a default message', () => {
    render(<Loading />);

    expect(screen.getByRole('status').textContent).toBe('Loading…');
  });

  it('shows the message it is given, and nothing else', () => {
    render(<Loading message="Loading county data…" />);

    // The spinner is decoration only, so the status text is exactly the message
    expect(screen.getByRole('status').textContent).toBe('Loading county data…');
  });

  it('hides the spinner from screen readers', () => {
    const { container } = render(<Loading />);

    expect(container.querySelector('.loading__spinner').getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Loading on a page that waits for data', () => {
  // A tiny page: Loading while the request is pending, the data (and only then the chart) after
  function Page({ load }) {
    const [data, setData] = useState(null);
    useEffect(() => {
      load().then(setData);
    }, [load]);

    if (!data) return <Loading message="Loading the map…" />;
    return <p>{data}</p>;
  }

  it('shows while the request is pending and disappears when the data arrives', async () => {
    let finish;
    const load = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    render(<Page load={load} />);

    // Pending: Loading is on screen and the data is not
    expect(screen.getByRole('status').textContent).toBe('Loading the map…');
    expect(screen.queryByText('Map data')).toBeNull();

    // The data arrives: it replaces Loading
    finish('Map data');
    expect(await screen.findByText('Map data')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
