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

## Signing in: session cookie and CSRF token (CCD-409)

The site uses Django **session authentication**. All calls go through `src/services/api.js`:

| Call | Cookie sent? | CSRF token sent? | Use for |
|---|---|---|---|
| `apiGet`, `getCounties`, ... | No | No | Public data (counties, projections, maps) |
| `apiGetWithSession(path)` | Yes | No | Reads that need the signed-in user |
| `apiPost`, `apiPut`, `apiPatch`, `apiDelete` | Yes | Yes (`X-CSRFToken` header) | Login, register, profile, favourites, ... |

- The CSRF token is read from Django's `csrftoken` cookie and sent as the `X-CSRFToken` header on every write.
- The session cookie is `HttpOnly`, so the page never reads it. The browser sends it with `credentials: 'include'`.
- **Nothing is written to `localStorage` or `sessionStorage`**: no password, no token. Signing in survives a refresh because the browser keeps the cookie.
- A failed write rejects with an `ApiError`. `error.status` is the HTTP status and `error.body` is what the server said (for example `{ email: ['Enter a valid email address.'] }`), so forms can show it.
- Mock mode (`VITE_USE_MOCKS=true`) refuses writes with a clear message instead of pretending they worked.

### Settings the backend has (checked against `backend/config/settings.py` and `docs/api.md`)

| Setting | Value on `main` | Why |
|---|---|---|
| `CORS_ALLOW_CREDENTIALS` | `True` | Lets the browser send the cookie to the API from another origin |
| `CORS_ALLOWED_ORIGINS` | From `.env`. It must list the exact frontend origin, e.g. `http://localhost:5173`. Never `*` | Browsers refuse a wildcard when cookies are sent |
| `CSRF_TRUSTED_ORIGINS` | The same list | Django checks the `Origin` of write requests |
| `GET /api/auth/csrf/` | Sets the `csrftoken` cookie (`ensure_csrf_cookie`) | The frontend asks for it by itself before the first write when the cookie is missing, so no call is needed at start-up |
| `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` | `True` when `DEBUG` is off | Cookies are sent over https only on the live site |
| `SESSION_COOKIE_SAMESITE`, `CSRF_COOKIE_SAMESITE` | Not set, so Django's default `Lax` | See the warning below |

**Agreed with:** the backend owner's work for CCD-294 / CCD-302 (endpoints in `docs/api.md`). Confirm the live-site origin with the deployment owner (see below).

### Warning for the live site: keep the site and the API on one origin

The `csrftoken` cookie is set by the API, and the page has to read it. A page can only read cookies of its **own** site, and `Lax` cookies are not sent on cross-site `fetch` calls. If the frontend and the API are on different sites (for example two `onrender.com` addresses, which count as different sites), signing in will fail on the live site even though it works locally. Two ways to avoid this:

1. **Same origin (recommended).** Serve the API under the frontend's address (a rewrite rule `/api/*` to the API service, or Django serving the built frontend) and set `VITE_API_URL=/api`. Nothing else changes.
2. **Different sites.** The backend must set `SESSION_COOKIE_SAMESITE = 'None'` (with `Secure`), and `GET /auth/csrf/` must also return the token in its answer, because the page cannot read the cookie. This needs frontend and backend changes.

## Account pages (CCD-299)

| Page | Address | What it does |
|---|---|---|
| Log in | `/login` | Username or email and password. Links to "Forgot your password?" |
| Register | `/register` | Creates the account, then "Check your email" |
| Account | `/profile` | Photo, username and name, email (with a pending new address), password. A visitor who is not signed in is sent to `/login` |
| Forgot password | `/forgot-password` | Asks for an email address and always answers the same, whether or not it has an account |
| Choose a new password | `/recovery/{user_id}/{code}` | The link in the reset email. It checks the link first, then shows the form |
| Email confirmed / Email updated | `/verify-email/{user_id}/{code}`, `/email-updated/{user_id}/{code}` | The links in the registration email and the new-email email. Each calls `POST /auth/verify/…` once |

- The three email addresses must match `DOMAIN_NAME` in the backend `.env` (docs/api.md, "Links sent by email"). With `DJANGO_DEBUG=True` the emails are printed in the `runserver` console, so you can copy the link from there.
- A link works once. React runs effects twice in development, so `EmailLink.jsx` shares one request per link; without that the first call would use the link up and the page would say it had expired.
- There is no "send the confirmation email again" endpoint yet, so an expired link tells the user to log in and ask for a new one from the Account page.
- There is no "delete account" button: the story for it (CCD-445) belongs to the backend work.
- Form checks are in `auth/validation.js`, server messages in `auth/formErrors.js`. The photo rules (JPEG, PNG or HEIC, up to 50 MB) are in `auth/profileHelpers.js`; the server checks the size in pixels.

## County page URL settings (CCD-406)

The county page keeps the chosen scenarios and period in the URL, so a link opens exactly the same view:

| Setting | Values | Default (when missing or not valid) |
|---|---|---|
| `rcp` | Comma list of `26`, `45`, `85`, e.g. `?rcp=26,85` | All three scenarios |
| `period` | `2021-2050` or `2071-2100` (the period the seasonal charts show) | `2071-2100` |

Example: `/county/cork?rcp=85&period=2021-2050` shows only RCP8.5, with mid-century seasonal charts. A setting equal to its default is left out of the URL, and the settings are kept when switching county. The code is in `src/hooks/useCountyView.js`.

## County page layout and reserved slots (CCD-180)

`src/pages/CountyDashboard.jsx` shows its sections in this order:

1. **Headline numbers**: county name, today's climate (1976-2005 average)
2. **Charts**: scenario and period controls, then temperature, rainfall and sea level
3. **What this means for you**: slot for CCD-375 (impacts block)
4. **Warming stripes**: slot for CCD-374
5. **Climate analogue**: slot for CCD-373
6. **Actions**: "Copy link to this view" (share); the Download PDF button (CCD-408) goes next to it

Slots 3-5 use `CountySlot` (`src/components/CountySlot.jsx`). To fill one, put your block inside it in `CountyDashboard.jsx`; nothing else on the page needs to change:

```jsx
<CountySlot name="stripes" title="Warming stripes" story="CCD-374">
  <WarmingStripes county={county} />
</CountySlot>
```

An empty slot shows a dashed "Reserved for CCD-…" box under `npm run dev`, and nothing at all on the built site, so visitors never see placeholders. The layout is checked at 375 px (phone) and 1280 px (laptop) wide.

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

### Shared test helpers (CCD-417)

Two helpers in `src/test/` save writing the same setup in every test file:

| Helper | File | What it does |
|---|---|---|
| `renderWithRouter(ui, { url, path })` | `src/test/renderWithRouter.jsx` | Draws a component inside a pretend router, starting at `url`. Give `path` (e.g. `ROUTES.county`) when the component reads the URL with `useParams` |
| `currentLocation()` | `src/test/renderWithRouter.jsx` | The address the pretend browser is at now, e.g. `'/county/kerry?rcp=85'`, to check a click changed the page |
| `mockApiSuccess(api, overrides)` | `src/test/mockApi.js` | Makes every fake API function answer with mock data in the agreed shapes (Cork, from `src/mocks/`). Change one answer with e.g. `{ counties: [] }` |
| `mockApiLoading(api)` | `src/test/mockApi.js` | Makes every fake never answer, so the page stays on "Loading…" |
| `mockApiError(api, name, status)` | `src/test/mockApi.js` | Makes one fake fail, e.g. `mockApiError(api, 'getCounty', 404)` |

```jsx
import { screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from '../services/api';
import { ROUTES } from '../routes';
import { mockApiSuccess } from '../test/mockApi';
import { renderWithRouter } from '../test/renderWithRouter';
import CountyDashboard from './CountyDashboard';

vi.mock('../services/api'); // every API function becomes a fake
// (the county page also draws charts, so add the react-chartjs-2 mock from "Charts" above too)

beforeEach(() => {
  vi.clearAllMocks();   // forget calls from the previous test
  mockApiSuccess(api);  // the fakes answer with Cork's data
});

it('shows the county name', async () => {
  renderWithRouter(<CountyDashboard />, { url: '/county/cork', path: ROUTES.county });
  expect(await screen.findByRole('heading', { level: 1, name: 'Cork' })).toBeTruthy();
});
```

`CountySelect.test.jsx` and `ShareLink.test.jsx` use these helpers, so they're good examples to copy. Older tests still set things up by hand (as below), which also works.

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
- [ ] Charts replaced with `vi.mock('react-chartjs-2', …)`; API replaced with `vi.mock('../services/api')` (use the shared helpers in `src/test/` to fill it)
- [ ] `npm run lint` and `npm test` both pass

## Rules

- Never call raw data directly. All data comes from the backend API.
- Every chart shows units, scenario, period and baseline, and the source attribution.