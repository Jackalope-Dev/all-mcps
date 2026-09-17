# Catalog enrichment (health + quality pass)

Scraped/imported listings (~3k) often lack websites, logos, and install hints, and may still
store Glama/README chrome in descriptions. Two cron routes improve quality over time.

## Endpoints

| Route | Role |
|-------|------|
| `POST /api/cron/health` | Stars, archived/offline, badge recheck, install parse, soft-unpublish dead repos |
| `POST /api/cron/enrich` | Clean descriptions, GitHub homepage → website, install hints, avatar logos, unpublish archived/404 |

Both require `Authorization: Bearer <ADMIN_SECRET>`.

## Triggers

Both routes are driven entirely by the Cloudflare Worker's own cron triggers (`custom-worker.ts`,
`FAST_JOBS`) on the `*/15 * * * *` schedule declared in `wrangler.jsonc` — no GitHub Actions
involved. (They used to also be pinged every 15 min by `.github/workflows/health-check.yml`, until
that was retired in favor of the Worker's own faster trigger to cut GitHub Actions usage.) Manual
backfill of a large backlog still goes through GitHub Actions — see `backfill-health.yml` /
`backfill-enrich.yml`, which loop these same endpoints on demand.

## `GITHUB_TOKEN` (Cloudflare Worker only)

Enrich/health call `api.github.com` for public repo metadata and READMEs.

| Secret | Where | Purpose |
|--------|--------|---------|
| `ADMIN_SECRET` | Worker + GitHub Actions repo secrets | Authorize cron HTTP calls to our Worker |
| `GITHUB_TOKEN` | **Worker only** (`wrangler secret put GITHUB_TOKEN`) | Authenticated GitHub API rate limits (~5k/hr) |

This is **not** Actions’ automatic `GITHUB_TOKEN` (that only exists on the runner and never reaches Cloudflare). Without the Worker PAT, calls are unauthenticated (~60 req/hour) and enrichment crawls.

```bash
npx wrangler secret put GITHUB_TOKEN
```

Use a classic or fine-grained PAT with read access to public repositories.

## Manual kick

```bash
curl -X POST https://allmcps.com/api/cron/enrich \
  -H "Authorization: Bearer $ADMIN_SECRET"
```

## Code

- `app/api/cron/enrich/route.ts`
- `app/api/cron/health/route.ts`
- `lib/listingEnrich.ts`
- `lib/githubAuth.ts`
