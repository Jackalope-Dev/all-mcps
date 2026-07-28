# Submitter email capture + Stripe ↔ Sequenzy tagging

## Problem

`SubmitForm` (`components/forms/SubmitForm.tsx`) and `POST /api/submit` (`app/api/submit/route.ts`)
never collect an email address — only `url`, `name`, `websiteUrl`, `description`, `category`.
Claimed listings eventually get an email via `servers.ownerUserId → users.email`, but an unclaimed
submitter (the target of a "you didn't pay for priority review / featured / premium" upsell) has
no email on file at all today.

Sequenzy (AllMCPs company, `o9o6i6w0za04yal2c8ba7gag`) already has a **native Stripe integration**
connected and syncing (`list_integrations` → `provider: stripe`, `syncEnabled: true`). It
auto-applies system tags (`customer`, `active`, `cancelled`, `past-due`, `churned`,
`saas.monthly`/`saas.yearly`, `trial`) to any subscriber whose email matches a Stripe customer.
Two existing lists — "Product Subscribers" and "Newsletter Subscribers" — and no sequences,
templates, or webhooks exist yet.

This is the foundation piece: without an email on every submission, no upsell sequence (a later,
separate spec) has anyone to send to.

## Scope

In scope:
- Add a required email field to the submit flow and persist it.
- Push every submitter into Sequenzy immediately on submit, tagged so a later sequence can target
  them.
- Extend the Stripe webhook to apply per-product tags in Sequenzy on purchase, for future
  segmentation (e.g. "upsell featured-only buyers toward premium").

Out of scope (separate specs): the upsell sequence content/steps itself, the newsletter signup UI,
the automated newsletter digest.

## Data model

Migration `0010_submitter_email.sql` adds one column to `servers` (next available number — `0009`
is already used by `pending_claim`):

- `submitter_email` (text, nullable) — email the submitter gave at submit time. Nullable because
  historical rows predate this column; new submissions always populate it (enforced by the API,
  not the DB, consistent with this table's existing pattern of app-level validation over DB
  constraints).

No other schema changes.

## Submit flow (`components/forms/SubmitForm.tsx`, `app/api/submit/route.ts`)

- Add an `email` input to the form (type `email`, required client-side via existing `Input`
  component pattern). Placed after the Name field. Helper text under it: "We'll email you about
  your listing status and occasional offers." — this is the entire consent mechanism (no separate
  checkbox), matching the site's existing single-field low-friction pattern; every marketing email
  sent later carries a working unsubscribe link, which is what makes implied consent here
  CAN-SPAM-compliant.
- `submitSchema` (zod) gains `email: z.string().email()`, required.
- On successful insert, store `submitterEmail: email` on the `servers` row.
- After the DB insert succeeds (not before — don't call Sequenzy if the submission itself fails
  validation), best-effort call `add_subscriber`:
  - `email`, `firstName` omitted (we don't collect a name field that maps cleanly to a person)
  - `listIds: [PRODUCT_SUBSCRIBERS_LIST_ID]`
  - `tags: ['submitted-listing']`
  - `attributes: { serverId: id, serverName: name }`
  - Wrapped in try/catch; log and swallow errors. A Sequenzy outage must never fail a submission.

## Stripe webhook (`app/api/stripe/webhook/route.ts`)

`applyCheckoutCompleted` gains one step after its existing DB update, for all three SKUs
(`priority_review`, `featured_7d`, `premium_monthly`):

- Resolve an email: prefer `session.customer_details?.email`, fall back to the `submitterEmail`
  already on the `servers` row (fetched via the `rows`/`current` lookups already present for the
  `featured_7d` branch — extend the other branches to select the row first too).
- If an email is resolved, best-effort call `update_subscriber` with
  `addTags: [\`paid-${sku}\`]` (i.e. `paid-priority_review`, `paid-featured_7d`,
  `paid-premium_monthly`).
- No call needed for suppression logic — the native Stripe integration already tags the same
  subscriber `customer` independently, which is what a later upsell sequence's `stopCondition`
  will key off. This webhook addition is purely for future fine-grained targeting (e.g. "bought
  featured, never upgraded to premium after 30 days").
- Same try/catch-and-log, non-blocking pattern as the submit route. Webhook must still return
  `{ received: true }` even if the Sequenzy call fails — Stripe retries webhooks on non-2xx, and we
  don't want Stripe retrying solely because Sequenzy hiccuped.

`applySubscriptionUpdated` / `applySubscriptionDeleted`: no changes. The native Stripe↔Sequenzy
sync already reflects `active`/`past-due`/`cancelled`/`churned` from subscription status changes;
duplicating that by hand would just risk drift between our tags and Sequenzy's own.

## Sequenzy-side setup (done via MCP tools, not app code)

- Confirm/reuse `PRODUCT_SUBSCRIBERS_LIST_ID` = `x8r0du7z66k34tdyuwnsvxwt` ("Product Subscribers").
- No sequence is created in this piece — `submitted-listing` and `paid-*` tags just need to exist
  and be applied correctly. The upsell sequence (next spec) will trigger on `tag_added:
  submitted-listing` with `stopCondition: { type: 'has_tag', value: 'customer' }`.

## Error handling

- Sequenzy calls from both routes are fire-and-forget: try/catch, `console.error` on failure, never
  thrown, never block or fail the HTTP response they're embedded in.
- Missing/failed GitHub prefill already behaves this way in `/api/submit` (see existing
  `catch (e) { console.error(...) }` around the GitHub fetch) — new code follows the same
  established pattern.

## Testing

- Manual: submit a listing in dev with a real test email, confirm the `servers` row gets
  `submitter_email` and the subscriber appears in Sequenzy (Product Subscribers list, tagged
  `submitted-listing`, with `serverId`/`serverName` attributes).
- Manual: run a Stripe test-mode checkout for each of the three SKUs against a submitted listing,
  confirm the corresponding `paid-*` tag appears on the same Sequenzy subscriber, and confirm the
  native integration's `customer` tag also lands (may take a few seconds — it's an async sync, not
  part of this webhook).
- No existing automated test suite covers `/api/submit` or the Stripe webhook (none found in the
  repo); this spec doesn't introduce one, consistent with the codebase's current testing posture
  for these routes.
