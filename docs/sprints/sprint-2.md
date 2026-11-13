# Sprint 2: Live map and county dashboard

**Ends:** Sunday 15 Nov 2026 · **Jira sprint:** CCD Sprint 2

## Sprint goal
Live map of Ireland and county dashboard showing real projection data at a public URL, with the C++ flood module
working from Python.

## Planning decisions

### Flood engine (CCD-395, CCD-419, CCD-420)

Full reasoning: [docs/flood-engine.md](../flood-engine.md) §5 (flood rule) and §9 (decisions D1–D6).

| Decision | Outcome | Agreed |
|---|---|---|
| **Sea connectivity** (open question in CCD-395) | A land cell floods only if it is at or below the sea level **and connected to the sea** through other flooded cells (4-neighbour: edges, not corners). "Every cell below the threshold" was rejected: it floods inland hollows the sea cannot reach and overstates the flooding. | Decided by Artur Romanov on 9 Nov 2026 (commit `6d65ec3`, flood-engine.md §5) |
| **D1 Elevation source** | Copernicus DEM GLO-90 (licence and attribution: `DATA_SOURCES.md` §6–7) | Team stand-up, 10 Nov 2026 |
| **D3 Sea mask** | Built by the precompute script from a whole-island land polygon (ROI counties + OSNI NI outline, `DATA_SOURCES.md` §8) | flood-engine.md §9 |
| **D4, D5** | No datum correction and no tide offset this sprint (limits stated in flood-engine.md §7) | flood-engine.md §9 |
| **D6 Flood layer format** | `pipeline/data/processed/flood/<county>/level_000.png` … `level_200.png` (0.1 m steps, 0–2 m) + `index.json` | Confirmed by Taras Ivanysenko (CCD-360 owner) at a team stand-up |

## Review (end of sprint)
- Done:
- Not done / carried over:
- Velocity (points completed):

## Retrospective
- Went well:
- To improve:
- Actions:
