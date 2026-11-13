# frontend/: React dashboard

County selector, temperature and rainfall charts (one line per scenario), seasonal comparison table, sea-level chart, scenario comparison and auth pages.

**Jira:** CCD-68 Layout research · CCD-69 Wireframes · CCD-287 Research React · CCD-126 Set up React · CCD-133 Core UI · CCD-140 API integration · CCD-148 Dashboard pages · CCD-155/162/169 Visualisations

## Stack

React (Vite) · Chart.js (react-chartjs-2) · Bootstrap / CSS · fetch / axios to the Django API

## Set-up

```bash
cd frontend
npm ci
cp .env.example .env   # Windows PowerShell: Copy-Item .env.example .env
npm run dev            # http://localhost:5173
```

Other commands: `npm run lint`, `npm test`, `npm run build`, `npm run preview`.
Set the API base URL in `frontend/.env` (`VITE_API_URL=http://localhost:8000/api`).

## Testing (CCD-412)

Tests use **Vitest** (the test runner) and **React Testing Library** (renders a component and finds things on it the way a person would: by text, label or role). Test files sit next to the file they test and end in `.test.js` or `.test.jsx`, e.g. `components/SeasonalChart.jsx` → `components/SeasonalChart.test.jsx`.

### Running the tests

```bash
cd frontend
npm test              # run every test once (what CI runs)
npx vitest            # watch mode: re-runs tests as you save files (Ctrl+C to stop)
npx vitest SeasonalChart   # only test files whose name contains "SeasonalChart"
npm run lint          # CI runs ESLint BEFORE the tests, so run this too before pushing
```

The tests never need the backend or the database running.

### Writing a test for a helper function

Plain functions (anything in a `.js` file, like `chartData.js`) are the easiest: call the function and check what comes back.

```js
// e.g. components/seaLevelChartData.test.js
import { describe, expect, it } from 'vitest';
import { buildSeaLevelSummary } from './seaLevelChartData';
import { mockSeaLevelCork } from '../mocks/seaLevel';

describe('buildSeaLevelSummary', () => {
  it('gives the rise by 2100 for each scenario', () => {
    expect(buildSeaLevelSummary(mockSeaLevelCork)).toContain('RCP8.5 +75.4 cm');
  });
});
```

### Writing a test for a component

`render()` draws the component in a pretend browser, and `screen` finds things on it. Find things the way a user would: `getByRole('checkbox', { name: 'RCP4.5 …' })` or `getByText('…')`, not by CSS class. Use `userEvent` to click and type.

```jsx
// components/ScenarioFilter.test.jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import ScenarioFilter from './ScenarioFilter';

it('removes a scenario when its box is unticked', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn(); // a fake function that remembers how it was called
  render(<ScenarioFilter selected={['rcp26', 'rcp45', 'rcp85']} onChange={onChange} />);

  await user.click(screen.getByRole('checkbox', { name: /^RCP4\.5/ }));

  expect(onChange).toHaveBeenCalledWith(['rcp26', 'rcp85']);
});
```

**Charts:** the pretend browser can't draw on a `<canvas>`, so any test that renders a Chart.js chart must swap it for a placeholder at the top of the file. Copy the chart's title into `aria-label` so you can still check it:

```jsx
vi.mock('react-chartjs-2', () => ({
  Line: (props) => <div data-testid="line-chart" aria-label={props['aria-label']} />,
  Bar: (props) => <div data-testid="bar-chart" aria-label={props['aria-label']} />,
}));
```

### Writing a test for a page that calls the API

Pages get their data through `src/services/api.js`. In a test, replace those functions with fakes using `vi.mock`, and give the fakes data from `src/mocks/`. That way the test is fast, never needs the backend, and you choose exactly what the "API" returns, including errors.

```jsx
// pages/CountyDashboard.test.jsx (shortened)
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import CountyDashboard from './CountyDashboard';
import { getCounties, getCounty, getProjections, getSeaLevel } from '../services/api';
import { mockCork, mockCorkRows } from '../mocks/countyRows';
import { mockSeaLevelCork } from '../mocks/seaLevel';
import { ROUTES, countyPath } from '../routes';

// 1. Replace every API function the page (and its components) uses with a fake
vi.mock('../services/api', () => ({
  getCounties: vi.fn(),
  getCounty: vi.fn(),
  getProjections: vi.fn(),
  getSeaLevel: vi.fn(),
}));

// 2. Before each test, say what each fake returns (mockResolvedValue = the API worked)
beforeEach(() => {
  vi.clearAllMocks();
  getCounties.mockResolvedValue([mockCork]);
  getCounty.mockResolvedValue(mockCork);
  getProjections.mockResolvedValue(mockCorkRows);
  getSeaLevel.mockResolvedValue(mockSeaLevelCork);
});

// 3. Pages that read the URL (useParams) need a router around them
function renderCounty(slug) {
  render(
    <MemoryRouter initialEntries={[countyPath(slug)]}>
      <Routes>
        <Route path={ROUTES.county} element={<CountyDashboard />} />
      </Routes>
    </MemoryRouter>,
  );
}

it('shows the county name once the data has loaded', async () => {
  renderCounty('cork');
  // findBy… waits for the fake API to answer; getBy… doesn't wait
  expect(await screen.findByRole('heading', { level: 1, name: 'Cork' })).toBeTruthy();
});

it('shows an error when the API fails', async () => {
  getProjections.mockRejectedValue(new Error('API error 500')); // mockRejectedValue = the API failed
  renderCounty('cork');
  expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeTruthy();
});
```

**Mock data rules:** files in `src/mocks/` copy the **exact shape** of the real API response (check `docs/api.md`, or open the endpoint in the browser), use real values from `pipeline/data/processed/`, and send decimal numbers as strings like Django REST Framework does (`'9.815'`, not `9.815`). If you add an API function to `services/api.js`, add it to the `vi.mock` list in every test of a page that uses it (including `App.test.jsx`), or those tests fail with "is not a function".

### Checklist for a new test

- [ ] File named `Something.test.jsx` next to `Something.jsx`
- [ ] Covers what should happen **and** what happens with no data or an API error
- [ ] Finds things by role, label or text, not by CSS class
- [ ] Charts replaced with `vi.mock('react-chartjs-2', …)`; API replaced with `vi.mock('../services/api', …)`
- [ ] `npm run lint` and `npm test` both pass

## Rules

- Never call raw data directly. All data comes from the backend API.
- Every chart shows units, scenario, period and baseline, and the source attribution.