# TypeSafe (Jev) setup

Jev is TypeSafe's System One model. It answers typed questions — `choice`,
`score`, `noul` — and returns values with probabilities instead of prose, so the
decisions below no longer need an LLM call and a parser, or a regex list.

Everything here is **optional at runtime**. Every call site falls back to the
behaviour it had before, so an unset key, an outage, or a rate limit changes
nothing except that the improvement does not happen.

## The secret

One secret, named `TYPESAFE_API_KEY` (the name the official SDK also reads).

```bash
# Production Worker
npx wrangler secret put TYPESAFE_API_KEY

# Local dev — .dev.vars is gitignored
echo 'TYPESAFE_API_KEY=apikey_...' >> .dev.vars
```

Also add it as a **GitHub Actions repo secret** under the same name if you want
`backfill-enrich` and `registry-sync` (ingest) to classify/confirm while they
run. Without it those workflows still work; they just skip the Jev step.

Verify with `npx wrangler secret list`.

## Where it is used

| Call site | Primitive | Falls back to |
| --- | --- | --- |
| `app/api/cron/enrich` — category | `choice` over the 56 directory categories | The listing's existing category |
| `app/api/cron/enrich` — website/logo among README candidates | `choice` | Heuristic first-candidate / skip |
| `app/api/cron/auto-promote` — is this really an MCP server? | `noul` + quality `score` | Promoting, exactly as before |
| Submit / agent intake | same review; category `choice`; duplicate `score` | Accept pending; exact-URL 409 still applies |
| `scripts/ingest-sources.mjs` — flagged duplicate pairs | `score` (different / needs review / same) | Keep the heuristic SQL comment |
| `app/api/cron/ai-content` — writeup gate, auth/pricing/category, install pick | `noul`/`score`/`choice` | GPT writeup still runs; regex install still used |
| `scripts/backfill-categories.ts` — one-off sweep | `choice` | Reports zero changes |

All Worker/API paths go through `lib/typesafe.ts`, which owns the timeout, the
retry on `429`/`529`, and the rule that **every failure returns `null`**.
Callers treat `null` as "no opinion". Ingest talks to the same HTTP API
directly because that script is plain Node, not the TS Worker bundle.

Jev does **not** write listing copy. Summary, overview, `aiDoc`, and FAQ stay
on GPT.

## Confidence thresholds

The thresholds are the difference between replacing a regex and shuffling
listings at random, so they are named constants rather than inline numbers:

- `CATEGORY_CONFIDENCE_FLOOR` (`lib/categoryClassifier.ts`, **0.75**) — below
  this the existing category is kept. Sampling live listings put unambiguous
  ones at 0.96–1.00 and genuinely unclear ones at 0.26–0.54, so this separates
  "knows" from "guessing" with room to spare.
- `MCP_SERVER_NOUL_FLOOR` (`lib/listingReview.ts`, **0.15**) — deliberately far
  below the midpoint, because it gates automated *rejection*. Measured against
  live listings the two populations sit apart but not symmetrically: a curated
  list scored 0.02, while genuine servers ranged 0.36–0.78. Anything near 0.5
  would have held back a real server.
- Duplicate alignment (`lib/listingReview.ts`) is a **Score** with three
  levels: different / needs_review / same. `same` and `needs_review` 409 a
  submit; `different` lets a sibling listing through. Jev down keeps only the
  old name+site block.

Raise the category floor if you see bad moves; lower it once you trust it.

## The category backlog

Categories came from 23 first-match-wins regexes whose miss fell through to
"💻 Developer Tools", so that bucket means both "is a developer tool" and "we
could not tell" — about 38% of the catalog.

The `enrich` cron now re-derives the category of every listing it touches, so
the backlog drains on its own. To do it in one pass instead:

```bash
npx tsx scripts/backfill-categories.ts --limit=50   # dry run, writes SQL only
npx tsx scripts/backfill-categories.ts              # full default bucket
npx tsx scripts/backfill-categories.ts --apply      # write to D1
```

It writes a reviewable `drizzle/backfill-<date>-categories.sql` plus a matching
rollback file (both gitignored) and only touches the live database with
`--apply`. Start with `--limit` and read the diff before trusting it at scale.

## Cost and latency

Measured against live listings: **p50 ~145ms**, range 95–361ms, roughly
950 input / 565 output tokens per call. Several questions in one request cost
about the same as one, which is why `lib/listingReview.ts` and
`lib/listingSignals.ts` batch related questions rather than making one call
each.

`/api/cron/ai-content` runs on its own `*/20 * * * *` Worker cron so GPT
writeups neither wait four hours nor block the 15-minute health/enrich tick.
For a faster drain, `scripts/backfill-ai-content.mjs` still hits that
endpoint in a loop. Keep `ALLMCPS_BATCH_SIZE` at 6 on the shared Worker.
