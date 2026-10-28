# CCD-287: Research React

Oct 27, 2026 · @Ron

## Summary and recommended stack (CCD-293)

Keep the team's chosen stack and add only what the dashboard's needs require: React 19 on Vite, React Router for pages, Chart.js through react-chartjs-2 for charts, plain `fetch` in one API module for data, React Hook Form for forms, and Bootstrap with React-Bootstrap for styling. The recommendations section gives a one-line reason for each choice.

- **Components:** small function components, with one reusable `ChartCard` that takes units, scenario, period, baseline and source as props, so the README rule is enforced in one place.
- **Data:** every request goes through one API module that reads `VITE_API_URL`. The frontend formats values and never recalculates them, as the data-flow document requires.
- **State:** `useState` in the page that owns the charts, and Context only for the signed-in user.
- **Loading and errors:** every fetch has loading, error and success states, and every chart gets a text alternative because Chart.js draws on a canvas.
- **Not needed:** server rendering, a global state library, maps, and the React Compiler (each line has only three data points).

After the 5-minute team presentation:

- [ ] Present this summary at the team meeting
- [ ] Record the agreed choices in the meeting notes

### About this document

- **Scope:** React fundamentals, features the dashboard will use, and a check of the libraries the team has already chosen.
- **Project context:** the dashboard is a client-rendered single-page app whose data comes only from the team's Django REST API. The frontend README sets the stack as React (Vite), Chart.js (react-chartjs-2), Bootstrap/CSS and fetch or axios.
- **Sourcing:** items marked with a link come from the Sources line at the end of each section, and project facts come from the team's CONTRIBUTING.md, README.md, architecture.md and data-flow.md. Everything else is general knowledge and should be re-checked against official docs before CCD-126. The react.dev pages could not be opened from this session, so their links are listed but unverified, and bundle sizes could not be measured because the npm registry was unreachable.

## Core concepts (CCD-288)

Five ideas carry every page of the dashboard: components, props, state, hooks and the component lifecycle. Each has a two-line explanation, a tiny example and a note on what it means for the dashboard.

### Components

A component is a JavaScript function that returns JSX, and a page is a tree of them. Component names start with a capital letter so React can tell them from HTML tags.

```jsx
function CountySelect() {
  return <select><option>Cork</option></select>;
}
```

**Dashboard:** build each page from small parts (selector, chart, table, commentary) so each can be tested on its own.

### Props

Props are the read-only inputs a parent passes to a child, written like HTML attributes. A child never changes its props; it calls a function the parent passed down instead.

```jsx
function ChartCard({ title, unit, scenario, period, baseline, source, children }) {
  return (
    <figure>
      <figcaption>{title} ({unit}), {scenario}, {period}, baseline {baseline}</figcaption>
      {children}
      <small>Source: {source}</small>
    </figure>
  );
}
```

**Dashboard:** one `ChartCard` guarantees every chart shows units, scenario, period, baseline and source, as the frontend README requires.

### State

State is data a component remembers between renders, and changing it re-renders the component. Never change it directly; call the setter that `useState` returns.

```jsx
const [season, setSeason] = useState('annual');
<button onClick={() => setSeason('winter')}>Winter</button>
```

**Dashboard:** the selected county and season are state. When they change, the charts re-render with the new data, so keep that state in the page that owns the charts and pass it down as props.

### Hooks: useState and useEffect

Hooks are functions that start with `use` and let a function component use React features; call them only at the top level of a component. `useState` holds data, and `useEffect` runs code after render to sync with something outside React, such as an API.

```jsx
const [data, setData] = useState(null);
const [error, setError] = useState(null);

useEffect(() => {
  const controller = new AbortController();
  fetch(`${import.meta.env.VITE_API_URL}/counties/${slug}/`, { signal: controller.signal })
    .then((res) => { if (!res.ok) throw new Error(res.status); return res.json(); })
    .then(setData)
    .catch((err) => { if (err.name !== 'AbortError') setError(err); });
  return () => controller.abort();
}, [slug]);
```

**Dashboard:** this is the basic pattern for fetching county data. It re-runs only when `slug` changes, and `fetch` does not throw on a 404 or 500, so the `res.ok` check matters. Wrap it in a custom hook such as `useCounty(slug)` so every page gets loading and error states the same way.

### Component lifecycle

A component mounts (first appears), updates (re-renders when props or state change) and unmounts (is removed). In function components `useEffect` covers this: an effect runs after render, and its cleanup function runs before the next run and on unmount.

```jsx
useEffect(() => {
  const id = setInterval(refresh, 60000);  // runs after mount
  return () => clearInterval(id);          // cleanup on unmount
}, []);
```

**Dashboard:** always clean up requests and timers. In development, React's StrictMode mounts, unmounts and mounts a component again to expose missing cleanup, so a request that fires twice in development is expected.

Sources (official React documentation; react.dev could not be opened from this session, so check the links): [Describing the UI](https://react.dev/learn/describing-the-ui), [Passing props to a component](https://react.dev/learn/passing-props-to-a-component), [useState](https://react.dev/reference/react/useState), [useEffect](https://react.dev/reference/react/useEffect), [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects).

## Features needed (CCD-289)

Every dashboard need maps to a React feature or pattern, and anything the dashboard does not need is marked out of scope. The needs come from the frontend README, the architecture notes and the data-flow document.

| Need | React feature or pattern | Detail | Scope |
| --- | --- | --- | --- |
| Routing between pages (dashboard, scenario comparison, sea level, login) | React Router: `Routes`, `Route`, `Link`, `useParams` | County slug in the URL, for example `/county/cork` | In scope |
| Fetching API data (county list, county projections, sea level) | `useEffect` in a custom hook such as `useCounty`, with `AbortController` | One API module reads `VITE_API_URL` | In scope |
| Charts (temperature, rainfall, sea level; one line per scenario) | react-chartjs-2 components driven by props and state | Re-render when county or season state changes; no maths in React | In scope |
| County selector and season switch | Controlled inputs: `useState` with `value` and `onChange`, state lifted to the page | Dropdown filled from `GET /api/counties/` | In scope |
| Forms (login, report request) | Controlled forms with `onSubmit`, or a form library | Validate before sending; show server errors | In scope |
| Loading and error states | A status state (`loading`, `error`, `success`) with conditional rendering; an error boundary for render errors | Every fetch shows a message; every chart has a text fallback | In scope |
| Signed-in user | Context (`createContext`, `useContext`) and a route wrapper that redirects when signed out | Keep only the user in Context, not chart data | In scope |
| Reusable caption, units and scenario colours | Components with props, plus a constants module for colours | Same colours everywhere, as the data-flow display rules require | In scope |
| Seasonal table and commentary | Rendering lists with `map` and a stable `key` | Show API values as returned | In scope |
| Server rendering and Server Components | Not needed | Django serves the API and the app is client-rendered | Out of scope |
| Global state libraries (Redux, Zustand) | Not needed | Page state and one Context cover the need | Out of scope |
| React 19 additions (form Actions, `useOptimistic`, `use`, `<Activity />`, `<ViewTransition />`) | Not needed | Forms are small and the dashboard is read-only | Out of scope |
| Maps | Not needed | The county is chosen from a dropdown | Out of scope |
| React Compiler (automatic memoization) | Not needed now | Each line has three data points, so renders are cheap; add it only if profiling shows a problem | Out of scope |

Sources: [React Router 2026 guide (Scrimba)](https://scrimba.com/articles/react-router-complete-guide-2026/), [React Conf 2025 summary](https://cheesecakelabs.com/blog/?p=13073) for the 19.2 features, [React Compiler 1.0 install guide](https://recca0120.github.io/en/2026/04/14/react-compiler-vite-v6/), and the team's data-flow.md, README.md and architecture.md. Official React documentation (not opened here): [Context](https://react.dev/learn/passing-data-deeply-with-context), [Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects).

## Library comparison (CCD-291, CCD-292)

Each need has at least two options, checked for maintenance activity and fit with Vite. Dates are as reported by the pages in the Sources line, and "not a plugin" means a plain npm package that needs no Vite setup.

### Options compared

| Need | Option | Maintenance activity | Fit with Vite |
| --- | --- | --- | --- |
| Routing | React Router | v8.2.0 is current as of July 2026; v8.0.0 shipped 17 June 2026; v7 still gets security updates | Declarative mode works in a plain Vite SPA; framework mode needs Vite 7 or later |
| Routing | TanStack Router | Active and growing: about 1.2M weekly downloads against about 12M for React Router (March 2026) | Has a Vite plugin (`@tanstack/router-plugin/vite`) |
| Charts | Chart.js with react-chartjs-2 | Chart.js 4.6.1 released 22 October 2026. react-chartjs-2 5.3.0 (adds React 19 support) released 1 January 2025, the latest listed on socket.dev | Plain npm packages, no plugin |
| Charts | Recharts | Version 3 is current; latest release date not checked | Plain npm package, no plugin |
| API calls | fetch | Built into browsers, so nothing to maintain | Nothing to install; base URL from `import.meta.env.VITE_API_URL` |
| API calls | axios | About 55M weekly downloads; release date not checked | Plain npm package, no plugin |
| Forms | React Hook Form | v7 actively maintained and React 19 compatible; about 10.4M weekly downloads (March 2026) | Plain npm package, no plugin |
| Forms | Formik | v2.4.6 from 2023, bug fixes only; v3 never shipped; about 2.5M weekly downloads and falling | Plain npm package, no plugin |
| Forms | Controlled components with `useState` | Part of React | Nothing to install |
| Styling | Bootstrap with React-Bootstrap | React-Bootstrap has 230 releases, about one every 2 weeks 6 days, the last about 4 days before the page was captured; Bootstrap itself not checked | Import the Bootstrap CSS in `main.jsx`; no plugin |
| Styling | Tailwind CSS v4 | v4.3.3 released 16 July 2026, with a release every few weeks | Official `@tailwindcss/vite` plugin, with Vite 7 and Vite 8 support |
| Styling | CSS Modules | Built into Vite | Built in; no setup |

TanStack Query can sit on top of either fetch or axios to add caching and loading states. It is not compared further here because it is an addition, not a replacement.

### Advantages, disadvantages and limitations

| Option | Advantages | Disadvantages and limitations |
| --- | --- | --- |
| React Router | Largest router ecosystem; `Routes`, `useNavigate` and `useParams` are familiar; about 32 KB per one comparison (unit not stated); basics take an afternoon | Three modes (declarative, data, framework) can confuse; route middleware for protected routes is not available in declarative mode, so use a wrapper component; majors move fast (v6 is end of life) |
| TanStack Router | Typed routes and search params; a strong fit for client-only apps | About 40 KB in the same comparison (unit not stated); steeper conceptual shift; smaller community; the source page is marked out of date |
| Chart.js with react-chartjs-2 | Simple setup, light and responsive; strong docs and community; covers line, bar and scatter charts; tree-shakable, so only registered parts are bundled (general knowledge) | Draws on a canvas, which screen readers cannot read, so each chart needs `role="img"`, an `aria-label` and fallback text; less customisable than D3 or Visx; limited advanced chart types; react-chartjs-2 has had no release since January 2025 |
| Recharts | Easy and React-native; SVG output; in v3 the accessibility layer is on by default, so charts can be reached by keyboard | Can struggle with very large datasets and has limited advanced chart types; v3 removed chart internal state from event handlers; fewer ready-made annotation options than Chart.js (general knowledge) |
| fetch | No dependency and no bundle cost | Does not throw on 404 or 500, so check `response.ok`; no interceptors, so auth headers need a wrapper |
| axios | Interceptors (for example to attach a token); throws on non-2xx; configurable timeouts | An extra dependency whose size varies by source, so measure it after CCD-126 |
| React Hook Form | About 9.6 KB gzipped; re-renders mainly on submit or validation; Zod schemas supply the types | Uncontrolled model plus `Controller` for UI-library inputs can feel unfamiliar |
| Formik | Controlled model that is easy to reason about | About 15.5 KB gzipped; re-renders the form on every keystroke; bug fixes only since 2023 |
| Controlled components with `useState` | No dependency; enough for two small forms | Validation, error and touched state are written by hand and get repetitive as forms grow |
| Bootstrap with React-Bootstrap | Already chosen in the README; responsive grid; ready-made navbar, form and table components; React-Bootstrap avoids using Bootstrap's own JavaScript beside React (general knowledge) | Generic look; the full CSS file loads (size not measured); accessibility depends on using the components correctly |
| Tailwind CSS v4 | Utility classes; official Vite plugin | Different workflow from Bootstrap; no ready-made components; would replace the README choice |
| CSS Modules | Built into Vite; scoped styles; no dependency | Everything is built by hand, including grid and components, so it is the most work |

Bundle sizes are quoted only where a source gives them. The npm registry could not be reached from this session, so no sizes were measured; compare them with a Vite production build after CCD-126.

Sources: [React Router 2026 guide (Scrimba)](https://scrimba.com/articles/react-router-complete-guide-2026/), [TanStack Router vs React Router (PkgPulse)](https://www.pkgpulse.com/guides/tanstack-router-vs-react-router-v7-2026/raw.md), [Chart.js release history (Versio)](https://www.versio.io/en/product-release-end-of-life-eol-chartjs-team-chartjs.html), [react-chartjs-2 versions (Socket)](https://socket.dev/npm/package/react-chartjs-2/versions), [Chart.js accessibility docs](https://www.chartjs.org/docs/latest/general/accessibility.html), [Recharts 3.0.0 release](https://newreleases.io/project/npm/recharts/release/3.0.0), [React chart libraries compared (FusionCharts, a vendor blog)](https://www.fusioncharts.com/blog/best-react-chart-library/), [axios vs fetch (PkgPulse)](https://www.pkgpulse.com/guides/axios-vs-fetch-vs-got-2026), [React Hook Form vs Formik (PkgPulse)](https://www.pkgpulse.com/guides/react-hook-form-vs-formik-2026), [React-Bootstrap releases (ReleaseAlert)](https://releasealert.dev/npmjs/_/react-bootstrap/links), [Tailwind CSS releases](https://releases.sh/tailwind-css/tailwind-css.md). Official documentation (not opened here): [reactrouter.com](https://reactrouter.com), [react-chartjs-2](https://react-chartjs-2.js.org), [Recharts](https://recharts.org), [MDN Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API), [axios](https://axios-http.com/docs/intro), [React Hook Form](https://react-hook-form.com), [Formik](https://formik.org/docs/overview), [Bootstrap](https://getbootstrap.com/docs/5.3/), [React-Bootstrap](https://react-bootstrap.github.io), [Vite](https://vite.dev/guide/).

## Recommendations (CCD-290, CCD-292)

One option is recommended for each need, with the reason in one line.

| Need | Recommended | Reason |
| --- | --- | --- |
| Routing | React Router, declarative mode | Largest ecosystem, works in a plain Vite SPA, and a wrapper component covers protected routes |
| Charts | Chart.js with react-chartjs-2 | Already chosen, simple, actively released (4.6.1 on 22 October 2026), and enough for a few lines of three points each |
| API calls | `fetch` in one API module | No dependency, and the requests are simple GETs; move to axios only if auth interceptors get complex |
| Forms | React Hook Form | Small (about 9.6 KB gzipped), actively maintained, and re-renders little |
| Styling | Bootstrap with React-Bootstrap | Already chosen, ready-made responsive components, and no clash with React |
| Shared state | `useState` in pages, Context for the signed-in user | No extra library is needed at this size |
| Testing | Vitest and React Testing Library | They share Vite's config and cover the unit and integration tests CONTRIBUTING.md requires |

TanStack Query is an optional addition if hand-written loading and error states start to repeat. The data-flow document says responses never change between pipeline runs, so caching them is safe.

### Approaches that follow from the data-flow document

- Treat the API response shape as the contract: pass `period_labels` and each `series.<scenario>.values` straight to Chart.js, one dataset per scenario.
- Show `change` and `units` from the API, and do not calculate or round in React beyond formatting.
- The API example names the rainfall block `rainfall`, while the data and `units` object use `precipitation`. Map this once in the API module and confirm the final name with the backend team.
- Until the API exists, load the static files from `build_dashboard_json.py` behind the same API module. Their names (`cork.json`) differ from the API paths (`/counties/cork/`), so serve them at matching paths or map the paths in the module; changing only the base URL will not be enough.
- Keep scenario colours in one constants module (RCP2.6 green, RCP4.5 amber, RCP8.5 red), and call the values projections, never forecasts.
- Give every chart `role="img"`, an `aria-label` and a text or table fallback, because Chart.js draws on a canvas.
- Tooling moves quickly (React Router is on v8, and Vite 8 changed the React plugin to drop Babel), so pin versions in CCD-126.

Sources: the Library comparison and Features needed sections above, plus the team's data-flow.md, README.md, architecture.md and CONTRIBUTING.md.

## Next steps for CCD-126 (Setup React Application)

- [ ] Scaffold the app with the README commands (`npm create vite@latest . -- --template react`) and confirm the dev server runs at http://localhost:5173
- [ ] Add `VITE_API_URL` to `frontend/.env`, and a dummy value to `.env.example`
- [ ] Install react-router, chart.js, react-chartjs-2, react-hook-form, bootstrap and react-bootstrap
- [ ] Write the API module: a `fetch` wrapper with the `res.ok` check, the base URL and the rainfall naming map
- [ ] Prototype `ChartCard` with one temperature chart from a static county file, including `aria-label` and a table fallback
- [ ] Configure prettier and eslint
- [ ] Set up Vitest and Testing Library, and check the GitHub Actions CI runs tests and the build
- [ ] Measure bundle sizes with a Vite production build and record them here
- [ ] Document any config changes in the frontend README
