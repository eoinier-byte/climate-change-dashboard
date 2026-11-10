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

| | A: Render + Neon | B: Heroku (GitHub Student Pack) | C: Azure for Students (GitHub Student Pack) | D: Oracle Cloud Always Free |
|---|---|---|---|---|
| Frontend | Render static site (free) | Served by Django, or GitHub Pages (free) | Azure Static Web Apps | Our own server (nginx) |
| Backend | Render free web service | Heroku dyno | Azure App Service | Our own server (gunicorn) |
| Database | Neon free Postgres | Heroku Postgres | Azure Database for PostgreSQL | PostgreSQL installed on our own server |
| Cost to us | €0 | €0 while inside the $13/month credit (24 months) | €0 while inside the $100 credit | €0 on Always Free resources |
| Card needed | No | Usually yes, to verify the account | No | Yes, to verify the account (not charged unless upgraded) |
| Risk of being charged | None | If usage goes over the credit, the card is charged | None, services stop when the credit runs out | Low, only if the account is upgraded |
| Sleeps when idle | Yes: after 15 min, about 1 min to wake | Cheapest dyno sleeps too | No | No, but Oracle may **reclaim idle servers** (CPU under 20% over 7 days), which a low-traffic student site could hit |
| Database expiry | Neon free plan is permanent | None while paid by credit | None while credit lasts | None |
| Auto-deploy from GitHub | Yes, can wait for CI checks to pass | Yes, can wait for CI to pass | Yes, via GitHub Actions | Yes, but we write it ourselves (GitHub Actions + SSH) |
| Setup effort | Low | Low | High (many separate Azure services to configure) | Highest: we set up and maintain Linux, nginx, HTTPS certificates, PostgreSQL, backups and security updates |

Notes:
- Render also has free Postgres, but it is **deleted 30 days after creation**, so it would not last until 6 Dec. That is why option A uses Neon for the database.
- Neon free plan: no credit card, 1 GB storage per project and 100 compute-hours a month. The database pauses when idle and wakes on the next query.
- Check the current Heroku and Azure prices before choosing B or C, because plan prices change.
- Option D would show the most server/DevOps work, but it is also the most work to keep running safely until 6 Dec, with one person owning deployment.

## Domain name (optional, any option)

Namecheap in the GitHub Student Pack gives a free `.me` domain for one year, plus an SSL certificate. Render, Heroku, Azure and Oracle can all use a custom domain, so this works with whichever host we pick. One year covers the 6 Dec 2026 submission. After that it would need renewing (paid), or we go back to the host's free URL.

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
- [Oracle Cloud Free Tier docs](https://docs.oracle.com/iaas/Content/FreeTier/freetier.htm)
- [Oracle Always Free resources (idle reclamation)](https://docs.oracle.com/iaas/Content/FreeTier/resourceref.htm)
- [Render pricing explained (livemy.app, Aug 2026)](https://livemy.app/blog/render-pricing)
- [Neon pricing](https://neon.com/pricing)
- [Neon Free plan limits](https://neon.com/faqs/free-plan-limits-and-quotas)