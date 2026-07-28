# Admin listing management: search, edit, publish state, and featured grants

## Problem

`app/admin/AdminClient.tsx` currently renders two sections: a "Pending submissions" queue
(unbounded) and an "Active listings (premium)" table capped at the 50 most recently created rows
(`app/admin/page.tsx`'s `.limit(50)`). There is no way to:

- Find a specific listing by name/URL once it's outside that 50-row window.
- Filter by premium, featured, or health status.
- Fix a typo in a listing's fields without waiting on the (separate, not-yet-built) owner
  edit-approval flow described in `2026-07-28-claim-ownership-design.md`.
- Remove an already-active listing (only pending rows can be deleted today, via `reject`).
- See or grant timed "featured" placement (`servers.featuredUntil` exists and is read by
  `lib/featuredStatus.ts`, but nothing in admin writes to it).
- See site-wide counts (how many pending/active, how many premium/featured, how many unhealthy)
  without querying the DB directly.

Goal: turn the admin page into a page that can find, edit, publish/unpublish, delete, and
featured-boost any listing, plus show an at-a-glance stats overview.

## Data model

No migration. `servers.status` is already a free-text column (`'pending'` | `'active'` today); this
adds a third value, `'removed'`, for soft-unpublish. Every public-facing query already scopes to
`status = 'active'`:

- `app/browse/page.tsx` (`eq(serversTable.status, 'active')`)
- `app/api/mcp/route.ts`
- `app/api/cron/health/route.ts` (only rechecks active listings)

So a `'removed'` row disappears from the site and stops being health-checked with no changes to any
of those files. `app/mcp/[id]/page.tsx` fetches by id regardless of status (existing behavior,
unchanged) — a removed listing's detail page stays directly reachable by URL but won't appear in
browse/API listings. That's acceptable for a reversible soft-unpublish and out of scope to change
here.

`servers.featuredUntil` (timestamp, nullable) already exists and already drives
`lib/featuredStatus.ts#isFeaturedListing`. No schema change needed for featured grants either.

## API routes

All routes below are gated the same way `app/api/admin/action/route.ts` is today: server-side
`getAuthorizedAdminEmail(req.headers)`, 401 if absent. They live under `app/api/admin/`, consistent
with the existing route.

### `GET /api/admin/listings`

Query params: `search` (matches `name` or `url` via SQL `LIKE '%term%'`, case-insensitive),
`status` (`pending` | `active` | `removed` | `all`, default `all`), `premium` (`true` | `false` |
omitted), `featured` (`true` = `featuredUntil > now`, omitted = no filter), `health` (`unknown` |
`healthy` | `archived` | `offline`, omitted = no filter), `offset` (default 0), `limit` (default 25,
max 100).

Returns `{ items: Server[], total: number }` — `total` is a separate `count(*)` query with the same
`where` clause, used for Prev/Next enablement and a "X of Y" label. This is the endpoint the new
"Manage listings" table calls on mount, on search/filter change (debounced ~300ms for `search`), and
on page change.

### `GET /api/admin/stats`

No params. Returns:

```ts
{
  statusCounts: { pending: number; active: number; removed: number };
  premiumCount: number;
  featuredCount: number; // featuredUntil > now, active listings only
  unhealthyCount: number; // status='active' AND healthStatus != 'healthy'
  engagement: { totalViews: number; totalUpvotes: number; totalCopies: number };
  topByViews: { id: string; name: string; views: number }[]; // top 5
}
```

Computed with a handful of aggregate queries (`count`, `sum`, `sql\`case when...\``, one `orderBy
desc(views) limit 5`) — no new tables. Called once on page load; the "Refresh" affordance is just
re-navigating/reloading the page (no live polling — this is a low-traffic internal tool).

### `POST /api/admin/action` — four new actions

Extends the existing `actionSchema` discriminated union (currently `approve` | `reject` |
`set_premium` | `unset_premium`):

- **`edit`** — body adds `fields: { name, description, category, url, websiteUrl }` (all optional;
  only provided keys are updated). Validates `url`/`websiteUrl` with the same
  `isSafeSubmissionUrl` check `app/api/submit/route.ts` uses (SSRF guard — no private/loopback
  targets), `name`/`description`/`category` just need non-empty strings after trim. Writes directly
  to the live columns — this bypasses the (separate, unbuilt) `pendingRevision` owner-approval flow
  entirely; when that flow ships later, admin edits and admin-approved owner edits both just update
  the same live columns, so there's no ordering conflict to design around now.
- **`unpublish`** — requires current `status = 'active'`; sets `status = 'removed'`.
- **`republish`** — requires current `status = 'removed'`; sets `status = 'active'`.
- **`delete`** — hard delete, `db.delete(servers).where(eq(servers.id, id))`. Allowed from any
  status (extends today's pending-only reject-delete to active/removed rows). No server-side
  confirmation step beyond the existing admin auth gate — the client enforces a `confirm()` dialog
  before calling it (see UI below), matching the "destructive action needs a pause" principle
  without adding new server complexity for a single-admin tool.
- **`feature`** — body adds `days: number` (positive integer, 1–365). Sets
  `featuredUntil = new Date(Math.max(now, currentFeaturedUntil ?? now) + days * 86400000)` — i.e.
  stacks on top of remaining time rather than resetting, per product decision (goodwill grants like
  "sorry you hit a bug, have 7 more days" should add, not overwrite).

Every mutating action keeps the current pattern: `.returning()` and a 404/400 if zero rows matched
the `where`.

## `app/admin/page.tsx`

Drops the `.limit(50)` active-listings query and the `getAdminData` active-fetch entirely — the new
`AdminClient` fetches its own "Manage listings" data client-side from `/api/admin/listings` (it
already needs to be a client component for search/filter/pagination interactivity, and the
page-load SSR fetch was already redundant with client-side actions re-syncing state). The server
component still SSR-fetches `pending` (unbounded, same as today — that queue is small and the
priority-review ordering matters at first paint) and now also SSR-fetches the stats payload so the
overview bar has no loading flash. `getAuthorizedAdminEmail` gate is unchanged.

## UI (`app/admin/AdminClient.tsx`)

Three sections, top to bottom, same inline-style visual pattern as today (dark cards, no new styling
system, consistent with `BRAND_GUIDE.md`'s dark-mode-first palette):

**1. Stats overview** — a row of small cards: Pending / Active / Removed counts, Premium count,
Featured count, Unhealthy count, and a compact engagement line (total views/upvotes/copies). Static
per page load (no polling).

**2. Pending submissions** — unchanged from today: same table, same Approve/Reject actions.

**3. Manage listings** (replaces "Active listings (premium)") —
- Search input (debounced) + four filter dropdowns (Status, Premium, Featured, Health).
- Table columns: Name/description (as today, plus a "REMOVED" badge next to PRIORITY/PREMIUM when
  `status === 'removed'`), Links, Submitted, Featured (shows "Xd left" from `featuredUntil` or "—",
  plus a small number input + "Grant" button next to it), Actions.
- Actions column: existing Premium toggle button, an "Edit" button that expands the row into an
  inline form (`components/ui/Input` for each field, Save/Cancel — Save calls `edit`, optimistically
  updates local state on success like the existing premium toggle does), an
  Unpublish/Republish toggle button (label depends on current status), and a "Delete" button that
  runs `window.confirm('Permanently delete "<name>"? This cannot be undone.')` before calling the
  `delete` action.
- Pagination: "Prev" / "Next" buttons + "Showing X–Y of Z", 25 rows/page, disabled appropriately at
  the ends.

All new fetches follow the existing `handleAction` pattern in `AdminClient.tsx`: `fetch` →
on success, patch local state and `toast.success(...)`; on failure, `toast.error(...)` with the
server's message. Search/filter/pagination state is separate local state that triggers a
`/api/admin/listings` refetch; a successful `edit`/`unpublish`/`republish`/`delete`/`feature` action
patches the currently-loaded page in place (no full refetch) the same way `set_premium` does today.

## Security

- Every new route re-derives identity from `getAuthorizedAdminEmail(req.headers)` server-side —
  same pattern as the existing `action` route, no new trust boundary.
- `edit`'s `url`/`websiteUrl` go through `isSafeSubmissionUrl` (existing SSRF guard), same as public
  submission — an admin typo shouldn't be able to point a listing at an internal address any more
  than a public submitter could.
- `search`'s `LIKE` parameter is passed through Drizzle's parameterized query builder (no raw SQL
  string interpolation), so no injection surface.
- `delete` and `unpublish` are irreversible/high-impact enough that the client requires a `confirm()`
  before calling `delete` (not for `unpublish`, which is reversible via `republish`).

## Testing

No test framework exists in this repo; verify with a manual smoke-test pass:

- Load `/admin` → stats bar shows correct counts matching a manual DB query.
- Search for a listing older than the previous 50-row cutoff → it's found.
- Filter by Premium=true, Featured=true, Health=offline independently and combined → row sets match
  expectations; pagination total updates accordingly.
- Edit a listing's name/description/category/url/websiteUrl → Save → row reflects new values
  immediately, DB row updated, live site reflects the change.
- Edit with a private/loopback `websiteUrl` (e.g. `http://127.0.0.1`) → rejected with a clear error,
  no DB write.
- Unpublish an active listing → disappears from `/browse` and `/api/mcp`, `/mcp/[id]` still loads
  directly → Republish → reappears in `/browse`.
- Grant +7 days featured on a listing with no `featuredUntil` → shows "7d left"; grant +7 again →
  shows "14d left" (stacked, not reset).
- Delete an active listing → confirm dialog blocks accidental clicks → confirmed delete removes the
  row from D1 and from the admin table.
- Pending queue and its Approve/Reject actions behave exactly as before (regression check).
