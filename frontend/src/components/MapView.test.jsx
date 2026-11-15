// Tests for the county map (CCD-379). Leaflet is replaced by a stand-in in src/test/setup.jsx.
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MapView from './MapView';
import { fakeMap } from '../test/fakeLeafletMap';

describe('MapView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('draws a map with the outlines of all 26 counties', () => {
    render(<MapView />);
    expect(screen.getByTestId('map')).toBeTruthy();
    expect(screen.getByTestId('county-outlines').dataset.counties).toBe('26');
  });

  it('credits Tailte Éireann for the boundaries, as the licence requires', () => {
    render(<MapView />);
    expect(screen.getByText(/Tailte Éireann/)).toBeTruthy();
    expect(screen.getByText(/CC BY 4\.0/)).toBeTruthy();
  });

  it('re-measures the map and zooms to fit the whole of Ireland', () => {
    render(<MapView />);
    expect(fakeMap.invalidateSize).toHaveBeenCalled();
    const [bounds] = fakeMap.fitBounds.mock.calls[0];
    expect(bounds).toEqual([
      [51.35, -10.75],
      [55.5, -5.9],
    ]);
  });
});
