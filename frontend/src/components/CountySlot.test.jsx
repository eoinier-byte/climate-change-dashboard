// Tests for the reserved slots on the county page (CCD-180).
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CountySlot from './CountySlot';

describe('CountySlot', () => {
  afterEach(() => {
    vi.unstubAllEnvs(); // put import.meta.env back after tests that change it
  });

  it('shows the block put inside it, under its heading', () => {
    render(
      <CountySlot name="stripes" title="Warming stripes" story="CCD-374">
        <p>The stripes</p>
      </CountySlot>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Warming stripes' })).toBeTruthy();
    expect(screen.getByText('The stripes')).toBeTruthy();
  });

  it('shows a "reserved" box while developing when it is empty', () => {
    vi.stubEnv('DEV', true);
    const { container } = render(<CountySlot name="stripes" title="Warming stripes" story="CCD-374" />);

    expect(screen.getByText(/Reserved for CCD-374/)).toBeTruthy();
    expect(container.querySelector('[data-slot="stripes"]')).toBeTruthy();
  });

  it('shows nothing on the real site when it is empty', () => {
    vi.stubEnv('DEV', false);
    const { container } = render(<CountySlot name="stripes" title="Warming stripes" story="CCD-374" />);

    expect(container.innerHTML).toBe('');
  });
});