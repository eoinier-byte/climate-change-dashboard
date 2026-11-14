// Tests for the "Copy link to this view" button (CCD-180).
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ShareLink from './ShareLink';
import { renderWithRouter } from '../test/renderWithRouter';

// Shared helper (CCD-417): draws ShareLink as if the browser were at "url"
function renderAt(url) {
  renderWithRouter(<ShareLink />, { url });
}

describe('ShareLink', () => {
  it('copies the full link, including the chosen scenarios and period', async () => {
    // userEvent.setup() gives the test browser a pretend clipboard we can read back
    const user = userEvent.setup();
    renderAt('/county/cork?rcp=85&period=2021-2050');

    await user.click(screen.getByRole('button', { name: 'Copy link to this view' }));

    const copied = await navigator.clipboard.readText();
    expect(copied).toBe(`${window.location.origin}/county/cork?rcp=85&period=2021-2050`);
    expect(screen.getByRole('status').textContent).toBe('Link copied.');
  });

  it('says nothing until the button is clicked', () => {
    renderAt('/county/cork');
    expect(screen.getByRole('status').textContent).toBe('');
  });
});