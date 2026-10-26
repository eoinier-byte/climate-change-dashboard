# Contributing

## Workflow

1. Pick a subtask in the current Jira sprint and move it to **In Progress**.
2. Branch from `main`: `feature/CCD-<number>-<short-description>` (bugs: `fix/CCD-<number>-...`).
3. Commit small, with the Jira key first: `CCD-31: aggregate grid cells by county`.
4. Push and open a pull request using the template. Link the Jira issue.
5. One teammate reviews. Fix comments, then merge (squash). Delete the branch.
6. Tick the subtask's **Definition of Done** checklist in Jira and move it to **Done**.

## Definition of Done (technical task)

- Project builds with no warnings
- Unit tests written
- Integration tests passing
- Code peer reviewed
- Tested on supported devices / browsers
- Any configuration changes documented

## Code style

- Python: `black` + `ruff`, type hints where practical.
- JavaScript/React: `prettier` + `eslint`.
- Keep secrets in `.env`; add any new setting to `.env.example` with a dummy value.

## AI-assisted code

Allowed. You must understand, test and be able to explain anything you commit. Mention significant AI help in the pull-request description.
