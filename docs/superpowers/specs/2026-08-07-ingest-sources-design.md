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

## Dedup strategy

Dedup key = normalized URL: lowercased, `.git` suffix stripped, trailing slash stripped, query/
hash stripped. This catches `https://github.com/Foo/Bar.git` vs `https://github.com/foo/bar`
vs `https://github.com/foo/bar/` as the same listing.

The script queries the live D1 `servers` table (`npx wrangler d1 execute all-mcps --remote`) for
every existing `url`, normalizes them the same way, and filters candidates against that set.
Candidates are also deduped against each other within the same run (mirrors the
`Map`-by-url dedup `seed.mjs` already does), since both source lists can list the same repo.

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
| `status` | `'pending'` — always. Lands in the existing admin review queue; does not affect the public `totalServers` count until approved. |
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
