# Catalog enrichment (health, quality and AI content)

Imported listings (official MCP registry and awesome-lists, plus human submissions) arrive with
little more than a name, URL and description. They often lack a website, logo, install hint,
specific category or writeup, and may still carry Glama/README chrome in the description. A set
of cron routes improves them over time.

## Endpoints

| Route | Cadence | Role |
|-------|---------|------|
| `POST /api/cron/health` | every 15 min | Repo/endpoint liveness, stars, last commit, npm downloads, badge recheck, live `tools/list` for hosted endpoints, install parse, soft-unpublish dead repos. Sets `listing_signals.content_changed_at` when a listing's source changes (see below). |
| `POST /api/cron/enrich` | every 15 min | Clean descriptions, GitHub homepage/README → website, install hints, logo cascade (README image → site favicon → org avatar → user avatar), Jev category re-classification, unpublish archived/404 repos. |
| `POST /api/cron/ai-content` | every 20 min | The per-listing AI layer: writeup (`ai_doc`), summary, overview, use cases, features, FAQ, env vars, auth/pricing/license/tags/clients, and install validation. |
| `POST /api/cron/ai-faq` | every 4 h | FAQ backfill for listings enriched before ai-content generated FAQs. |

All of them require `Authorization: Bearer <CRON_SECRET>` (`ADMIN_SECRET` is still accepted as a
transitional alias; see `lib/cronAuth.ts`).

## Triggers

The site Worker is the only scheduler: its cron triggers (`wrangler.jsonc`: `*/15`, `*/20`,
`0 */4`) fire `custom-worker.ts`, which sends every job except `isr-cache-cleanup` to the
`all-mcps-jobs` Worker over the `JOBS` service binding. Job lists and routing live in
`lib/cronSchedule.ts`. No GitHub Actions workflow runs these on a schedule.

To drain a large backlog faster (for example after a big import), run the manual
`.github/workflows/backfill.yml` workflow and pick the job (`health`, `enrich`, `ai-content`,
`ai-faq`). It loops the same endpoints and stops when the AI endpoints report an empty backlog or
an exhausted LLM budget.

## What ai-content works on first

The catalog is far larger than a day of enrichment, so the order matters. The rules live in
`lib/aiContentQueue.ts` (SQL plus matching pure functions, tested in `lib/aiContentQueue.test.ts`).
Each tick fills its batch in this order:

1. **Changed**: `listing_signals.content_changed_at` is newer than `servers.ai_enriched_at`. The
   writeup describes an older version of the source.
2. **Never enriched** (or summarized without a writeup), most demand first.
3. **Stale**, most demand first: the writeup is older than 90 days for a listing with any demand,
   or older than 180 days for one with none. "Demand" means any views, copies or upvotes, at least
   10 GitHub stars, or at least 100 npm downloads a month.
4. Leftover slots: install validation, then auth/pricing metadata.

Every pass is limited to **servable** listings: active and not flagged by the stale sweep
(`lib/servability.ts`). Flagged listings are out of search and noindexed, so a writeup reaches
nobody. **Unmodified forks** with under 10 stars are held, because the stale sweep flags them and
the upstream listing has the writeup. A listing with no README and a description under 30
characters is marked thin before any model call (`ai_doc = ''`, the "attempted, nothing to
write" marker, which every reader treats as no writeup).

### The `content_changed_at` contract

The health cron sets `listing_signals.content_changed_at` to the time it noticed a change in a
listing's source: a different README hash (`readme_hash`), a new GitHub release tag
(`latest_release_tag`), or changed tool definitions. ai-content only reads the column. A
successful refresh sets `ai_enriched_at` to the claim time, which drops the row out of pass 1. A
failed refresh releases back to the previous `ai_enriched_at`, so the row stays first in line.

## Categories

The original categories came from a first-match regex whose miss fell through to
`DEFAULT_SUBMIT_CATEGORY` ("💻 Developer Tools"), so that bucket means both "a developer tool"
and "we could not tell". `lib/categoryClassifier.ts` asks Jev against the real category list and
only takes answers at confidence ≥ 0.75. The enrich cron runs it for every listing in its main
batch, and also checks up to 10 default-category listings per tick (category only, round-robin
by `logoCheckedAt`), so listings with otherwise complete metadata get re-asked too.

## Coverage dashboard

The admin analytics view (`app/admin/CatalogCoverageCard.tsx`, fed by `GET /api/admin/coverage`
and `lib/catalogCoverage.ts`) shows, for servable listings, the count and share with each field:
indexable (the sitemap rule in `lib/listingIndexability.ts`), writeup, FAQ, tools (verified,
README-only, none), install, logo, website, specific category, vuln-scanned, and health-checked in
the last 7 days. The same card lists the most-missed searches of the last 30 days from the
`search_misses` table, a to-do list for sourcing and content.

## Secrets

| Secret | Where | Purpose |
|--------|-------|---------|
| `CRON_SECRET` | Site Worker (relayed to the jobs Worker) + GitHub Actions repo secrets | Authorize cron HTTP calls |
| `GITHUB_TOKEN` | **Worker only** (`wrangler secret put GITHUB_TOKEN`) | Authenticated GitHub API rate limits (~5k/hr) |

The jobs Worker has no secrets of its own: it pulls the `JOB_SECRET_NAMES` allowlist from the site
over the `SITE_SECRETS` binding, so a cron that needs a new secret must be added to that list.

`GITHUB_TOKEN` here is **not** Actions' automatic `GITHUB_TOKEN` (that only exists on the runner
and never reaches Cloudflare). Without the Worker PAT, calls are unauthenticated (~60 req/hour) and
enrichment crawls. Use a classic or fine-grained PAT with read access to public repositories.

## Manual kick

```bash
curl -X POST https://allmcps.com/api/cron/enrich \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Code

- `app/api/cron/health/route.ts`
- `app/api/cron/enrich/route.ts`
- `app/api/cron/ai-content/route.ts`, `lib/aiContentQueue.ts`, `lib/aiContent.ts`
- `lib/listingEnrich.ts`, `lib/categoryClassifier.ts`
- `lib/catalogCoverage.ts`, `app/api/admin/coverage/route.ts`
- `lib/cronSchedule.ts`, `custom-worker.ts`
- `lib/githubAuth.ts`, `lib/cronAuth.ts`
