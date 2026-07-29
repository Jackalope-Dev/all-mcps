# Listing logo upload — design

## Problem

Listings currently have no logo/icon field. Cards, the detail page, and OG images all
render a deterministic gradient avatar generated from the server's name (`ServerIcon` in
`components/DirectoryGrid.tsx`). We want claimed owners to be able to upload a real logo.

## Decision: mirror, don't hotlink

We fetch/accept the owner's image once, validate and re-encode it server-side, and store
our own copy in R2 — we never render a user-supplied URL directly. Rationale: a public
directory listing shouldn't depend on an external, unmoderated, mutable resource on every
page load (broken images when their host disappears, silent post-approval swaps, CORS/
mixed-content issues, no control over dimensions). Re-encoding server-side also removes
the need to trust the uploaded bytes as-is (stripped metadata, no embedded payloads).

## Scope decisions

- **Who can upload:** claimed/verified owners only, from the dashboard — same trust bar as
  editing name/description/website today. Unclaimed submissions keep the gradient avatar.
- **Moderation:** every new/changed logo queues for admin approval before going live,
  consistent with the existing owner-edit review flow. Nothing uploaded is ever shown
  publicly before an admin approves it.
- **Formats:** raster only — PNG, JPEG, WebP. SVG is rejected outright (script/external-ref
  injection risk that would require a sanitizer or forced rasterization to support safely,
  not worth it for a directory icon).
- **Storage:** Cloudflare R2 (new `LOGOS` bucket binding), matching the existing
  Workers/D1 stack rather than introducing Cloudflare Images as a new paid vendor.

## Data model

Add to `servers` (`db/schema.ts`), independent of the existing `pendingRevision` text-diff
column (see "Why not `pendingRevision`" below):

```ts
logoUrl: text('logo_url'),          // live, approved logo URL; null = use gradient avatar
pendingLogoKey: text('pending_logo_key'), // R2 key awaiting admin approval; null = nothing pending
```

### Why not `pendingRevision`

`pendingRevision` stores a JSON diff of scalar text fields, produced/applied by
`lib/pendingRevision.ts`'s `diffEditableFields`/`serializePendingRevision`, and reviewed via
the generic `approve_edit`/`reject_edit` admin actions. A logo isn't a scalar value swap —
it's a file with its own storage side effects (write on upload, copy-and-delete on approve,
delete on reject) and its own object-in-R2 lifecycle. Reusing the text-diff mechanism would
mean special-casing it throughout that path anyway, and would incorrectly couple an
unrelated concern to the text-edit queue (e.g. rejecting a pending description edit would
also reject an unrelated pending logo). Dedicated columns keep the two concerns isolated.

## R2 layout

Bucket binding `LOGOS`, two key prefixes:

- `pending/<serverId>.png` — awaiting admin review
- `live/<serverId>.png` — currently approved and shown publicly

Always PNG regardless of input format, since the server re-encodes on upload (see below).

## Upload flow

1. Owner uploads an image from the dashboard (new `POST /api/dashboard/logo`, multipart,
   auth-gated the same way as `app/api/dashboard/edit/route.ts`: 401 if not signed in, 403
   if `server.ownerUserId !== session.user.id`).
2. Server validates and processes the file **before** touching R2 or the DB:
   - Reject if over 5MB (checked before decode, so we never decode an oversized payload).
   - Sniff actual magic bytes rather than trusting the declared `Content-Type` (blocks an
     SVG/HTML payload disguised with a `.png` extension/MIME type).
   - Decode with a WASM image library available in the Workers runtime (e.g.
     `@cf-wasm/photon` or `jsquash`); reject anything that fails to decode as a real
     raster image.
   - Reject if source dimensions are absurdly small (<32px) — not worth mirroring.
   - Resize/crop to a fixed 256×256 square and **re-encode** as PNG. Re-encoding (not just
     passing through the original bytes) is what strips embedded metadata/payloads
     (EXIF, ICC profiles, polyglot trailers), not the decode step alone.
3. Write the processed PNG to `pending/<id>.png` in R2. Only after that write succeeds,
   set `pendingLogoKey` on the `servers` row (write-then-commit ordering — a failed R2
   write never leaves a dangling DB pointer).
4. A new upload overwrites the previous pending object/key — one pending logo per listing
   at a time, no accumulation.
5. Notify the admin (same `sendNotificationEmail` pattern used by `dashboard/edit`).

## Admin approval flow

Extend the `action` enum in `app/api/admin/action/route.ts` with `approve_logo` /
`reject_logo`, alongside the existing `approve_edit`/`reject_edit`:

- **Approve:** copy `pending/<id>.png` → `live/<id>.png`, set `logoUrl` to the live object's
  public URL, delete the previous live object (if replacing one) and the pending object,
  clear `pendingLogoKey`. Notify the owner (existing `sendNotificationEmail` pattern).
- **Reject:** delete the pending object, clear `pendingLogoKey`. Notify the owner.
- **Stale-key race:** if the owner re-uploads while an admin's approve request is in
  flight, the approve reads-then-acts on whatever `pendingLogoKey` is current at that
  moment; if it's changed, the R2 copy of a since-deleted key just fails harmlessly and the
  action no-ops. Acceptable for a low-traffic admin queue — not worth a lock/transaction.

The admin panel (`AdminClient.tsx`) shows a pending-logo thumbnail next to any pending text
edit for that listing, with its own approve/reject controls.

## Serving

R2 bucket has public access enabled (or a thin `GET /logos/[id]` Worker route in front of
it) so `logoUrl` is a stable, directly linkable URL keyed by listing id (`live/<id>.png`).
Because a re-approved logo overwrites that same key/URL rather than getting a fresh one,
a long-lived `immutable` cache would serve a stale image after a re-approval. Use
`Cache-Control: public, max-age=300` (5 min) instead — bounds staleness without needing
cache-busting query params or a content-hash-keyed URL scheme.

## Rendering

`ServerIcon` (`components/DirectoryGrid.tsx`) and any other place a listing's icon renders
(detail page, OG image generator) takes an optional `logoUrl`:

- Present → render an `<img src={logoUrl}>` with an `onError` handler that falls back to
  the existing gradient avatar (in case an object ever 404s).
- Absent → unchanged gradient-avatar behavior.

## Cleanup on listing deletion

The admin `delete` action already deletes dependent rows with no FK cascade
(`servers.id` is plain text — see `upvoteRecords`/`viewRecords` cleanup in
`app/api/admin/action/route.ts`). Add best-effort, non-blocking R2 deletion of both
`live/<id>.png` and `pending/<id>.png` to that same action so deleted listings don't leave
orphaned objects.

## Error handling summary

| Case | Behavior |
|---|---|
| Invalid type / too large / failed decode | 400, specific message, nothing written to R2 or DB |
| R2 write failure on upload | 500, `pendingLogoKey` never set |
| Non-owner or unclaimed listing uploads | 403 |
| Not signed in | 401 |
| Approve/reject with no pending logo | 400 |
| Stale pending key at approval time | No-op (see race note above) |

## Testing

- Unit tests for the validation/resize pipeline: valid PNG/JPEG/WebP accepted; oversized,
  non-image, and polyglot/SVG-disguised-as-PNG inputs rejected.
- Route tests: ownership gating (401/403), pending/approve/reject state transitions,
  R2 object lifecycle (pending written on upload, moved to live on approve, deleted on
  reject/delete).
- Manual pass in the dev server: full upload → admin approve → card renders logo path,
  since image rendering correctness is easiest to verify by eye.
