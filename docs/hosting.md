# Hosting choice (CCD-247)

Status: **Decided: Google Cloud VM + DuckDNS** (27 Nov 2026). Live at https://ccd-ireland.duckdns.org. The options below are the original comparison from 9 Nov.

## What we need

From CCD-247 Select hosting platform:

| Requirement | Why |
|---|---|
| Public HTTPS URL | Lecturer, testers and the public open it in a browser |
| React frontend | Static files built by `npm run build` |
| Django API | Runs with gunicorn, `DEBUG=False` |
| Static files of the API (admin, Swagger, flood maps) | Served by Django with WhiteNoise; `collectstatic` runs when the container starts, so nothing extra is needed on the host |
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

## Decision (27 Nov 2026)

**One Google Cloud virtual machine running everything with Docker Compose, with a free DuckDNS domain.** Live at **https://ccd-ireland.duckdns.org**. How it is set up and deployed: [deployment.md](deployment.md).

| | |
|---|---|
| Server | Google Cloud Compute Engine, e2-medium (2 vCPU, 4 GB), europe-west2 (London), Ubuntu 24.04 |
| Runs | Caddy (HTTPS + React site), Django + gunicorn, Celery worker, PostgreSQL, Redis, all in `docker-compose.prod.yml` |
| Domain | `ccd-ireland.duckdns.org` (DuckDNS, free). HTTPS certificate from Let's Encrypt, renewed by Caddy |
| Cost | €0: covered by the Google Cloud free trial ($300 credit, about $35 a month for this VM). The trial ends about 25 Feb 2027 |
| Deploys | Automatic after CI passes on `main` (CCD-278 Add auto-deploy on merge to main, `.github/workflows/deploy.yml`) |

### Why the first proposal (Render + Neon) changed

1. **No background worker on Render's free plan.** Account emails need a Celery worker and Redis (CCD-437). Render's free plan has no worker service and no reliable free Redis.
2. **Avatars would be lost.** Render's free disk is wiped on every deploy (CCD-428). On our own server the avatars are kept in a Docker volume.
3. **Sleeping backend.** Render's free backend sleeps after 15 minutes, which is bad for a demo.

### Why Google Cloud and not the other options

| Option | What happened |
|---|---|
| D: Oracle Always Free | Chosen first, but the account sign-up had not been approved by 27 Nov. It also has the idle-server reclaim risk |
| C: Azure for Students | Signed up with the MTU account, but MTU's sign-in rules block the Azure portal for student logins |
| Google Cloud free trial | Instant sign-up and a normal Ubuntu server, so the same Docker Compose files work. Needs a card for a check, but the trial never charges unless it is upgraded by hand |

Trade-offs we accept:
- One server owned by one person (Eoin). If he is unavailable, nobody else can fix the server. Teammates can be given SSH access (deployment.md §8).
- The trial credit ends about 25 Feb 2027. That is after the 6 Dec 2026 submission; before then we either upgrade, move to Oracle, or shut it down.
- We look after the server ourselves (security updates, backups). Backups use the `db/` scripts (deployment.md §7).

### Domain

The Namecheap `.me` domain needs the GitHub Student Pack, which was still being approved. DuckDNS is free and works now. A `.me` domain can replace it later by changing `DOMAIN` in the server `.env` and the DNS record.

## Agreed by

- [ ] Eoin Ryan
- [ ] Taras Ivanysenko
- [ ] Artur Romanov
- [ ] Ronel Mombo

## Sources

- [GitHub Student Developer Pack](https://education.github.com/pack)
- [Oracle Cloud Free Tier docs](https://docs.oracle.com/iaas/Content/FreeTier/freetier.htm)
- [Oracle Always Free resources (idle reclamation)](https://docs.oracle.com/iaas/Content/FreeTier/resourceref.htm)
- [Google Cloud free trial](https://docs.cloud.google.com/free)
- [Render pricing explained (livemy.app, Aug 2026)](https://livemy.app/blog/render-pricing)
- [Neon pricing](https://neon.com/pricing)
- [Neon Free plan limits](https://neon.com/faqs/free-plan-limits-and-quotas)