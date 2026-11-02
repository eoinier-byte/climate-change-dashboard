# src/ folder guide

| Folder | What goes here |
|---|---|
| `components/` | Reusable UI pieces used on more than one page (for example `ChartCard`, `CountySelect`). |
| `pages/` | One component per route (Home, Counties, CountyDashboard, Compare, SeaLevel, Analogue, NotFound). |
| `services/` | Code that talks to the API. All requests go through `api.js`, which reads `VITE_API_URL`. |
| `hooks/` | Custom hooks such as `useCounty(slug)` for loading and error states. |
| `styles/` | Shared CSS, including the scenario colour constants' CSS variables. |

Rules: no maths on API values in React (format only); always show unit, scenario, period and baseline next to a number.
