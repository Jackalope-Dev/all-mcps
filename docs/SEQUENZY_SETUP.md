# Sequenzy setup (AllMCPs subscriber sync)

## Secrets (Workers / local)

```bash
SEQUENZY_API_KEY=seq_...             # data_ingest_safe (custom: subscribers:read/write, events:write, tags:read, lists:read, segments:read, commerce:read/write) — see lib/sequenzy.ts
SEQUENZY_CAMPAIGNS_API_KEY=seq_...   # campaigns:read/write/send only — see app/api/cron/newsletter-digest/route.ts
```

Do **not** commit these keys. Both are created via the Sequenzy dashboard or MCP `create_api_key`
tool. They're deliberately separate, narrowly-scoped credentials rather than one broad key:
`SEQUENZY_API_KEY` only ever creates/tags subscribers; `SEQUENZY_CAMPAIGNS_API_KEY` only ever
creates and schedules campaign sends. Both ship in a publicly-deployed Worker's server-side code,
never the client bundle.

Production needs both secrets set on the deployed Worker (same mechanism as
`STRIPE_SECRET_KEY` — see `docs/STRIPE_SETUP.md`'s "Secrets (Workers / local)" section):

```bash
npx wrangler secret put SEQUENZY_API_KEY
npx wrangler secret put SEQUENZY_CAMPAIGNS_API_KEY
```

Until `SEQUENZY_API_KEY` is set, every submission, newsletter signup, and Stripe checkout logs a
`console.warn` and the sync silently no-ops — those flows still succeed either way, but no one
gets synced. Until `SEQUENZY_CAMPAIGNS_API_KEY` is set, the weekly digest cron (below) fails
outright (it has no fallback — sending the digest is the entire point of that request).

## What syncs where

- `POST /api/submit` — every submitter is added to the "Product Subscribers" list
  (`x8r0du7z66k34tdyuwnsvxwt`) tagged `submitted-listing`.
- `POST /api/newsletter/subscribe` — footer/homepage/modal signups are added to the "Newsletter
  Subscribers" list (`ta0zh9e3l9rcjlfpzpk80tcn`) tagged `newsletter-signup`.
- `POST /api/stripe/webhook` — on `checkout.session.completed`, the same subscriber (matched by
  email) gets tagged `paid-priority_review`, `paid-featured_7d`, or `paid-premium_monthly`.
- Suppression (not emailing people who already paid) is handled by Sequenzy's **native Stripe
  integration**, already connected in the dashboard — it auto-tags any matching subscriber
  `customer`. The `paid-*` tags above are for future segmentation only, not suppression.
- `POST /api/cron/newsletter-digest` (weekly, via `.github/workflows/newsletter-digest.yml`) —
  builds fresh new/trending-listing content from D1 and schedules a one-off campaign send to the
  Newsletter Subscribers list. Not a Sequenzy native recurring campaign — see the code comments
  and `docs/superpowers/specs/2026-07-28-newsletter-digest-design.md` for why.
- **Admin approve listing** (`POST /api/admin/action` `action=approve`) — sends the saved
  transactional template **`listing-approved`** (see `lib/sequenzyTransactional.ts`) with
  `MCP_NAME`, `LISTING_URL`, and `CLAIM_URL`, then tags the subscriber `listing-approved`.
  If Sequenzy send fails (missing key/scope), falls back to Resend `ListingStatusEmail`.
  Copy explicitly asks submitters to claim + verify their website + place a dofollow AllMCPs
  badge so free listings can earn a reciprocal dofollow backlink (DR growth).

### Transactional API key

`SEQUENZY_API_KEY` is scoped for subscriber write. Sending transactional templates also needs
`transactional:send` (or equivalent) on the key. Prefer a dedicated secret:

```bash
npx wrangler secret put SEQUENZY_TRANSACTIONAL_API_KEY
```

`lib/sequenzyTransactional.ts` tries `SEQUENZY_TRANSACTIONAL_API_KEY` first, then
`SEQUENZY_API_KEY`.

### Follow-up sequence (claim + free dofollow)

Sequence **Claim & free dofollow after approval**
(`c172a4d244834ec2b5f909c2`) triggers on tag `listing-approved` (one_time),
stops when tagged `customer`. Live as of activation.

https://sequenzy.com/dashboard/company/o9o6i6w0za04yal2c8ba7gag/sequences/c172a4d244834ec2b5f909c2

On admin **approve**, `syncSequenzySubscriber` sets `enrollInSequences: true` and
stores custom attributes `serverName`, `listingUrl`, `claimUrl` (plus
`MCP_NAME` / `LISTING_URL` / `CLAIM_URL` aliases) so sequence merge tags resolve.

## App routes touched

- `lib/sequenzy.ts` — shared subscriber-sync client
- `app/api/submit/route.ts` — submitter subscriber creation
- `app/api/newsletter/subscribe/route.ts` — newsletter signup subscriber creation
- `app/api/stripe/webhook/route.ts` — purchase tagging
- `app/api/cron/newsletter-digest/route.ts` — weekly digest campaign build + schedule
