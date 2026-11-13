// Tests for the county dashboard page (CCD-149, CCD-142, CCD-143, CCD-407, CCD-406).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CountyDashboard from './CountyDashboard';
import { getCounties, getCounty, getProjections, getSeaLevel } from '../services/api';
import { mockCork, mockCorkRows } from '../mocks/countyRows';
import { mockSeaLevelCork } from '../mocks/seaLevel';
import { ROUTES, countyPath } from '../routes';

// Replace the real API calls with fakes, so the tests never need the backend
vi.mock('../services/api', () => ({
  getCounties: vi.fn(),
  getCounty: vi.fn(),
  getProjections: vi.fn(),
  getSeaLevel: vi.fn(),
}));

// The test browser (jsdom) cannot draw on a <canvas>, so swap the real charts
// for simple placeholders that keep the chart's title as their label.
// data-lines lists the scenario names the chart would draw, e.g. "RCP2.6,RCP8.5".
vi.mock('react-chartjs-2', () => ({
  Line: (props) => (
    <div
      data-testid="line-chart"
      aria-label={props['aria-label']}
      data-lines={props.data.datasets.map((d) => d.label).join(',')}
    />
  ),
  Bar: (props) => (
    <div
      data-testid="bar-chart"
      aria-label={props['aria-label']}
      data-lines={props.data.datasets.map((d) => d.label).join(',')}
    />
  ),
}));

// Shows the "?..." part of the current URL, so a test can check what the page wrote there
function CurrentSearch() {
  return <p data-testid="current-search">{useLocation().search}</p>;
}

// Opens the page at /county/<slug><search>, the same way the real app does,
// e.g. renderCounty('cork', '?rcp=85')
function renderCounty(slug = 'cork', search = '') {
  render(
    <MemoryRouter initialEntries={[countyPath(slug) + search]}>
      <Routes>
        <Route
          path={ROUTES.county}
          element={
            <>
              <CountyDashboard />
              <CurrentSearch />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CountyDashboard', () => {
  // Start every test with fresh fakes that return Cork's data
  beforeEach(() => {
    vi.clearAllMocks();
    getCounties.mockResolvedValue([mockCork, { id: 8, name: 'Kerry', slug: 'kerry', has_coastline: true }]);
    getCounty.mockResolvedValue(mockCork);
    getProjections.mockResolvedValue(mockCorkRows);
    getSeaLevel.mockResolvedValue(mockSeaLevelCork);
  });

  it('shows the "Choose a county" dropdown with the current county selected (CCD-159, CCD-166)', async () => {
    renderCounty('cork');
    const dropdown = await screen.findByRole('combobox', { name: 'Choose a county' });
    expect(dropdown.value).toBe('cork');
  });

  it('loads the new county when another one is chosen', async () => {
    const user = userEvent.setup();
    renderCounty('cork');
    const dropdown = await screen.findByRole('combobox', { name: 'Choose a county' });

    await user.selectOptions(dropdown, 'kerry');

    // The page asks the API for Kerry's data
    await vi.waitFor(() => expect(getCounty).toHaveBeenCalledWith('kerry'));
    expect(getProjections).toHaveBeenCalledWith({ county: 'kerry' });
  });

  it('shows a loading message first', () => {
    renderCounty();
    expect(screen.getByRole('status').textContent).toBe('Loading county data…');
  });

  it('asks the API for the county and its projections using the slug from the URL', async () => {
    renderCounty('cork');
    await screen.findByRole('heading', { level: 1, name: 'Cork' });

    expect(getCounty).toHaveBeenCalledWith('cork');
    expect(getProjections).toHaveBeenCalledWith({ county: 'cork' });
  });

  it("shows today's temperature and rainfall from the county summary", async () => {
    renderCounty();
    await screen.findByRole('heading', { level: 1, name: 'Cork' });

    expect(screen.getByText('9.8 °C')).toBeTruthy();
    expect(screen.getByText('1,369 mm')).toBeTruthy();
  });

  it('shows the annual and seasonal charts for temperature and rainfall, and the sea-level chart', async () => {
    renderCounty();
    await screen.findByRole('heading', { level: 1, name: 'Cork' });

    const lineCharts = screen.getAllByTestId('line-chart').map((chart) => chart.getAttribute('aria-label'));
    expect(lineCharts).toEqual([
      'Temperature in Cork (annual), °C',
      'Precipitation in Cork (annual), mm',
      "Sea-level rise at Cork's coast, cm", // CCD-407
    ]);

    // Seasonal temperature (CCD-157) comes first, in the Temperature section
    const barCharts = screen.getAllByTestId('bar-chart').map((chart) => chart.getAttribute('aria-label'));
    expect(barCharts).toEqual([
      'Change in temperature by season in Cork, 2071-2100 (°C)',
      'Change in precipitation by season in Cork, 2071-2100 (%)',
    ]);
  });

  it('shows all three scenarios on every chart to start with (CCD-158, CCD-165)', async () => {
    renderCounty();
    await screen.findByRole('heading', { level: 1, name: 'Cork' });

    const charts = [...screen.getAllByTestId('line-chart'), ...screen.getAllByTestId('bar-chart')];
    expect(charts).toHaveLength(5); // 3 line charts (incl. sea level) + 2 bar charts
    charts.forEach((chart) => expect(chart.getAttribute('data-lines')).toBe('RCP2.6,RCP4.5,RCP8.5'));
  });

  it('hides a scenario on every chart when its box is unticked', async () => {
    const user = userEvent.setup();
    renderCounty();
    await screen.findByRole('heading', { level: 1, name: 'Cork' });

    await user.click(screen.getByRole('checkbox', { name: /^RCP4\.5/ }));

    const charts = [...screen.getAllByTestId('line-chart'), ...screen.getAllByTestId('bar-chart')];
    charts.forEach((chart) => expect(chart.getAttribute('data-lines')).toBe('RCP2.6,RCP8.5'));
  });

  it('restores the scenarios from the URL (CCD-406)', async () => {
    renderCounty('cork', '?rcp=26,85');
    await screen.findByRole('heading', { level: 1, name: 'Cork' });

    expect(screen.getByRole('checkbox', { name: /^RCP4\.5/ }).checked).toBe(false);
    const charts = [...screen.getAllByTestId('line-chart'), ...screen.getAllByTestId('bar-chart')];
    charts.forEach((chart) => expect(chart.getAttribute('data-lines')).toBe('RCP2.6,RCP8.5'));
  });

  it('writes the scenarios into the URL when a box is unticked (CCD-406)', async () => {
    const user = userEvent.setup();
    renderCounty('cork');
    await screen.findByRole('heading', { level: 1, name: 'Cork' });

    await user.click(screen.getByRole('checkbox', { name: /^RCP4\.5/ }));

    expect(screen.getByTestId('current-search').textContent).toBe('?rcp=26%2C85');
  });

  it('shows the seasonal charts for the period in the URL, and writes a new choice there (CCD-406)', async () => {
    const user = userEvent.setup();
    renderCounty('cork');
    await screen.findByRole('heading', { level: 1, name: 'Cork' });

    // Default: end of century, so both seasonal charts are for 2071-2100
    expect(screen.getByRole('radio', { name: 'End of century (2071-2100)' }).checked).toBe(true);
    expect(screen.getAllByTestId('bar-chart')).toHaveLength(2);

    await user.click(screen.getByRole('radio', { name: 'Mid-century (2021-2050)' }));

    expect(screen.getByTestId('current-search').textContent).toBe('?period=2021-2050');
    // The mock data only has seasonal rows for 2071-2100, so 2021-2050 shows the "no data" message.
    // That proves the charts now ask for the chosen period.
    expect(screen.queryAllByTestId('bar-chart')).toHaveLength(0);
    expect(screen.getAllByText('No seasonal data is available for this selection.')).toHaveLength(2);
  });

  it('asks the API for the sea level of the county in the URL (CCD-407)', async () => {
    renderCounty('cork');
    await screen.findByRole('heading', { level: 1, name: 'Cork' });
    expect(getSeaLevel).toHaveBeenCalledWith('cork');
  });

  it('still shows the page if only the sea level fails to load', async () => {
    getSeaLevel.mockRejectedValue(new Error('API error 500 for /sea-level/cork/'));
    renderCounty();

    expect(await screen.findByRole('heading', { level: 1, name: 'Cork' })).toBeTruthy();
    expect(screen.getByText('No sea-level data is available for this county.')).toBeTruthy();
  });

  it('shows "County not found" for an unknown county', async () => {
    getCounty.mockRejectedValue(new Error('API error 404 for /counties/atlantis/'));
    renderCounty('atlantis');

    expect(await screen.findByRole('heading', { level: 1, name: 'County not found' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the map' }).getAttribute('href')).toBe(ROUTES.home);
  });

  it('shows an error message when the API is down', async () => {
    getProjections.mockRejectedValue(new Error('API error 500 for /projections/'));
    renderCounty();

    expect(await screen.findByRole('heading', { level: 1, name: 'Something went wrong' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('could not load the data');
  });
});