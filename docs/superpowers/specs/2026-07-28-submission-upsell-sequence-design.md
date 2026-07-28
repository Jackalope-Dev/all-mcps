# Submission upsell sequence

## Problem

The previous piece (`2026-07-28-submitter-email-stripe-sequenzy-design.md`) wired every submitter
into Sequenzy tagged `submitted-listing`, and every Stripe purchase into a `paid-*` tag plus the
account's native Stripe integration auto-tagging `customer`. Nothing acts on those tags yet — no
sequence exists (`list_sequences` returns empty). This spec is the actual automation: a 3-email
arc nudging non-paying submitters toward Priority Review, Featured Boost, or Premium, that stops
the instant someone pays for anything.

## Sequence configuration

Created via `create_sequence` with explicit `steps` (no AI generation — copy is hand-written
below, per product decision to review exact wording before anything can send).

- **Name:** "Submission Upsell"
- **Trigger:** `tag_added`, `tagName: submitted-listing`
- **Enrollment mode:** `one_time` — a subscriber who submits a second listing later won't
  re-trigger the arc from a listing they already ran it for (consistent with the prior spec's
  submit-time tagging decision).
- **Stop condition:** `{ type: 'has_tag', value: 'customer' }` — the account's native Stripe
  integration (already connected, see `list_integrations`) tags any subscriber `customer` the
  moment they complete a Stripe purchase, for any of the three SKUs. This is the sole suppression
  mechanism; no custom code checks it.
- **Sender:** `senderProfileId: p1dmte08v6jd67cnlvz43396` (`hello@hello.allmcps.com`, verified
  domain, account default) — **Reply-To:** `replyProfileId: nmr7hkbzz2qpkq3mgs7dmhjk`
  (`cadenjsumner@gmail.com`, account default).
- **Known limitation:** nothing syncs admin approve/reject decisions back to Sequenzy, so a
  rejected submission still receives all 3 emails (the CTA link degrades gracefully — see below —
  but the copy's "in the queue" framing would be stale). Fixing this means syncing listing status
  transitions to Sequenzy, which is separate scope; noting it here rather than silently accepting
  a bad rejected-submitter experience.

## Why one CTA URL works for all three emails

Every email's button points to `https://allmcps.com/pricing?serverId={{serverId}}` (the
`serverId` custom attribute set at submit time — merge tag syntax confirmed empirically via
`render_email`: `{{serverId}}` resolves in both body text and button URLs; the plausible
`{{customAttributes.serverId}}` form does **not** resolve, so must not be used anywhere in this
sequence). `/pricing` (`app/pricing/PricingClient.tsx` → `PremiumUpgrade`) already renders only
the upgrade options valid for the listing's *current* status — Priority Review only while
`pending`, Featured/Premium only once `active` — so the same link can never dead-end into a
disabled purchase regardless of how the review timeline actually plays out relative to the
email's send time.

## Email content

All three: marketing (not transactional — real unsubscribe footer applies, consistent with the
prior spec's single-consent-field decision), plain paragraph + single button layout matching the
site's understated tone (`BRAND_GUIDE.md`: "Modern, Trustworthy, Enterprise SaaS" — no hype
language). Benefit phrasing pulled directly from `lib/pricing.ts`'s existing `PAID_PRODUCTS` copy
for consistency with the pricing page.

### Email 1 — delay 2 hours after trigger

- **Subject:** `Thanks for submitting {{serverName}}`
- **Preview text:** `It's in our review queue — here's how to speed that up.`
- **Body:**
  - Heading: `Thanks for submitting {{serverName}}`
  - Paragraph: `Your listing is in our review queue. Most free submissions are reviewed within a
    few days. If you'd rather not wait, Priority Review moves your listing to the front of the
    queue for $5 — same safety checks we run on every submission, just faster.`
  - Button: `Get priority review — $5` → `https://allmcps.com/pricing?serverId={{serverId}}`

### Email 2 — delay 3 days after email 1

- **Subject:** `Get {{serverName}} more visibility this week`
- **Preview text:** `A 7-day featured boost puts your listing in front of more people.`
- **Body:**
  - Heading: `Ready for more eyes on {{serverName}}?`
  - Paragraph: `Once your listing is live, a Featured Boost puts it in the spotlight across
    AllMCPs for 7 days — a featured badge, and higher placement in homepage discovery. It's a
    one-time $12, and turns off automatically after a week — no subscription to cancel.`
  - Button: `Feature my listing — $12` → `https://allmcps.com/pricing?serverId={{serverId}}`

### Email 3 — delay 4 days after email 2

- **Subject:** `Keep the spotlight on {{serverName}}`
- **Preview text:** `Premium keeps your listing featured, verified, and linked — for as long as
  you want.`
- **Body:**
  - Heading: `Keep the spotlight on {{serverName}}`
  - Paragraph: `Premium ($19/month) keeps your listing in the featured rotation continuously,
    adds a dofollow link back to your site, a verified/Premium badge, and visibility stats (views,
    installs, upvotes) so you can see what's working. Cancel anytime.`
  - Button: `Go Premium — $19/mo` → `https://allmcps.com/pricing?serverId={{serverId}}`

## Error handling

None needed at the application level — this piece is entirely Sequenzy-side configuration (no
new app code, no new routes). The prior spec's fire-and-forget Sequenzy calls are what feed this
sequence's trigger and stop condition; this spec only defines what Sequenzy does once tagged.

## Testing

- After creating the sequence as a **disabled draft** (per `create_sequence`'s own behavior — "The
  saved draft appears in list_sequences... Never call enable_sequence unless the user explicitly
  asks to activate it"), use `render_email` against each step with a sample subscriber
  (`customAttributes: { serverId: 'test-mcp', serverName: 'Test MCP' }`) to visually confirm all
  three emails render with correct merge tag substitution and working button URLs.
- Use `send_sequence_test_email` to deliver a real test send of each step to a real inbox before
  asking the user to enable the sequence.
- Do not call `enable_sequence` — that is an explicit, separate user decision (real money on the
  line, real emails to real submitters) outside this spec's scope.
