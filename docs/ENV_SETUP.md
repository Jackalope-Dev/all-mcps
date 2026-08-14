# Environment variables & secrets (AllMCPs Worker)

Canonical list of every secret the app reads at runtime. Cross-checked against
`npx wrangler secret list` against the live Worker — as of this writing, all of the
secrets below **are already set in production**; this doc exists so the next
redeploy, environment recreation, or new teammate doesn't have to rediscover that by
watching something silently break.

Plaintext (non-secret) vars live in `wrangler.jsonc`'s `vars` block instead — see that
file for `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAIL`, `RESEND_TO_EMAIL`,
`RESEND_FROM_EMAIL`.

Stripe and Sequenzy secrets have their own setup docs — see `docs/STRIPE_SETUP.md` and
`docs/SEQUENZY_SETUP.md`. This file covers everything else.

## Auth & email

| Secret | Used by | Fails how if unset |
| --- | --- | --- |
| `AUTH_SECRET` | NextAuth (`lib/auth.ts`) — signs session JWTs | Read implicitly by `next-auth` itself, not a direct `process.env` reference in this repo, so it's easy to lose track of. Without it, session cookies can't be verified in production. |
| `RESEND_API_KEY` | `lib/auth.ts` (magic-link email), `lib/notify.ts`, `app/api/contact/route.ts` | Magic-link login and all outbound notification email (submission confirmations, admin alerts, listing-approved) silently fail to send. |

## Anti-abuse

| Secret | Used by | Fails how if unset |
| --- | --- | --- |
| `TURNSTILE_SECRET` | `app/api/submit/route.ts`, `app/api/newsletter/subscribe/route.ts`, `app/api/contact/route.ts` | Fails **closed**: an empty secret POSTed to Cloudflare's siteverify returns `success:false`, so the contact form, newsletter signup, and human `/submit` form all start returning 403 on every request — with nothing telling you why. Doesn't affect `/api/v1/submit` (the agent-facing endpoint), which never required Turnstile. |
| `UPVOTE_HASH_SECRET` | `lib/upvoteHash.ts` | Fails open/gracefully (`return null`) — upvote/view dedup silently disables instead of erroring, so this one is lower-severity but still worth setting. |
| `AD_EVENT_TOKEN_SECRET` | `lib/adEventToken.ts` (`app/api/ads/serve/route.ts` mints, `app/api/ads/event/route.ts` verifies) | Fails **open** (logs an error, then accepts the event) — without it, ad impression/click beacons aren't cryptographically tied to a real `/api/ads/serve` response, so the per-adId burst rate limit becomes the only defense against someone POSTing a scraped `adId` directly to inflate/burn through a campaign's purchased impressions. Not set yet as of this writing — see below. |

## AI content

| Secret | Used by | Fails how if unset |
| --- | --- | --- |
| `OPEN_AI_API_KEY` (or `OPENAI_API_KEY`) | `lib/openai.ts`, powers `app/api/cron/ai-content/route.ts` | That cron job (wired into `custom-worker.ts`'s every-4-hours schedule) fails quietly on every tick — no AI-generated listing enrichment. |

## Admin & integrations

| Secret | Used by | Fails how if unset |
| --- | --- | --- |
| `ADMIN_SECRET` | `custom-worker.ts` — bearer-auth for the cron dispatcher hitting `/api/cron/*` | Scheduled jobs (health check, enrich, ai-content, highlight, indexnow, newsletter-digest) can't authenticate against themselves. |
| `GITHUB_TOKEN` | Catalog enrichment — see `docs/CATALOG_ENRICH.md` | Enrichment falls back to unauthenticated GitHub API calls, which hit rate limits much faster. |
| `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_TOKEN_SECRET`, `TWITTER_BEARER_TOKEN` | `lib/twitter.ts` — auto-posts on listing approval and via the highlight cron | Posting silently no-ops. |
| `SEQUENZY_API_KEY`, `SEQUENZY_CAMPAIGNS_API_KEY`, `SEQUENZY_TRANSACTIONAL_API_KEY` | See `docs/SEQUENZY_SETUP.md` | Documented there. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | See `docs/STRIPE_SETUP.md` | Documented there. |

## Setting a secret

```bash
npx wrangler secret put SECRET_NAME
```

## Verifying what's set (names only, not values)

```bash
npx wrangler secret list
```
