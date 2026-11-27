// Tests for the flood map (CCD-377): the starting level, the slider changing the layer and the km²
// counter, the notes under the map, zooming to the county, and the error with Retry.
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FloodMap from './FloodMap';
import { mockFlood } from '../mocks/flood';
import { getFlood } from '../services/api';
import { fakeMap } from '../test/fakeLeafletMap';

// Replace the real API call with a fake, so the tests never need the backend
vi.mock('../services/api', () => ({
  getFlood: vi.fn(),
}));

// The mock uses Cork's real numbers: 25.4745 km² at 0 m, 33.8418 at 0.5 m, 52.3017 at 2 m
function renderMap() {
  return render(<FloodMap slug="cork" countyName="Cork" />);
}

// The range slider. userEvent cannot drag a slider, so the tests set its value with fireEvent.change.
const slider = () => screen.getByRole('slider', { name: /Sea level rise/ });
const moveSliderTo = (index) => fireEvent.change(slider(), { target: { value: String(index) } });

describe('FloodMap', () => {
  beforeEach(() => {
    vi.mocked(getFlood).mockReset();
    vi.mocked(getFlood).mockImplementation((slug) => Promise.resolve(mockFlood(slug)));
    fakeMap.fitBounds.mockClear();
  });

  it('shows "Loading flood map…" while it waits', () => {
    vi.mocked(getFlood).mockReturnValue(new Promise(() => {})); // never finishes
    renderMap();
    expect(screen.getByText('Loading flood map…')).toBeTruthy();
  });

  it('starts at 0.5 m, with that layer on the map and the extra land in the counter', async () => {
    renderMap();

    expect((await screen.findByRole('slider', { name: /Sea level rise/ })).getAttribute('aria-valuetext')).toBe(
      '0.5 m',
    );
    expect(screen.getByTestId('flood-layer').getAttribute('src')).toBe('/mock-flood/cork/level_050.png');
    // 33.8418 - 25.4745 = 8.3673, shown as 8.4
    expect(screen.getByText('8.4 km²')).toBeTruthy();
    expect(screen.getByText(/more land under water in County Cork than at today's sea level/)).toBeTruthy();
    expect(screen.getByText(/33\.8 km² in total at 0\.5 m, 25\.5 km² at 0 m/)).toBeTruthy();
    expect(getFlood).toHaveBeenCalledWith('cork');
  });

  it('changes the layer and the counter when the slider moves', async () => {
    renderMap();
    await screen.findByRole('slider', { name: /Sea level rise/ });

    moveSliderTo(20); // the last level, 2 m
    expect(slider().getAttribute('aria-valuetext')).toBe('2.0 m');
    expect(screen.getByTestId('flood-layer').getAttribute('src')).toBe('/mock-flood/cork/level_200.png');
    // 52.3017 - 25.4745 = 26.8272, shown as 26.8
    expect(screen.getByText('26.8 km²')).toBeTruthy();

    moveSliderTo(0); // 0 m: nothing extra
    expect(screen.getByTestId('flood-layer').getAttribute('src')).toBe('/mock-flood/cork/level_000.png');
    expect(screen.getByText('0.0 km²')).toBeTruthy();
  });

  it('shows the 0 m and 2 m ends of the slider', async () => {
    renderMap();
    await screen.findByRole('slider', { name: /Sea level rise/ });
    expect(slider().getAttribute('min')).toBe('0');
    expect(slider().getAttribute('max')).toBe('20');
    expect(screen.getByText('0.0 m')).toBeTruthy();
    expect(screen.getByText('2.0 m')).toBeTruthy();
  });

  it('shows the model limits (without the pointer to our docs) and the credits', async () => {
    renderMap();
    await screen.findByRole('slider', { name: /Sea level rise/ });

    expect(screen.getByText(/No tides, storm surges or flood defences\./)).toBeTruthy();
    expect(screen.queryByText(/docs\/flood-engine\.md/)).toBeNull();
    expect(screen.getByText(/Copernicus WorldDEM-90/)).toBeTruthy();
    expect(screen.getByText(/Tailte Éireann, licensed CC BY 4\.0/)).toBeTruthy();
  });

  it('zooms the map to the corners of the flood layer', async () => {
    renderMap();
    await screen.findByRole('slider', { name: /Sea level rise/ });
    expect(fakeMap.fitBounds).toHaveBeenCalledWith(mockFlood('cork').bounds, { animate: false });
  });

  it('shows an error with Retry, and loads again when Retry is pressed', async () => {
    const user = userEvent.setup();
    vi.mocked(getFlood).mockRejectedValueOnce({ name: 'ApiError', status: 500 });
    renderMap();

    await user.click(await screen.findByRole('button', { name: /retry|try again/i }));

    expect(await screen.findByRole('slider', { name: /Sea level rise/ })).toBeTruthy();
    expect(getFlood).toHaveBeenCalledTimes(2);
  });
});