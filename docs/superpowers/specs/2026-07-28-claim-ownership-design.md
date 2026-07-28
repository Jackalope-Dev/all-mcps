# Claim ownership, owner edits, and reciprocal dofollow

## Problem

`POST /api/claim` (`app/api/claim/route.ts`) verifies proof of control (GitHub README badge,
website badge/meta tag, or DNS TXT) but never checks who's asking, and never persists a
relationship to an account. `db/schema.ts` already has `servers.ownerUserId` ("Auth.js user id
after claim, optional until owners sign in") and `servers.pendingRevision` ("JSON blob of pending
owner edits awaiting admin approval") — added in migration `0007_stripe_premium.sql` — but no
application code reads or writes either column. Magic-link auth (`lib/auth.ts`, NextAuth + Resend)
is already wired up and a `/login` page exists; `ListingStatusEmail`'s rejected-state button
already links to `https://allmcps.com/dashboard`, which doesn't exist yet.

Goal: require sign-in to complete a claim, tie the listing to that account, let owners propose
edits through a dashboard that go through admin approval before going live, and extend the
existing dofollow policy so a free (non-premium) claimed listing can earn a dofollow website link
by keeping a reciprocal AllMCPs badge live on their site — rechecked periodically, not just at
claim time.

## Data model

New migration `0008` adds two columns to `servers` (no other schema changes — `ownerUserId` and
`pendingRevision` already exist and are unused):

- `reciprocal_badge_ok` (integer/boolean, default false) — whether the last periodic check found
  our badge/link still live on the owner's site (or, for GitHub-only listings, in the README).
  Drives dofollow eligibility for non-premium claimed listings.
- `badge_last_checked_at` (integer/timestamp, nullable) — last time the reciprocal check ran for
  this listing, so the cron batches oldest-first (mirrors the existing `lastCheckedAt` pattern in
  `app/api/cron/health/route.ts`).

`pendingRevision` remains a single JSON blob — one outstanding draft edit per listing, not a
history/queue. A new edit submission overwrites whatever draft was previously pending (the owner
is editing their own draft, not queueing multiple revisions).

## Auth plumbing

No `SessionProvider`/`useSession` exists in this app; every page today fetches server-side and
passes data as props to a client component (e.g. `app/admin/page.tsx` → `AdminClient`). Follow
that convention rather than adding client-side session hooks:

- `app/mcp/[id]/claim/page.tsx` calls `auth()` server-side and passes `session?.user ?? null` into
  `ClaimClient`.
- `ClaimClient`'s "Verify & claim" action: if no session, redirect to
  `/login?callbackUrl=/mcp/[id]/claim` instead of calling the API. Everything else in the claim UI
  (choosing a method, seeing DNS/badge instructions, attaching a website) stays usable
  unauthenticated — the login wall sits only at the final verify click.
- `app/login/page.tsx` reads a `callbackUrl` search param and passes it to
  `signIn('resend', formData, { redirectTo: callbackUrl })` (today it ignores any redirect target).
- `app/api/claim/route.ts` calls `auth()` itself — never trusts a client-only gate — and returns
  401 if there's no session for the `github`/`website_badge`/`dns` (claim/re-verify) methods. The
  `attach_website` method additionally requires `session.user.id === server.ownerUserId`.
- On successful verification, set `ownerUserId = session.user.id`, overwriting any prior value.
  Per product decision: proof-of-control is the actual security boundary, not "first claimer
  wins" — if a second signed-in user legitimately passes the same GitHub/badge/DNS check, they
  control the repo/site now, so ownership transfers to them.

## Owner dashboard (`/dashboard`)

- Server component gated by `auth()` — redirects to `/login?callbackUrl=/dashboard` if no session.
- Lists servers where `ownerUserId === session.user.id`, styled like `AdminClient`'s table (same
  visual pattern, separate component — different actions, no admin-only fields).
- Each row shows live values, an "Edit" action opening a form for `name`, `description`,
  `category`, and `websiteUrl`, and a pending-edit banner ("Awaiting review since <date>") if
  `pendingRevision` is already set, with the ability to edit/replace that draft.
- New `POST /api/dashboard/edit` route: verifies the session owns that listing (403 otherwise),
  diffs the submission against live values, stores the diff as JSON in `pendingRevision` — live
  fields are untouched until admin approval — and sends the admin a `NotificationEmail` ("New
  pending edit: <name>", linking to the admin panel).
- A `websiteUrl` change flows through the same `pendingRevision` blob. Approving it updates the
  live `websiteUrl` but does **not** mark it verified — `websiteVerified` is forced to `false` on
  approval, and the owner must re-prove control via DNS/badge same as today. Admin approval is a
  content-moderation decision, not a proof-of-control mechanism.

## Admin review queue

Extends the existing `AdminClient`/`admin/action` pattern rather than building a parallel system:

- `app/admin/page.tsx` adds a query for servers where `pendingRevision IS NOT NULL`, passed to
  `AdminClient` as `initialPendingEdits`.
- New "Pending edits" section in `AdminClient` renders a before/after diff per row (parse the JSON
  blob, show current vs. proposed for each changed field) rather than just the proposed state.
- `app/api/admin/action/route.ts` gains two actions:
  - `approve_edit` — applies the diff to live columns, clears `pendingRevision`, forces
    `websiteVerified = false` if `websiteUrl` was part of the diff.
  - `reject_edit` — clears `pendingRevision`, optionally carrying a feedback string.
- Both send the owner a `NotificationEmail` (the existing generic template — heading/message/
  action — reused as-is rather than overloading `ListingStatusEmail`, which is worded specifically
  for new-submission approval, not edits).

## Dofollow policy: premium OR reciprocal badge

- Proof-of-control verification (DNS TXT, website badge, GitHub README) stays available to every
  claimed listing regardless of premium status — unchanged from today.
- `lib/linkRel.ts`'s `websiteLinkRel` gains a second parameter: the link is dofollow if
  `isPremium || reciprocalBadgeOk`. Premium listings skip the recheck (already dofollow).
- `app/api/cron/health/route.ts` already rechecks GitHub README badges each cycle as a "viral
  loop" and toggles `isOfficial` based on presence. Extend it: when that recheck passes, also set
  `reciprocalBadgeOk = true` (a repo README badge counts as reciprocal). For listings with a
  separate `websiteUrl`, add the same periodic re-fetch there using `verifyWebsiteHtml`'s
  `hasBadgeLink` check specifically — **not** satisfied by the hidden meta-tag-only path, since a
  meta tag gives AllMCPs no real backlink value and "reciprocal" should mean an actual visible
  link back.
- `badgeLastCheckedAt` lets this batch oldest-first inside the same cron call — no new cron
  trigger needed.
- If the badge disappears on a later recheck, `reciprocalBadgeOk` flips back to `false` and the
  link reverts to nofollow on next render — no admin action required in either direction.

## Security

- Every new/changed route re-derives identity from `auth()` (or `getAuthorizedAdminEmail` for
  admin routes) server-side — never trusts a client-supplied user id or email.
- `POST /api/dashboard/edit` checks `server.ownerUserId === session.user.id` before writing
  `pendingRevision`, returning 403 otherwise — guards against editing a listing by guessing its id.
- The reciprocal-badge recheck reuses the existing `isSafeSubmissionUrl`/`isSafeFetchTarget` SSRF
  guards already applied to `verifyWebsiteHtml` and the claim flow — no new outbound-fetch surface.

## Testing

No test framework exists in this repo today; verify with a manual smoke-test pass:

- Claim as user A → `/dashboard` shows the listing → submit an edit → admin sees a correct
  before/after diff → approve → live fields update and A is emailed.
- Submit another edit → reject with feedback → `pendingRevision` clears and A is emailed with the
  feedback.
- User B (different account) re-proves control of the same listing → `ownerUserId` reassigns to B.
- Edit changes `websiteUrl` → after admin approval, `websiteVerified` is `false` until re-verified
  via DNS/badge.
- Reciprocal badge removed from a live site → next `cron/health` run flips `reciprocalBadgeOk` to
  `false` → website link reverts to `nofollow`.
- Apply `0008` with `npx wrangler d1 migrations apply all-mcps --remote` before deploying.
