# Automated weekly newsletter digest

## Problem

Sequenzy's "Newsletter Subscribers" list now has real signups (piece 3), but nothing sends to it.
The ask is a recurring digest showcasing new and top submissions. Sequenzy's `schedule_campaign`
has a native `recurringInterval: 'weekly' | 'monthly'`, but its own description says each
recurrence "re-evaluat[es] audience membership every time" — it says nothing about regenerating
*content*, and there's no evidence anywhere in the tool surface of content that re-queries live
data per recurrence. A native recurring campaign would therefore resend the same static snapshot
every week, which fails the actual goal (fresh new/trending listings each time). This piece
generates fresh content every week from live data and does a one-off scheduled send each time —
recurrence is owned by our own weekly trigger, not Sequenzy's.

A related dead end, ruled out empirically before writing this spec: Sequenzy's `repeat`
block/`computedLists` mechanism looked like the natural way to template a list of items into an
email. Building a real test campaign and rendering it showed `computedLists` is Sequenzy's
**product recommendations** feature (tied to its commerce/product catalog), not a generic
array-templating tool — `get_campaign`'s own tool description confirms: "`computedLists` is email
personalization (product lists rendered inside the email), not audience targeting." Routing MCP
server listings through it would mean fake-syncing them as commerce "products." Instead, the
digest's `blocks` array is built directly in TypeScript — a loop emitting heading/text/button block
objects per listing — before ever calling `create_campaign`.

## Automation mechanism

This repo's existing cron pattern (`app/api/cron/health`, `app/api/cron/highlight`) is **not**
wired through `wrangler.jsonc`'s `triggers.crons` (no `scheduled()` handler exists in this
codebase) — it's driven by `.github/workflows/health-check.yml`, which curls the routes on a
schedule with `Authorization: Bearer ${{ secrets.ADMIN_SECRET }}`. This piece follows the same
convention with its own workflow file (a weekly cadence is a clean native GitHub Actions cron,
unlike the 4-hourly self-gating bash logic the highlight step needs).

## Data flow

- **`app/api/cron/newsletter-digest/route.ts`** (new): `POST`, gated by `isAdminAuthorized(req)`
  (same helper `lib/adminAuth.ts` already used by `health`/`highlight`).
  1. Query D1 via Drizzle:
     - `newListings`: `servers` where `status = 'active'` and `createdAt >= now - 7 days`, ordered
       by `createdAt` desc, limit 6.
     - `trendingListings`: `servers` where `status = 'active'`, ordered by the same trending score
       `DirectoryGrid.tsx` already computes (`upvotes * 5 + copies`) descending, limit 6,
       **excluding** any id already present in `newListings` (a listing shouldn't appear in both
       sections).
  2. If both arrays are empty, return `{ success: true, skipped: true }` without calling Sequenzy —
     never send an empty digest.
  3. Build `blocks`: an intro heading, then for `newListings` (if non-empty) a "New this week"
     heading followed by one heading+text+button block triple per listing (name, description
     truncated to ~140 chars, button linking to `https://allmcps.com/mcp/{id}`), then the same
     structure for `trendingListings` under a "Trending" heading, then a closing button linking to
     `https://allmcps.com/browse`.
  4. `create_campaign` with those blocks, a subject line naming the counts (e.g. "This week on
     AllMCPs: 3 new servers, 2 trending"), `targetLists: { type: 'lists', listIds:
     [NEWSLETTER_SUBSCRIBERS_LIST_ID] }`, and the same `senderProfileId`/`replyProfileId` as the
     submission upsell sequence (`p1dmte08v6jd67cnlvz43396` / `nmr7hkbzz2qpkq3mgs7dmhjk`).
  5. `schedule_campaign` with `scheduledAt` set to 10 minutes from now, **no** `recurringInterval`
     — this is always a one-off send; the weekly cadence comes from the GitHub Actions trigger
     re-running this route, not from Sequenzy repeating anything.
  6. Return `{ success: true, campaignId, newCount, trendingCount }`.
- **`.github/workflows/newsletter-digest.yml`** (new): triggers `cron: '0 14 * * 1'` (Monday 14:00
  UTC) and `workflow_dispatch`, curling `POST https://allmcps.com/api/cron/newsletter-digest` with
  `Authorization: Bearer ${{ secrets.ADMIN_SECRET }}` — same secret already used by
  `health-check.yml`, no new GitHub secret needed.

## Error handling

Unlike the fire-and-forget `syncSequenzySubscriber` pattern used elsewhere, this route's Sequenzy
calls (`create_campaign`, `schedule_campaign`) are the entire point of the request — failures
propagate as a non-200 response (visible as a failed GitHub Actions run, same as `health-check.yml`
today), not swallowed. A D1 query failure or a Sequenzy API error both result in `console.error` +
a 500, consistent with `health`/`highlight`'s existing `catch` blocks.

## Testing

- Manual: call the route locally against the real D1 + Sequenzy (test mode, `Authorization: Bearer
  <ADMIN_SECRET>`), confirm it returns real `newCount`/`trendingCount` matching what's actually in
  the local D1.
- Before ever letting this run for real: create one throwaway campaign via `create_campaign` using
  the exact block-building logic (same shape, sample data), `render_email` it to visually confirm
  the layout reads well and every button URL is correct, then `delete_campaign` it — mirrors how
  the merge-tag and repeat-block syntax were validated earlier in this project (both times, a
  guess about Sequenzy's content model was wrong until checked against a real render).
- Manual: trigger the GitHub Actions workflow via `workflow_dispatch` once to confirm the
  end-to-end path (D1 query → campaign creation → scheduled send) works. The 10-minute buffer
  between `schedule_campaign` and actual send is the real safety net for this first live run:
  after triggering, immediately check the created campaign in the Sequenzy dashboard (subject,
  block content, audience via `get_campaign_audience`) and call `cancel_campaign` within that
  window if anything looks wrong, before it reaches real subscribers.
