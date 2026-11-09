# Hosting choice (CCD-247)

Status: **Proposed, waiting for team agreement** (9 Nov 2026)

## What we need

From CCD-247 Select hosting platform:

| Requirement | Why |
|---|---|
| Public HTTPS URL | Lecturer, testers and the public open it in a browser |
| React frontend | Static files built by `npm run build` |
| Django API | Runs with gunicorn, `DEBUG=False` |
| PostgreSQL | Holds the county projections and sea level data (well under 1 GB) |
| Budget: **€0** | The team has no budget. No card on file, so there is no risk of surprise charges |
| Deploys from GitHub | CCD-278 Add auto-deploy on merge to main: deploy only after CI passes |
| Still running after **6 Dec 2026** | Final submission and demo |

## Options compared

| | A: Render + Neon | B: Heroku (GitHub Student Pack) | C: Azure for Students (GitHub Student Pack) |
|---|---|---|---|
| Frontend | Render static site (free) | Served by Django, or GitHub Pages (free) | Azure Static Web Apps |
| Backend | Render free web service | Heroku dyno | Azure App Service |
| Database | Neon free Postgres | Heroku Postgres | Azure Database for PostgreSQL |
| Cost to us | €0 | €0 while inside the $13/month credit (24 months) | €0 while inside the $100 credit |
| Card needed | No | Usually yes, to verify the account | No |
| Risk of being charged | None | If usage goes over the credit, the card is charged | None, services stop when the credit runs out |
| Sleeps when idle | Yes: after 15 min, about 1 min to wake | Cheapest dyno sleeps too | No |
| Database expiry | Neon free plan is permanent | None while paid by credit | None while credit lasts |
| Auto-deploy from GitHub | Yes, can wait for CI checks to pass | Yes, can wait for CI to pass | Yes, via GitHub Actions |
| Setup effort | Low | Low | High (many separate Azure services to configure) |

Notes:
- Render also has free Postgres, but it is **deleted 30 days after creation**, so it would not last until 6 Dec. That is why option A uses Neon for the database.
- Neon free plan: no credit card, 1 GB storage per project and 100 compute-hours a month. The database pauses when idle and wakes on the next query.
- Check the current Heroku and Azure prices before choosing B or C, because plan prices change.

## Proposed decision

**Option A: Render (frontend + backend) and Neon (database).**

Reasons:
1. It is the only option that costs €0 **and** needs no card, so nobody can be charged by mistake.
2. Everything still runs on 6 Dec 2026 (Neon free does not expire).
3. Low setup effort, which matters with one week left in Sprint 2.

Trade-off we accept: the backend sleeps after 15 minutes idle, so the first request takes about a minute. Before a demo or marking, open the site a few minutes early.

Accounts are created by Eoin (deployment owner) using his GitHub login. Secrets (database URL, Django secret key, API keys) are stored on Render and in GitHub Secrets, never in the repo.

## Agreed by

- [ ] Eoin Ryan
- [ ] Taras Ivanysenko
- [ ] Artur Romanov
- [ ] Ronel Mombo

## Sources

- [GitHub Student Developer Pack](https://education.github.com/pack)
- [Render pricing explained (livemy.app, Aug 2026)](https://livemy.app/blog/render-pricing)
- [Neon pricing](https://neon.com/pricing)
- [Neon Free plan limits](https://neon.com/faqs/free-plan-limits-and-quotas)