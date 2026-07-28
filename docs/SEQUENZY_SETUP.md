# Sequenzy setup (AllMCPs subscriber sync)

## Secrets (Workers / local)

```bash
SEQUENZY_API_KEY=seq_...   # data_ingest_safe scoped key, see lib/sequenzy.ts
```

Do **not** commit this key. It's created via the Sequenzy dashboard or MCP `create_api_key`
tool, scoped to `data_ingest_safe` (create/tag subscribers only — this key ships in a
publicly-deployed Worker's server-side code, never the client bundle).

Production also needs this secret set on the deployed Worker (same mechanism as
`STRIPE_SECRET_KEY` — see `docs/STRIPE_SETUP.md`'s "Secrets (Workers / local)" section):

```bash
npx wrangler secret put SEQUENZY_API_KEY
```

Until this is set, every submission and Stripe checkout logs a `console.warn` and the sync
silently no-ops — submissions and webhooks still succeed either way, but no one gets synced.

## What syncs where

- `POST /api/submit` — every submitter is added to the "Product Subscribers" list
  (`x8r0du7z66k34tdyuwnsvxwt`) tagged `submitted-listing`.
- `POST /api/stripe/webhook` — on `checkout.session.completed`, the same subscriber (matched by
  email) gets tagged `paid-priority_review`, `paid-featured_7d`, or `paid-premium_monthly`.
- Suppression (not emailing people who already paid) is handled by Sequenzy's **native Stripe
  integration**, already connected in the dashboard — it auto-tags any matching subscriber
  `customer`. The `paid-*` tags above are for future segmentation only, not suppression.

## App routes touched

- `lib/sequenzy.ts` — shared client
- `app/api/submit/route.ts` — subscriber creation
- `app/api/stripe/webhook/route.ts` — purchase tagging
