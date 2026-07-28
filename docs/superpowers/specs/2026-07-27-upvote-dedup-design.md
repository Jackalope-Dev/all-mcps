# Server-side upvote dedup design

## Problem

MCP server listings have an "upvote" (heart) feature (`components/ui/UpvoteButton.tsx`,
`app/api/mcp/[id]/metric/route.ts`, `upvotes` column on `servers`). The only
duplicate-vote protection today is a `localStorage` flag set per `serverId` in the
browser. It's per-server (a visitor can upvote every listing once each, just not the
same listing twice from the same browser), and it's trivially bypassed: clearing
storage, an incognito window, a different browser, or calling the API directly all let
the same visitor inflate a listing's count with no server-side check at all.

Goal: add a real server-side dedup check, proportionate to the fact that this is a
low-stakes vanity metric, not a security-critical system.

## Non-goals

- No account/login-based voting (auth system is still in progress elsewhere).
- No CAPTCHA/Turnstile on this endpoint — disproportionate for a heart-click.
- No cross-listing rate limiting or bot detection beyond the dedup check itself.
- No retroactive cleanup/migration of existing `upvotes` counts.

## Design

### Mechanism: hashed IP, no new cookie

Chosen over a signed cookie or "both" because of the site's existing privacy posture
(`app/privacy/page.tsx`): it currently states the public site "does not set marketing,
advertising, or analytics cookies" and that ordinary visitors get no cookie at all. A
functional anti-abuse cookie would be defensible, but would require walking that
language back. Server-side IP hashing needs no new cookie and fits within the already
disclosed "IP address ... used for security, abuse prevention" processing.

Known tradeoff: shared IPs (offices, campus NAT, some VPNs, CGNAT) mean a second
person behind the same address can't upvote a listing someone else on that address
already upvoted. Acceptable for a low-stakes feature; not acceptable if this becomes
higher-stakes later.

### Storage: new D1 table (not KV)

`wrangler.jsonc` only binds `DB` (D1) today — no KV namespace exists. Adding KV would
be new infra for no real benefit here. A D1 table gives an atomic uniqueness guarantee
(`INSERT OR IGNORE`, check rows-affected) that KV's eventual consistency can't; two
racing requests from the same IP can't both succeed.

```sql
CREATE TABLE upvote_records (
  server_id TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (server_id, ip_hash)
);
```

Add via `drizzle-kit` the same way existing migrations under `drizzle/` were
generated, and add the corresponding table to `db/schema.ts`.

### Hashing

`ip_hash = SHA-256(clientIp + serverId + PEPPER)`, where `PEPPER` is a new secret
(set via `wrangler secret put`, not added to the `vars` block in `wrangler.jsonc`).
A bare hash of an IP is crackable via rainbow table (IPv4 space is small); salting
with a server-only secret prevents that.

`clientIp` is read from the `CF-Connecting-IP` request header — Cloudflare's
canonical client IP, more trustworthy than `X-Forwarded-For` (which existing routes
like `app/api/submit/route.ts` use for Turnstile, but which a client can more easily
influence upstream of Cloudflare).

### API change — `app/api/mcp/[id]/metric/route.ts`

Only the `"upvote"` case changes (`"view"` and `"copy"` are untouched — they're not
meant to be deduped).

1. Compute `ip_hash` for the request.
2. `INSERT OR IGNORE INTO upvote_records (server_id, ip_hash, created_at) VALUES (...)`.
3. If rows-affected is 0 (conflict — already voted), respond `409` with
   `{ success: false, alreadyVoted: true }` and do **not** increment `servers.upvotes`.
4. If rows-affected is 1, increment `servers.upvotes` as today and respond
   `{ success: true }`.

### UI change

`app/mcp/[id]/page.tsx` (server component): query `upvote_records` for the current
request's IP hash + this server's id, and pass the result as `initialHasUpvoted` into
`UpvoteButton`. This means a visitor who's already voted (e.g. from another browser
session, or the localStorage flag got cleared) sees the button already in its
"upvoted" state on first paint, rather than being able to click it and see an
optimistic +1 that then gets silently reverted.

`components/ui/UpvoteButton.tsx`:
- Accept `initialHasUpvoted` prop; seed `hasUpvoted` state from
  `initialHasUpvoted || localStorage flag`.
- On a `409` response from the POST: undo the optimistic `+1` (the click didn't
  register a new vote server-side, so the count should return to its pre-click
  value), but set `hasUpvoted = true` and keep the localStorage flag set rather than
  resetting to the clickable state. This differs from the existing `catch` (network
  failure) path only in the end state: both undo the `+1`, but `catch` leaves the
  button clickable again while `409` leaves it permanently disabled/voted.

### Privacy policy touch-up — `app/privacy/page.tsx`

The "Aggregate usage metrics" paragraph currently states counters are "not linked to
any individual visitor, account, or device identifier." That's no longer fully
accurate — a hashed IP is a device/network identifier, even one-way hashed and never
exposed. Add one sentence disclosing that upvotes are additionally checked against a
one-way-hashed, salted record of the submitting IP address solely to prevent repeat
voting, and that the hash cannot be reversed to recover the IP and isn't used for any
other tracking purpose.

### Retention

Records are kept indefinitely — no cleanup cron job. YAGNI: this is a first pass: no
existing evidence this needs active pruning, and adding a scheduled purge job is
extra surface for a low-stakes feature.

Known tradeoff, noted for future reference: residential/mobile IPs get reassigned
over time, so a visitor could inherit an IP address that's already "used up" for a
given listing and be unable to upvote it. Acceptable for a vanity metric; revisit if
this becomes a real complaint pattern.

## Testing plan

- Unit-level: hashing function produces stable output for same inputs, different
  output for different `serverId` (same IP can upvote multiple listings) and
  different IP (different visitors are independent).
- Route test: first `upvote` POST for a given (server, IP) succeeds and increments;
  second POST for the same pair returns `409` and does not increment further.
- `view` and `copy` metrics remain un-deduped (can be incremented repeatedly).
- UI: manually verify in a private window that a listing already upvoted from that
  IP renders pre-disabled (`initialHasUpvoted`), and that clicking an already-voted
  button (e.g. via direct API call after localStorage is cleared) reflects the `409`
  path rather than a revert.

## Open risks / accepted tradeoffs (recap)

- Shared IPs can block legitimate distinct visitors from upvoting the same listing.
- Reassigned IPs can permanently block a new occupant from upvoting a listing a
  previous occupant already upvoted.
- Not resistant to a determined attacker rotating IPs (VPN/proxy). Full protection
  would require tying votes to authenticated accounts, deferred until the in-progress
  auth system lands.
