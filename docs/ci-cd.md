# CI/CD pipeline (CCD-273)

Owner: Eoin Ryan · Workflow file: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) · Last updated: 13 November 2026

Every pull request, and every push to `main`, runs the **CI** workflow on GitHub Actions. It checks the Python, Django, React and C++ code, and posts to the team's Discord channel if anything fails. A pull request can't be merged into `main` until every check is green and a teammate has approved it.

Deployment (the "CD" part, CCD-278 Add auto-deploy on merge to main) is not set up yet. It waits on the hosting decision (CCD-246 Deploy Application, [docs/hosting.md](hosting.md)).

---

## 1. When it runs

| Event | What runs |
|---|---|
| A pull request is opened, or new commits are pushed to its branch | The whole workflow, on the PR's code |
| A pull request is merged (a push to `main`) | The whole workflow again, on `main` |

Pushing to a branch **without** a pull request does not run CI. Open the PR to get the checks.

## 2. The jobs

The first five jobs run **at the same time**, each on a fresh Ubuntu machine; `notify` waits for them to finish. Each job only does its work once its folder has code in it (for example, `frontend` skips its steps if `frontend/package.json` doesn't exist).

| Job | Folder | What it does, step by step | A failure means |
|---|---|---|---|
| **lint** | whole repo | 1. Installs Python 3.12 and `ruff` 0.16.10 (the same version as the pre-commit hook). 2. `ruff check .` looks for unused imports, wrong import order and similar mistakes. 3. `ruff format --check .` checks every Python file is formatted | Python code has a lint error or isn't formatted. Fix it locally with `pre-commit run --all-files` |
| **pipeline** | `pipeline/` | 1. Installs `pipeline/requirements.txt`. 2. `python -m compileall -q .` checks every script for syntax errors (the raw data isn't on GitHub, so the scripts can't be run). 3. `python -m pytest tests -v` runs the pipeline tests | A pipeline script has a syntax error, or a data-cleaning or flood-precompute test failed |
| **backend** | `backend/` | 1. Starts a PostgreSQL 16 database just for this run. 2. Sets the same settings as `.env` (there is no `.env` on GitHub). 3. Installs `backend/requirements.txt`. 4. `python manage.py test` runs the Django tests | A Django test failed, a package is missing from `requirements.txt`, or a migration is broken |
| **frontend** | `frontend/` | 1. Installs Node 22. 2. `npm ci` installs the exact packages in `package-lock.json`. 3. `npm run lint` runs ESLint. 4. `npm run build` builds the site. 5. `npm test` runs the Vitest tests | ESLint found a problem, the site doesn't build, or a test failed. **The steps stop at the first failure**, so a lint error means the tests didn't run at all |
| **cpp** | `flood_engine/` | 1. Builds the C++ flood engine and its Python binding with CMake. 2. `ctest` runs the C++ (Catch2) tests. 3. Runs the Python tests for the binding. 4. Runs the flood precompute tests against the real binding | The C++ doesn't compile, or a C++ or binding test failed |
| **notify** | – | Runs **only if** one of the five jobs above failed. Posts *"CI failed on branch … (pushed by …). Details: <link>"* to the team's Discord channel | Nothing to fix here. It's the messenger |

### Discord alerts (CCD-279)

The `notify` job sends its message to a Discord webhook stored in the repository secret **`DISCORD_WEBHOOK_URL`** (GitHub → **Settings → Secrets and variables → Actions**). The webhook URL is never written in the code. To change the channel, create a new webhook in Discord (**Channel settings → Integrations → Webhooks**) and paste its URL into that secret.

## 3. Branch protection on `main` (CCD-276)

These rules are set in GitHub → **Settings → Branches**, and apply to everyone, admins included:

| Rule | Setting |
|---|---|
| Changes go through a pull request | Yes, nobody can push straight to `main` |
| Approving reviews needed | **1**, from a teammate (not the author) |
| Checks that must pass | `lint`, `pipeline`, `backend`, `frontend`, `cpp` |
| Force-push to `main` | Not allowed |
| Delete `main` | Not allowed |

This is why a PR shows **"Merging is blocked"** until it has a green tick for every check *and* one approval.

## 4. Reading a failed run

You'll usually find out from the Discord message. Then:

1. **Open the run.** Click the link in the Discord message. Or on the pull request, scroll to the checks at the bottom and click **Details** next to the red ✗. Or open the repository's **Actions** tab and click the red run.
2. **Find the failed job.** The run page lists the jobs on the left. The failed one has a red ✗ (for example `frontend`).
3. **Find the failed step.** Click the job. The steps are listed in order; the failed one is red and opens automatically. Everything after it shows as skipped.
4. **Read the error.** Scroll to the bottom of that step's log, or search the log for `error`. GitHub marks the key lines with `##[error]`. Some examples:

| What you see | What it means | How to fix |
|---|---|---|
| `error  Fast refresh only works when a file only exports components` (frontend, `npm run lint`) | An ESLint rule failed. The line gives the file, line and column (e.g. `ScenarioFilter.jsx 9:14`) | Fix that line, then run `npm run lint` locally until it's clean |
| `FAIL  src/pages/CountyDashboard.test.jsx` then `AssertionError: expected … to be …` (frontend, `npm test`) | A Vitest test failed. The log shows the test name and the expected vs actual value | Run `npm test` locally and fix the code or the test |
| `FAIL: test_… (climate.tests.…)` (backend) | A Django test failed. The traceback above it shows where | Run `python manage.py test` locally in `backend/` |
| `ModuleNotFoundError: No module named '…'` (backend or pipeline) | A package is used in the code but missing from `requirements.txt` | Add it to `requirements.txt` (saved as UTF-8) |
| `Would reformat: …` (lint) | A Python file isn't formatted | Run `pre-commit run --all-files` and commit the result |

5. **Fix it and push.** Commit the fix to the **same branch**. The pull request picks it up and CI runs again by itself.

### Re-running without changing code

If a run failed for a reason that isn't your code (for example a download timed out), open the run and click **Re-run jobs → Re-run failed jobs** at the top right. You need write access to the repository.

## 5. Running the same checks on your own machine

Run these before you push, so CI doesn't catch you out:

| Part | Commands (from the repository root) |
|---|---|
| Python lint | `pre-commit run --all-files` |
| Pipeline | `cd pipeline` → `python -m pytest tests -v` |
| Backend | `cd backend` → activate `.venv` → `python manage.py test` |
| Frontend | `cd frontend` → `npm run lint` → `npm test` → `npm run build` |
| C++ | see [docs/flood-engine.md](flood-engine.md) §11 |

## 6. Changing the workflow

- Edit `.github/workflows/ci.yml` on a branch and open a PR like any other change. The PR runs the new version of the workflow, so you can see it work before merging.
- If you add a **new job** that must pass, also add its name under **Require status checks to pass** in the branch protection settings, otherwise a failure in it won't block merging.
- Keep a comment above each step saying what it does, with the Jira key.