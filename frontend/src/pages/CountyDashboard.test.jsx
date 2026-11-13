// Tests for the county dashboard page (CCD-149, CCD-142, CCD-143).
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CountyDashboard from './CountyDashboard';
import { getCounty, getProjections } from '../services/api';
import { mockCork, mockCorkRows } from '../mocks/countyRows';
import { ROUTES, countyPath } from '../routes';

// Replace the real API calls with fakes, so the tests never need the backend
vi.mock('../services/api', () => ({
  getCounty: vi.fn(),
  getProjections: vi.fn(),
}));

// The test browser (jsdom) cannot draw on a <canvas>, so swap the real charts
// for simple placeholders that keep the chart's title as their label
vi.mock('react-chartjs-2', () => ({
  Line: (props) => <div data-testid="line-chart" aria-label={props['aria-label']} />,
  Bar: (props) => <div data-testid="bar-chart" aria-label={props['aria-label']} />,
}));

// Opens the page at /county/<slug>, the same way the real app does
function renderCounty(slug = 'cork') {
  render(
    <MemoryRouter initialEntries={[countyPath(slug)]}>
      <Routes>
        <Route path={ROUTES.county} element={<CountyDashboard />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CountyDashboard', () => {
  // Start every test with fresh fakes that return Cork's data
  beforeEach(() => {
    vi.clearAllMocks();
    getCounty.mockResolvedValue(mockCork);
    getProjections.mockResolvedValue(mockCorkRows);
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

  it('shows the annual temperature, annual rainfall and seasonal rainfall charts', async () => {
    renderCounty();
    await screen.findByRole('heading', { level: 1, name: 'Cork' });

    const lineCharts = screen.getAllByTestId('line-chart').map((chart) => chart.getAttribute('aria-label'));
    expect(lineCharts).toEqual(['Temperature in Cork (annual), °C', 'Precipitation in Cork (annual), mm']);

    const barChart = screen.getByTestId('bar-chart');
    expect(barChart.getAttribute('aria-label')).toBe('Change in precipitation by season in Cork, 2071-2100 (%)');
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