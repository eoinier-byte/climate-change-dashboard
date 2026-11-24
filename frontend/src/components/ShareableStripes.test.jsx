// Tests for the warming stripes with their "Share image" button (CCD-392).
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toPng } from 'html-to-image';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShareableStripes from './ShareableStripes';
import { buildSeries } from './countyChartData';
import { mockCorkRows } from '../mocks/countyRows';

vi.mock('html-to-image', () => ({ toPng: vi.fn() }));

const series = buildSeries(mockCorkRows, 'Cork', 'temperature');

let downloads;

beforeEach(() => {
  toPng.mockReset();
  downloads = [];
  // jsdom cannot download, so clicking the hidden link is recorded instead
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    downloads.push(this.download);
  });
});

afterEach(() => vi.restoreAllMocks());

describe('ShareableStripes', () => {
  it('shows the stripes with a Share image button under them', () => {
    render(<ShareableStripes series={series} selected={['rcp85']} slug="cork" />);
    expect(screen.getByRole('heading', { level: 3, name: 'Warming stripes for Cork' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share image' })).toBeTruthy();
  });

  it('saves the stripes with their labels, named after the county', async () => {
    toPng.mockResolvedValue('data:image/png;base64,AAA');
    const user = userEvent.setup();
    render(<ShareableStripes series={series} selected={['rcp85']} slug="cork" />);

    await user.click(screen.getByRole('button', { name: 'Share image' }));
    await screen.findByText('Image downloaded.');

    // What is photographed holds the labels (county, scenario, periods, source) but not the button itself
    const photographed = toPng.mock.calls[0][0];
    expect(within(photographed).getByRole('heading', { name: 'Warming stripes for Cork' })).toBeTruthy();
    expect(within(photographed).getByText('RCP8.5')).toBeTruthy();
    expect(within(photographed).getByText('Source: Climate Ireland TRANSLATE.')).toBeTruthy();
    expect(within(photographed).queryByRole('button')).toBeNull();
    expect(downloads).toEqual(['warming-stripes-cork.png']);
  });

  it('shows neither stripes nor a button when no scenario is ticked', () => {
    render(<ShareableStripes series={series} selected={[]} slug="cork" />);
    expect(screen.queryByRole('button', { name: 'Share image' })).toBeNull();
    expect(screen.queryByRole('heading', { name: /Warming stripes/ })).toBeNull();
  });

  it('shows nothing when there is no series', () => {
    render(<ShareableStripes series={null} selected={['rcp85']} slug="cork" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
