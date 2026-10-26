# frontend/: React dashboard

County selector, temperature and rainfall charts (one line per scenario), seasonal comparison table, sea-level chart, scenario comparison and auth pages.

**Jira:** CCD-68 Layout research · CCD-69 Wireframes · CCD-287 Research React · CCD-126 Set up React · CCD-133 Core UI · CCD-140 API integration · CCD-148 Dashboard pages · CCD-155/162/169 Visualisations

## Stack

React (Vite) · Chart.js (react-chartjs-2) · Bootstrap / CSS · fetch / axios to the Django API

## Set-up (filled in by CCD-126)

```bash
npm create vite@latest . -- --template react
npm install
npm run dev        # http://localhost:5173
```

Set the API base URL in `frontend/.env` (`VITE_API_URL=http://localhost:8000/api`).

## Rules

- Never call raw data directly. All data comes from the backend API.
- Every chart shows units, scenario, period and baseline, and the source attribution.
