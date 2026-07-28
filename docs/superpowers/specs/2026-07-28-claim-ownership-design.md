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

## Amendment: claim proof binding and new-website approval

The initial design above auto-approved every successful claim (any method) instantly. Review
surfaced two gaps in the underlying proof-of-control checks, both of which matter more now that a
successful claim grants real ownership (edit rights, dofollow eligibility) rather than just a
cosmetic badge:

1. `lib/verificationTokens.ts`'s token is `allmcps-site-verification=${serverId}` — deterministic
   and fully public (the id is visible in the URL). For the `website_badge`/`dns` claim methods,
   this means anyone can type in **any website they personally control**, prove control of *that*
   site, and be treated as having proven ownership of *the MCP listing* — even though nothing
   connects the two. This is a real listing-takeover path for the common case of a listing with no
   pre-existing `websiteUrl` on file.
2. Neither the website token nor the GitHub README badge check is bound to *which* signed-in user
   performed the check — they only prove "control exists right now," not "this specific account is
   the one who established it." Combined with the "allow ownership transfer" decision, a stale,
   never-removed token could let an unrelated signed-in account "re-verify" and take over a listing
   without ever having touched the site/domain themselves.

Resolution:

- **GitHub README method is unchanged** (still auto-approves instantly). Editing an upstream
  repo's actual README requires real, separately-authenticated repo access — a materially
  different trust boundary than "type in any URL." The precondition (badge present in the README)
  can only have been established by someone with real access to that specific repo.
- **DNS/website-badge claim checks become personalized.** `lib/verificationTokens.ts` gains
  `getClaimVerificationToken(serverId, userId)` → `` allmcps-site-verification=${serverId}:${userId} ``,
  distinct from the existing `getSiteVerificationToken(serverId)`. `verifyDnsTxt`/`verifyWebsiteHtml`
  (as used by the claim flow) now require this per-user token, not the generic one. The plain
  visible badge link (`websiteHasReciprocalBadge`) is **no longer sufficient to claim** — it stays
  generic and is used only for the periodic reciprocal-dofollow recheck (a different question:
  "does this site show our public backlink," not "who is claiming ownership"). This closes gap #2
  for the website path: a stale generic badge/link can no longer be replayed by an unrelated
  account to take over a listing.
- **New-website claims go through admin approval; reconfirming an on-file website does not.**
  Personalizing the token proves *who* controls the site, but still doesn't prove the site is
  *related* to the actual MCP project when there was no pre-existing `websiteUrl`. So: if the
  `website_badge`/`dns` proof succeeds against a URL that already matched `servers.websiteUrl`
  before this claim attempt, ownership is granted immediately (unchanged behavior — reconfirming
  what was already on file). If it succeeds against a **new or different** URL, the proof is stored
  as a pending claim (new `servers.pendingClaimUserId` / `servers.pendingClaimWebsiteUrl` columns,
  migration `0009`) instead of immediately setting `ownerUserId`/`isOfficial`; an admin reviews it
  in a new "Pending claims" section (parallel to the existing "Pending edits" one) and
  approves (sets `ownerUserId`, `isOfficial`, `websiteUrl`, `websiteVerified` from the stored
  values) or rejects (clears the two pending columns) it.
- **Claim-page UX consequence:** the DNS/meta-tag instructions shown for the `website_badge`/`dns`
  methods are now per-user, so they can't be rendered correctly before sign-in. Those two methods'
  instructions show a "sign in to get your personalized verification tag" placeholder until
  authenticated. The GitHub method's instructions are unaffected (not personalized) and remain
  visible pre-login, preserving the original "gate only the final verify click" intent for that
  path.

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
- Claim via `dns`/`website_badge` against a URL that matches the listing's existing `websiteUrl` →
  ownership granted immediately, no admin step.
- Claim via `dns`/`website_badge` against a *new* URL → listing shows up under "Pending claims" in
  admin, not immediately owned; approving sets `ownerUserId`/`isOfficial`/`websiteUrl`/
  `websiteVerified`, rejecting clears the pending columns without granting anything.
- A stale/generic badge link (no personalized token) does not satisfy the claim check even though
  it still satisfies the reciprocal-dofollow recheck.
- Apply `0008` and `0009` with `npx wrangler d1 migrations apply all-mcps --remote` before
  deploying.
