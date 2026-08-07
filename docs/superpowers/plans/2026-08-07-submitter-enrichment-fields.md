# Hand-off: submitter-controlled enrichment fields for MCP listings

**Status as of hand-off:** 4/14 tasks fully done, 1 in progress, 9 not started. Original
approved plan (fuller rationale/architecture decisions) is at
`C:\Users\caden\.claude\plans\sorted-strolling-dahl.md` — read that first for *why*,
this doc is the *what's done / what's left*.

## ⚠️ Read this before touching any file

There is a **large, unrelated, concurrent redesign in progress** in this working tree,
made by someone/something other than this task (not committed — visible only via
`git status`). It touches files this feature also needs to touch. Confirmed via
`git status --short` at hand-off time, files modified that are **NOT part of this
feature**:

```
app/globals.css
app/layout.tsx
app/page.tsx
app/browse/page.tsx
app/dashboard/page.tsx
app/dashboard/DashboardClient.tsx
app/mcp/[id]/page.tsx
app/submit/page.tsx
components/CookieBanner.tsx
components/PageShell.tsx
components/SiteFooter.tsx
components/SiteHeader.tsx
components/clients/ClientConfigSection.tsx
components/ui/Button.tsx
```

`components/forms/SubmitForm.tsx` was **also** mid-flight-redesigned by that other
process while task #5 below was being implemented — its structure changed from
inline-`style` to semantic CSS classes (`submit-section`, `submit-stepper`, etc.)
*during* this session, and the edits for task #5 were re-applied on top of the new
structure. **Do not assume any file's content matches what the plan file describes —
re-read every file immediately before editing it, every time**, especially the ones
listed above. Do not "fix" or revert anything in those files that looks unfamiliar —
it's someone else's in-progress work, not a bug.

One concrete open question from this collision: the new `submit-optional-details` /
`submit-optional-grid` / `submit-optional-body` classes added in task #5 have **no
CSS defined yet** (confirmed via grep — `.submit-section` etc. aren't in
`app/globals.css` either, so this may be expected/still-pending on the other redesign
work, or may need code from this feature). Check whether the concurrent redesign has
since added `.submit-*` styles before assuming these need dedicated CSS.

## What's actually done (verified working)

1. **DB schema + migration** — `db/schema.ts` has 12 new columns on `servers`
   (`tags`, `pricingModel`, `pricingNotes`, `authType`, `license`,
   `compatibleClients`, `maintenanceStatus`, `supportUrl`, `screenshotUrl`,
   `pendingScreenshotKey`, `suggestedInstallCommand`, `suggestedInstallArgs`).
   Migration hand-written at `drizzle/0024_submitter_enrichment_fields.sql`
   (NOT via `drizzle-kit generate` — see gotcha below). Applied to **local** D1 only
   (confirmed via `PRAGMA table_info`). **Not applied to remote/production** —
   that's an intentional separate step for the project owner
   (`npx wrangler d1 migrations apply all-mcps --remote`).

2. **`lib/serverEnums.ts`** (new file) — `PRICING_MODELS`, `AUTH_TYPES`,
   `MAINTENANCE_STATUSES` tuples + label maps, `normalizeTags()`,
   `normalizeCompatibleClients()` (reuses `MCP_CLIENTS` from `lib/clients.ts`),
   `isPricingModel`/`isAuthType`/`isMaintenanceStatus` guards.

3. **`lib/servers.ts`** — `Server` type, `PUBLIC_SERVER_COLUMNS`, `normalizeServer()`,
   `DirectoryFeedItem` type, and both branches (D1 + static-fallback) of
   `getDirectoryFeedPage()` all extended with the new fields.

4. **Submit routes** — `app/api/submit/route.ts` and `app/api/v1/submit/route.ts`
   both accept and persist all new optional fields (tolerant coercion: invalid
   enum values become `null` rather than rejecting the submission, matching the
   existing `normalizeCategory` philosophy).

5. **`components/forms/SubmitForm.tsx`** (task #5, in progress) — state hooks,
   the "Optional details" `<details>` block (tags/pricing/auth/license/compatible
   clients checkboxes/maintenance status/support URL/suggested install
   command+args), and `handleSubmit` wiring are done. **Remaining for this task:**
   confirm the CSS situation above and add minimal styling if the concurrent
   redesign hasn't covered it; then mark task #5 complete.

## What's left (in dependency order)

Full detail for each is in the plan file's "Implementation" section — this is just
the checklist:

- **#6** Generalize `lib/pendingRevision.ts`: widen `EditableServerFields` values to
  `string | string[]`, add new keys to `EDITABLE_KEYS`, make `diffEditableFields`
  type-aware (arrays via sorted-JSON compare, not `.trim()`).
- **#7** `app/api/dashboard/edit/route.ts` (`editSchema`) + `DashboardClient.tsx`
  edit form — **re-read `DashboardClient.tsx` fresh, it's one of the
  concurrently-modified files.**
- **#8** Screenshot upload+approval, cloned from the existing `logoUrl`/
  `pendingLogoKey` flow (`app/api/dashboard/logo/route.ts`,
  `app/logos/[id]/route.ts`, `approve_logo`/`reject_logo` in
  `app/api/admin/action/route.ts`). Reuse the existing `LOGOS` R2 binding under a
  `screenshots/pending/<id>.png` / `screenshots/live/<id>.png` key prefix —
  **do not** add a new R2 bucket/binding.
- **#9** Admin moderation UI (`app/admin/AdminClient.tsx`,
  `app/admin/ManageListings.tsx`) — generalize `PendingEditsTable`'s
  `currentValues` lookup, add an expandable "extra details" row to the pending-
  submissions table, add filters for the new enums.
- **#10** `lib/installConfig.ts` — extend `CachedInstallFields`, add a
  `source: 'submitted'` branch in `resolveInstallConfig` used only when cached
  confidence is `low`/absent.
- **#11** `app/mcp/[id]/page.tsx` display — **re-read fresh, concurrently
  modified.** Tags badges, spec-card rows (license/auth/maintenance/compatible
  clients/pricing), support link, screenshot block.
- **#12** `components/DirectoryGrid.tsx` filter pills (follow the existing
  `selectedStack`/`selectedTransport` pattern — client-side only, not
  URL-persisted) + `lib/search.ts` `buildAiSearchText()` + `lib/vectorSearch.ts`
  `buildServerVectorText()` additions.
- **#13** Final verification: `npm run build` must pass; manual smoke test
  (submit → pendingRevision edit → admin approve → detail page render → browse
  filter).
- **#14** (added mid-session per user request) LLM auto-detection: extend
  `enrichWithLlm()` in `app/api/submit/prefill/route.ts` to also infer
  `pricingModel`/`authType`/`license` from README/site text, validated against
  `lib/serverEnums.ts`. **Must soft-fail exactly like the existing name/
  description/category enrichment** — on budget/rate/auth errors or timeout,
  silently omit these fields rather than blocking prefill or the submission.
  Not started.

## Gotchas already solved (don't redo the investigation)

- **`drizzle-kit generate` is unsafe to run in this repo right now.**
  `drizzle/meta/_journal.json` was already stale before this session (only
  tracked through idx 19 while SQL files existed up to `0023_tools_source.sql`,
  and two files were both numbered `0017_*`). Running `drizzle-kit generate`
  regenerates a migration that redundantly re-adds columns already applied via
  the untracked files, which errors or desyncs history. **Hand-write new
  migrations** as plain `ALTER TABLE `servers` ADD `<col>` text;` files following
  the existing numbering, and manually append one `_journal.json` entry (see how
  `0024_submitter_enrichment_fields` was added). `wrangler d1 migrations apply`
  itself is unaffected by this — it scans the `drizzle/` directory by filename,
  not the journal.
- Local dev D1 was also behind (missing 0021–0023 + a data backfill script) before
  this session — already caught up as a side effect of applying migration 0024.

## Verification for the finished parts so far

```
npx wrangler d1 execute all-mcps --local --command "PRAGMA table_info(servers);"
```
should list all 12 new columns (confirmed done). No test runner in this repo —
`npm run build` is the main compile-correctness check, not yet run end-to-end
since the feature isn't finished (do run it once #6–#12 land, to catch type
mismatches across the ~10 touched files).
