# Ingest servers from other directories — design

## Problem

The catalog was originally seeded once from `punkpeye/awesome-mcp-servers` (`scripts/seed.mjs`)
and has grown since via user submissions (`/api/submit`) and admin approval. Those source lists
(and the official `modelcontextprotocol/servers` README) have kept growing independently — we
have no repeatable way to pull newly-added entries in without re-scraping by hand or risking
duplicates.

## Sources (v1)

- `punkpeye/awesome-mcp-servers` README — same source and parse shape as the original seed.
- `modelcontextprotocol/servers` README — the official reference/community server list.

Both are plain-markdown `### Category` + `- [Name](url) - description` lists, so both reuse the
same parser. Broader sources (mcp.so, Smithery, PulseMCP, Glama, …) are deliberately out of
scope for v1 — each has its own API/HTML shape and its own terms to check before scraping, and
isn't needed to prove the pipeline out.

## Sources (v2) — the official MCP Registry

Added a third source: the [official MCP Registry](https://registry.modelcontextprotocol.io)
(`GET /v0.1/servers`, per the [aggregators
doc](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/registry-aggregators.mdx)).
It's a paginated JSON API rather than a markdown list, so it has its own fetch/parse function
(`fetchOfficialRegistryEntries`) instead of reusing `parseServerList`, but feeds into the same
downstream dedup/id/SQL pipeline via the shared `{name, url, description, category, source}`
entry shape.

- **Status filter**: only registry entries whose `_meta['io.modelcontextprotocol.registry/official'].status`
  is `active` are ingested — `deprecated`/`deleted` typically means spam, malware, or a
  moderation-policy violation, per the aggregators doc.
- **URL**: `repository.url` when present, else `websiteUrl` for remote-only servers with no repo
  link. Entries with neither are skipped (our schema requires `url`).
- **Auto-approve**: unlike the two README sources, official-registry candidates land with
  `status='active'` instead of `'pending'` — they're already vetted by the registry's own
  moderation policy, so they skip our admin review queue.
- **Dedup precedence**: registry entries are placed first in the merged entry list, so when the
  same repo also appears in one of the README sources, the registry's data (and its
  auto-approved status) wins the existing first-write-wins dedup in `main()`.
- **Fetch strategy**: stateless full re-fetch every run, same as the README sources — dedup
  against live DB state means a re-run only ever picks up what's new. The registry's
  `updated_since` cursor param exists for incremental sync if the registry grows large enough
  for a full page-through to matter; not needed yet.
- **Liveness pre-check**: the registry's own moderation doesn't verify submitted repo URLs are
  still live — confirmed in practice, the first live import (2026-08-10) included several
  already-404 entries. Since official-registry candidates otherwise skip admin review, each new
  one gets one lightweight `HEAD` (falling back to `GET` on 405/501) request before deciding
  `status` — a failed check demotes it to `'pending'` instead of publishing a dead link as
  `'active'`. Bounded to `LIVENESS_CONCURRENCY` (10) concurrent requests; only run against *new*
  candidates (typically low hundreds/week after the initial catch-up), not the full registry
  fetch. This is a best-effort filter, not a substitute for the health/enrich crons — a URL that
  passes at ingest time can still die later, which is what those crons are for.

## Sources (v3) — PulseMCP

Added a fourth source: [PulseMCP](https://www.pulsemcp.com)'s public JSON API
(`https://api.pulsemcp.com/v0beta/servers`, paginated via `?count_per_page=&offset=`, response
shape `{servers, total_count, next}`). Confirmed live 2026-08-26 at ~22,000 entries — roughly
double the catalog's size at the time, so unlike the official registry this source is **not**
auto-approved and gets its own quality floor and per-run cap so the admin queue doesn't get
flooded in one run.

- **Field mapping**: primary `url` = `source_code_url` → else `remotes[0].url_direct` → else
  `external_url` (never the `pulsemcp.com`/`www.pulsemcp.com` detail-page URL itself — that's
  their directory page, not the project's own site). `description` = `short_description` → else
  `EXPERIMENTAL_ai_generated_description`. `category` has no source field, so it's inferred the
  same way official-registry entries are (`inferCategoryFromSignals`).
- **Quality floor**: skip entirely (not even `pending`) unless at least one of —
  `github_stars >= 1`, `package_download_count >= 50`, a non-empty `remotes` array, or a distinct
  `external_url`. Filters the zero-signal tail (empty forks, one-off scripts) without being a
  strict bar.
- **Pre-populated install fields**: PulseMCP gives structured `package_registry`/`package_name`/
  `remotes` fields directly, so `installKind`/`installCommand`/`installArgs`/`installPackage`/
  `installConfidence`/`githubStars`/`npmDownloads`/`remoteEndpointUrl` are resolved at ingest time
  instead of waiting on the enrich cron's README-parse heuristic (`npm` → `npx`, `pypi` → `uvx`, a
  non-empty `remotes[0].url_direct` with no package → `installKind: 'remote'`). Unrecognized
  `package_registry` values are left unset — the enrich cron already handles that case for every
  other source.
- **Status**: always `'pending'` — PulseMCP isn't a moderation authority we've vetted the way the
  official registry is.
- **Liveness pre-check**: extended to cover pulsemcp candidates too (see `LIVE_CHECK_SOURCES`).
  Unlike the official registry (where a failed check demotes `'active'` → `'pending'`), a failed
  check here means the candidate is dropped entirely — `'pending'` is already the floor status,
  so a confirmed-dead new listing has no reason to occupy a review slot.
- **Volume cap**: after the quality floor and dedup, remaining pulsemcp candidates are sorted by
  `(github_stars desc, package_download_count desc)` and capped at `PULSEMCP_MAX_NEW_PER_RUN`
  (150). Uninserted candidates simply stay "new" on the next run (dedup is stateless against live
  DB state — see "Re-running" above), so the backlog drains top-quality-first over several runs.
- **Reliability**: confirmed live 2026-08-26 that repeated identical requests to this API
  alternate between `200` and `410 Gone` with no discernible pattern (not a page-size or offset
  limit — verified by re-requesting the exact same URL and getting different results). Treated as
  a flaky third-party dependency: each page gets `PULSEMCP_FETCH_RETRIES` (3) attempts with
  backoff before giving up; a page that still fails ends pagination gracefully and keeps whatever
  was already collected, rather than throwing. The whole pulsemcp fetch is additionally wrapped in
  its own `try/catch` in `main()` so a total failure there can never sacrifice the official-
  registry/README ingestion in the same run.
- **Operational kill switch**: `--only=<source>` / `--skip=<source1,source2>` CLI flags let a
  source be disabled without a code change. `.github/workflows/registry-sync.yml` runs with
  `--skip=pulsemcp` for its first several cycles — pulsemcp is run manually
  (`node scripts/ingest-sources.mjs --only=pulsemcp`, reviewing the generated SQL and the
  `/admin` pending queue) until it's proven out, then the flag is removed from the workflow.

**Known issue found while validating this** (pre-existing, not introduced here): the official
registry has grown past `OFFICIAL_REGISTRY_MAX_PAGES × 100` (30,000) entries and the weekly cron
now hits that safety cap (confirmed live 2026-08-26, `27,020`+ active entries fetched with pages
remaining) — meaning the tail of the registry has likely been silently missed for a while. Worth
raising the cap or switching to the registry's `updated_since` cursor as a follow-up; tracked
separately from the pulsemcp work above.

## Dedup strategy

Dedup key = normalized URL: lowercased, `.git` suffix stripped, trailing slash stripped, query/
hash stripped. This catches `https://github.com/Foo/Bar.git` vs `https://github.com/foo/bar`
vs `https://github.com/foo/bar/` as the same listing.

The script queries the live D1 `servers` table (`npx wrangler d1 execute all-mcps --remote`) for
every existing `url`, normalizes them the same way, and filters candidates against that set.
Candidates are also deduped against each other within the same run (mirrors the
`Map`-by-url dedup `seed.mjs` already does), since both source lists can list the same repo.

### Package-identity dedup (added with pulsemcp)

URL-only dedup misses a real case pulsemcp introduces: the same npm/PyPI package can be listed
under a different repo/marketing URL than the one already in the catalog (or with no repo URL at
all). A second exact key — `` `${ecosystem}:${packageName}` `` (`normalizePackageKey` in
`lib/urlDedup.ts`, ported into the script the same way `normalizeUrlKey` is) — is checked
alongside the URL key, both within a run and against the live DB (`existing`'s `install_command`/
`install_package` columns). Like the URL key, an exact package-key match silently drops the
candidate — no admin review needed, it's provably the same package.

### Duplicate-confidence flagging (review-only, never auto-skip)

Exact identity (URL or package) is deliberately the *only* thing allowed to silently drop a
candidate. But it misses a project renamed/re-hosted under a new owner, or the same name
resurfacing through a different URL shape. Corroborating signals raise confidence enough to flag
a candidate for human review — as a `-- ⚠ possible duplicate of '<id>' (<reason>): <url>` SQL
comment above its `INSERT`, and in the console summary — without ever silently merging or
rejecting a possibly-distinct listing:

- **Same GitHub owner + same name** (name collapsed via `normalizeNameKey`: lowercased, `mcp`/
  `server(s)` filler words stripped) — flagged on its own; owner identity is hard to fake.
- **Same name + same website domain**, but *only* when that domain is otherwise unique in the
  catalog. Confirmed live 2026-08-26 that this needs the uniqueness guard: `website_url` regularly
  holds a generic reference link shared across many unrelated listings (`docs.astral.sh/uv`: 36
  listings; the registry's own URL: 32; `nodejs.org`: 28), and — more subtly — independent
  wrappers around the same third-party service legitimately cite that service's own site (e.g.
  `weather.gov`, `sui.io`) as their "website," which means "same domain" there signals "wraps the
  same API," not "same author." `websiteDomainOf`/`isDistinctiveDomain` in the script require a
  domain to be used by at most one existing listing before it's allowed to corroborate anything,
  and never treat a code-hosting domain (`github.com`/`github.io`/`gitlab.com`) as a website match.
- **Same name + same package name** — package names are unique per registry (npm/PyPI don't allow
  two different packages to share a literal name), so this needs no uniqueness guard.
- **Name alone is never enough on its own** — two unrelated authors can genuinely both ship a
  "Polymarket MCP" (confirmed live 2026-08-26 across two different GitHub owners); without a
  corroborating signal, that's allowed through as a distinct listing rather than flagged.

## Id collisions

Row `id` is the primary key and the insert uses `ON CONFLICT(id) DO NOTHING`, so two unrelated
repos that slugify to the same id (e.g. two different projects both named "mcp-server") would
otherwise cause the second to be silently dropped instead of landing as a new listing. The
script also pulls existing ids, and on collision appends `-2`, `-3`, … until unique.

## Field mapping

| Field | Source |
|---|---|
| `id` | slugified name (existing convention), de-collided as above |
| `name` | list entry name |
| `url` | list entry URL |
| `description` | list entry description, run through `cleanListingDescription()` |
| `category` | list entry category heading, run through `normalizeCategory()` |
| `isOfficial` | `true` if the URL is under `github.com/modelcontextprotocol/servers` |
| `status` | `'pending'` for the README sources (existing admin review queue; doesn't affect the public `totalServers` count until approved). `'active'` for official-registry candidates — see v2 above. |
| `website_url` | Only set for official-registry candidates, from `websiteUrl` (when distinct from the primary `url`). README sources have no equivalent signal, so it's left `NULL`. |
| `createdAt` | `strftime('%s','now')` — seconds, matching `seed-sql.mjs`'s existing convention (not ms) |

Candidates that fail `isSafeSubmissionUrl()` are skipped, same guard `/api/submit` uses.

## Output, not auto-apply

The script never writes to the DB itself. It writes `drizzle/ingest-<date>.sql` (same shape as
`seed-sql.mjs`'s output) with one `INSERT ... ON CONFLICT(id) DO NOTHING;` per new candidate, and
prints a console summary (fetched / already-known / new count, first ~15 new names) for a quick
sanity check. Applying it is a separate, explicit step:

```bash
npx wrangler d1 execute all-mcps --remote --file=drizzle/ingest-<date>.sql
```

This keeps the actual production write a deliberate, reviewable action rather than something
that happens automatically as a side effect of running the fetch.

## Re-running

Because dedup is against live DB state (not a static snapshot), running the script again later
naturally only picks up whatever's been added to the two source READMEs since the last run — no
extra bookkeeping needed.

## Post-Ingest Hardening & Catalog Lifecycle

### 1. Multi-Interface Liveness Check (`isListingTrulyDead`)
To prevent unpublishing functional MCP servers whose source repository moved, was renamed, or went private, a listing is only marked `status = 'removed'` when **all** available interfaces are confirmed dead:
- **GitHub Repository**: Primary URL returns 404 or is archived.
- **Remote Endpoint**: Remote SSE/HTTP endpoint fails health checks (if present).
- **Package Registry**: Package installability check (`isPackageInstallable`) fails on both `npm` (`registry.npmjs.org`) and `PyPI` (`pypi.org/pypi/<pkg>/json`).

### 2. Search & Metric Isolation for Removed Listings
- **Total Platform Counts**: Only listings with `status = 'active'` are included in public server counts (`siteStats.ts`).
- **Search & Navigation**: `removed` listings are excluded from directory browse, category pages, search indexes, and XML sitemaps.
- **Direct Link Access**: Direct navigation to `/mcp/[id]` remains accessible for dead listings but carries `<meta name="robots" content="noindex, nofollow" />` and displays a persistent inline alert banner with a direct CTA to claim and fix the listing.

### 3. Submission Prefill Duplicate Detection & Claim CTA
- `lib/urlDedup.ts` checks incoming submission URLs against existing listings (across all statuses including `removed` and `pending`).
- If a match is found during `/api/submit/prefill` or `/api/submit`, the API returns a 409 conflict with duplicate details.
- `SubmitForm.tsx` displays an inline warning card with links to view or claim the existing entry rather than duplicating the record.

### 4. Automated Category Sorting via AI Content Pipeline
- Ingested listings without pre-assigned categories default to `"Developer Tools"`.
- The AI content cron (`app/api/cron/ai-content/route.ts` & `lib/aiContent.ts`) re-evaluates defaulted listings using LLM text classification against `DIRECTORY_CATEGORIES` to sort them into their optimal category.

### 5. Bulk Backfill Workflows
- **Health Checks (`.github/workflows/backfill-health.yml`)**: Manual-trigger GitHub Action loop executing `/api/cron/health` rounds to rapidly drain health verification backlogs after bulk imports.
- **Catalog Enrich (`.github/workflows/backfill-enrich.yml`)**: Manual-trigger GitHub Action loop executing `/api/cron/enrich` rounds to drain catalog enrichment backlogs (logos, descriptions, install hints, liveness checks).

