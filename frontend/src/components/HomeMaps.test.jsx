// Tests for the maps on the home page: the scenarios side by side, the period slider and the county links.
// The API is a fake, so each map gets values we choose.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import HomeMaps from './HomeMaps';
import { getMap } from '../services/api';

vi.mock('../services/api', () => ({ getMap: vi.fn() }));

// Shows the address, so tests can read what the page wrote into the URL
function Address() {
  const { pathname, search } = useLocation();
  return <output data-testid="address">{pathname + search}</output>;
}

function renderMaps(address = '/') {
  return render(
    <MemoryRouter initialEntries={[address]}>
      <HomeMaps />
      <Address />
    </MemoryRouter>,
  );
}

// A short answer in the shape of GET /api/map/ for the given values { slug: number }
function answerWith(values) {
  const numbers = Object.values(values);
  return {
    variable: 'temperature',
    unit: 'degC',
    min: Math.min(...numbers).toFixed(3),
    max: Math.max(...numbers).toFixed(3),
    results: Object.entries(values).map(([slug, value]) => ({
      county: { name: slug[0].toUpperCase() + slug.slice(1), slug, has_coastline: true },
      value: value.toFixed(3),
      unit: 'degC',
    })),
  };
}

// The baseline is 9 to 10 degrees. At the end of the century each scenario is 1 degree warmer than the last
// (RCP2.6 is 10 to 11), and in mid-century each one is 1 degree cooler than at the end of the century.
const END_VALUES = {
  rcp26: { cork: 10, dublin: 11 },
  rcp45: { cork: 11, dublin: 12 },
  rcp85: { cork: 12, dublin: 13 },
};
const valuesFor = ({ scenario, period }) => {
  if (scenario === 'baseline') return { cork: 9, dublin: 10 };
  const end = END_VALUES[scenario];
  if (period === '2071-2100') return end;
  return { cork: end.cork - 1, dublin: end.dublin - 1 };
};

const asked = (choices) =>
  getMap.mock.calls.some(([sent]) => Object.entries(choices).every(([key, value]) => sent[key] === value));

async function settle() {
  await act(async () => {});
}

describe('HomeMaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMap.mockImplementation(async (sent) => answerWith(valuesFor(sent)));
  });

  it('shows a map for each scenario, all ticked, at the end of the century', async () => {
    renderMaps();
    await settle();

    expect(screen.getAllByRole('figure')).toHaveLength(3);
    for (const name of [/If the world cuts emissions/, /Middle path/, /If nothing is done/]) {
      expect(screen.getByRole('checkbox', { name }).checked).toBe(true);
    }
    expect(screen.getByText('Year: 2085')).toBeTruthy();
    expect(screen.getByRole('slider').value).toBe('2085');
  });

  it('asks the API for the three averages of every scenario, and for the baseline once', async () => {
    renderMaps();
    await settle();

    for (const scenario of ['rcp26', 'rcp45', 'rcp85']) {
      for (const period of ['2021-2050', '2071-2100']) {
        expect(asked({ variable: 'temperature', scenario, period, season: 'annual' })).toBe(true);
      }
    }
    const baselineAsks = getMap.mock.calls.filter(([sent]) => sent.period === '1976-2005');
    expect(baselineAsks).toHaveLength(1);
    expect(baselineAsks[0][0].scenario).toBe('baseline');
  });

  it('shows the numbers of the nearest average as the slider moves, and writes the year to the address', async () => {
    renderMaps();
    await settle();

    fireEvent.change(screen.getByRole('slider'), { target: { value: '2035' } });

    expect(screen.getByText('Year: 2035')).toBeTruthy();
    expect(screen.getByText(/nearest average: mid-century, 2021–2050/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cork, RCP8.5: 11.0 °C, open county page' })).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('address').textContent).toBe('/?year=2035'));
  });

  it('opens on the year in the address', async () => {
    renderMaps('/?year=1990');
    await settle();

    expect(screen.getByText('Year: 1990')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cork, RCP8.5: 9.0 °C, open county page' })).toBeTruthy();
  });

  it('blends the colours between two averages, so the slider moves the maps gradually', async () => {
    renderMaps();
    await settle();
    const cork = () => screen.getByRole('link', { name: /^Cork, RCP8.5/ }).style.fill;

    fireEvent.change(screen.getByRole('slider'), { target: { value: '2035' } });
    const midCentury = cork();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '2085' } });
    const endOfCentury = cork();
    fireEvent.change(screen.getByRole('slider'), { target: { value: '2060' } });
    const between = cork();

    expect(midCentury).not.toBe(endOfCentury);
    expect(between).not.toBe(midCentury);
    expect(between).not.toBe(endOfCentury);
  });

  it('moves to a period when its name under the slider is pressed', async () => {
    renderMaps();
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Baseline' }));

    expect(screen.getByRole('slider').value).toBe('1990');
    expect(screen.getByRole('button', { name: 'Baseline' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('link', { name: 'Cork, RCP8.5: 9.0 °C, open county page' })).toBeTruthy();
  });

  it('removes a map when its scenario is unticked, and writes that to the address', async () => {
    renderMaps();
    await settle();

    fireEvent.click(screen.getByRole('checkbox', { name: /If the world cuts emissions/ }));

    expect(screen.getAllByRole('figure')).toHaveLength(2);
    expect(screen.queryByText(/If the world cuts emissions \(RCP2.6\)$/, { selector: 'figcaption' })).toBeNull();
    expect(decodeURIComponent(screen.getByTestId('address').textContent)).toBe('/?rcp=45,85');
  });

  it('says so when no scenario is ticked, and shows all three again with one button', async () => {
    renderMaps('/?rcp=none');
    await settle();

    expect(screen.queryAllByRole('figure')).toHaveLength(0);
    expect(screen.getByText('No scenario selected')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Show all three' }));

    expect(screen.getAllByRole('figure')).toHaveLength(3);
    expect(screen.queryByText('No scenario selected')).toBeNull();
  });

  it('opens on the scenarios in the address', async () => {
    renderMaps('/?rcp=45');
    await settle();

    expect(screen.getAllByRole('figure')).toHaveLength(1);
    expect(screen.getByRole('checkbox', { name: /Middle path/ }).checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: /If nothing is done/ }).checked).toBe(false);
  });

  it('shows the county average of each map', async () => {
    renderMaps();
    await settle();

    expect(screen.getByText('county average 10.5 °C')).toBeTruthy(); // RCP2.6: (10 + 11) / 2
    expect(screen.getByText('county average 11.5 °C')).toBeTruthy();
    expect(screen.getByText('county average 12.5 °C')).toBeTruthy();
  });

  it('draws one colour scale from the coolest to the warmest map', async () => {
    renderMaps();
    await settle();

    expect(screen.getByText('9.0 °C')).toBeTruthy(); // coolest baseline county
    expect(screen.getByText('13.0 °C')).toBeTruthy(); // warmest RCP8.5 county
    expect(screen.getByText(/one colour scale for every scenario and year/i)).toBeTruthy();
  });

  it('colours a warmer county darker on the same scale', async () => {
    renderMaps();
    await settle();

    const cool = screen.getByRole('link', { name: 'Cork, RCP2.6: 10.0 °C, open county page' });
    const warm = screen.getByRole('link', { name: 'Dublin, RCP8.5: 13.0 °C, open county page' });
    expect(cool.style.fill).not.toBe(warm.style.fill);
  });

  it('makes every county a link, named with its scenario and value', async () => {
    renderMaps();
    await settle();

    const maps = screen.getByRole('region', { name: 'County maps' });
    expect(within(maps).getAllByRole('link')).toHaveLength(26 * 3);
    expect(screen.getByRole('link', { name: 'Cork, RCP8.5: 12.0 °C, open county page' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Kerry, RCP8.5: no value, open county page' })).toBeTruthy();
  });

  it('opens the county page when a county is clicked, or Enter is pressed on it', async () => {
    renderMaps();
    await settle();

    fireEvent.click(screen.getByRole('link', { name: /^Cork, RCP8.5/ }));
    expect(screen.getByTestId('address').textContent).toBe('/county/cork');

    fireEvent.keyDown(screen.getByRole('link', { name: /^Dublin, RCP4.5/ }), { key: 'Enter' });
    expect(screen.getByTestId('address').textContent).toBe('/county/dublin');
  });

  it('shows the hovered county with its value on every map shown', async () => {
    renderMaps();
    await settle();
    expect(screen.getByText(/Hover a county to see its values/)).toBeTruthy();

    fireEvent.mouseMove(screen.getByRole('link', { name: /^Cork, RCP8.5/ }), { clientX: 10, clientY: 10 });

    expect(screen.getByText('Cork: RCP2.6 10.0 °C · RCP4.5 11.0 °C · RCP8.5 12.0 °C')).toBeTruthy();
  });

  it('says a map could not be loaded, and still shows the others', async () => {
    getMap.mockImplementation(async (sent) => {
      const { scenario, period } = sent;
      if (scenario === 'rcp45' && period === '2071-2100') throw Object.assign(new Error('boom'), { name: 'ApiError', status: 500 });
      return answerWith(valuesFor(sent));
    });
    renderMaps();
    await settle();

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Cork, RCP8.5: 12.0 °C, open county page' })).toBeTruthy();
  });

  it('shows Loading on each map until its values arrive', () => {
    getMap.mockReturnValue(new Promise(() => {}));
    renderMaps();

    expect(screen.getAllByText('Loading map data…')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Cork, RCP8.5, open county page' })).toBeTruthy();
  });

  it('switches Play to Pause and back', async () => {
    renderMaps();
    await settle();

    fireEvent.click(screen.getByRole('button', { name: /Play/ }));
    expect(screen.getByRole('button', { name: /Pause/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Pause/ }));
    expect(screen.getByRole('button', { name: /Play/ })).toBeTruthy();
  });
});
