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
`backfill-enrich` to classify while it runs. Without it that workflow still
works, it just leaves categories alone.

Verify with `npx wrangler secret list`.

## Where it is used

| Call site | Primitive | Falls back to |
| --- | --- | --- |
| `app/api/cron/enrich` — category per listing | `choice` over the 56 directory categories | The listing's existing category |
| `app/api/cron/auto-promote` — is this really an MCP server? | `noul` | Promoting, exactly as before |
| `scripts/backfill-categories.ts` — one-off sweep | `choice` | Reports zero changes |
| `lib/listingReview.ts` — duplicate pairs | `noul` | The caller's own heuristics |

All of it goes through `lib/typesafe.ts`, which owns the timeout, the retry on
`429`/`529`, and the rule that **every failure returns `null`**. Callers treat
`null` as "no opinion".

## Confidence thresholds

The two thresholds are the difference between replacing a regex and shuffling
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
about the same as one, which is why `lib/listingReview.ts` asks two at a time
rather than making two calls.
