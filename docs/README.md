# docs/

| File | What |
|---|---|
| **`data-flow.md`** | **Start here.** How the climate data goes from raw NetCDF → county averages → PostgreSQL → API → charts. The contract between pipeline, backend and frontend |
| `architecture.md` | System overview and components |
| `data-model.md` | Database tables / ER diagram (CCD-33) |
| `api.md` | API endpoints (summary; full response shape in `data-flow.md`), including accounts, profile, email links, the AI assistant chat and rate limits |
| `api-examples.md` | One JSON example per endpoint, kept in step with the frontend mocks |
| `climate-analogues.md` | Climate analogues: data, method (delta method, standardised distance), how to run, results and limitations (CCD-354) |
| `entities.md` | Every attribute of every table, with units, allowed values and reasons (CCD-38) |
| [`../DATA_SOURCES.md`](../DATA_SOURCES.md) | Datasets, download dates, licences, attribution (CCD-22) |
| `data-review.md` | Climate Ireland and sea level dataset review (CCD-17, CCD-19) |
| `variables.md` | Column specification for `climate_data.csv` (CCD-20) |
| `ai-assistant-spike.md` | AI assistant spike: cost, response time, model choice and Sprint 3 tools (CCD-343, CCD-346) |
| `hosting.md` | Hosting options compared and the chosen platform (CCD-247) |
| `deployment.md` | What gets deployed, environment variable names, first deploy, redeploy, post-deploy checks, backup and restore (CCD-257) |
| `setup.md` | Local PostgreSQL setup, environment variables, backups and restore (CCD-33, CCD-272) |
| `pipeline.md` | Data pipeline: every step, cleaning, validation checks, the one-command rebuild and how long it takes (CCD-258) |
| `cleaning-rules.md` | Which values the pipeline removes and why (CCD-275) |
| `county-rules.md` | How grid cells and sea points are matched to counties (CCD-31) |
| `validation-log.md` | Results of the aggregation, import and data validation checks (CCD-36, CCD-271, CCD-239) |
| `flood-engine.md` | Flood engine: input format, method, limits and how to build it (CCD-396, CCD-401) |
| `security.md` | Database access rules, privacy note, `check --deploy` results and open security changes (CCD-296) |
| `ci-cd.md` | What each CI job checks and what to do when CI fails (CCD-273) |
| `design-research.md` | Website layout research (CCD-68) |
| `react-research.md` | React research and library choices (CCD-287) |
| `sprints/` | Sprint goal, planning, review and retrospective notes |

Project-management documents (Product Goal, Assumptions, Scope, Stakeholders, Risk Assessment) live in **Confluence**. Link to them rather than copying them here.