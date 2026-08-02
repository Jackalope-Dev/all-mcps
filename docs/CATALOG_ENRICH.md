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

1. **Cloudflare Worker cron** (`custom-worker.ts`, every 4 hours) — health + enrich (+ highlight, etc.).
2. **GitHub Actions** `.github/workflows/health-check.yml` (every 15 minutes) — curls health, then enrich.

Actions only authenticate **to AllMCPs** with the repo secret `ADMIN_SECRET`. They do not call the GitHub API themselves.

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
