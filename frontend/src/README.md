# src/ folder guide

| Folder | What goes here |
|---|---|
| `components/` | Reusable UI pieces used on more than one page (for example `ComingSoon`, `NavBar`, `ChartCard`). |
| `pages/` | One component per route (Home, CountyDashboard, Compare, SeaLevel, About, Login, Register, Profile, NotFound). Paths are defined once in `routes.js`. |
| `services/` | Code that talks to the API. All requests go through `api.js`, which reads `VITE_API_URL`. |
| `hooks/` | Custom hooks such as `useCounty(slug)` for loading and error states. |
| `styles/` | The shared look: `theme.css` (colours, type, spacing, buttons) and `scenarioColors.js`. See `styles/README.md`. |

Rules: no maths on API values in React (format only); always show unit, scenario, period and baseline next to a number.
