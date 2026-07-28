# Claim Ownership, Owner Edits & Reciprocal Dofollow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require sign-in to complete a listing claim, persist ownership on the listing, let owners propose edits through a new dashboard that route through admin approval, and extend the dofollow policy so a free claimed listing earns a dofollow website link only while it keeps AllMCPs' badge reciprocally live (checked periodically), not just at claim time.

**Architecture:** Two new DB columns (`reciprocal_badge_ok`, `badge_last_checked_at`) plus the already-existing-but-unused `owner_user_id`/`pending_revision` columns carry the new state. Server components fetch session/data and pass props to client components (existing convention — no `SessionProvider`/`useSession` anywhere in this app). A single-blob `pendingRevision` JSON diff, shared parse/serialize helpers, and the existing admin-approval UI pattern (`AdminClient`) carry owner edits through moderation. The existing `cron/health` batch job is extended, not duplicated, to recheck the reciprocal badge.

**Tech Stack:** Next.js 16 (App Router), NextAuth v5 (`next-auth/providers/resend`), Drizzle ORM over Cloudflare D1, Zod, Resend (`react-email` templates), TypeScript, `tsx` for one-off script verification (no test framework exists in this repo).

## Global Constraints

- Every route re-derives identity server-side via `auth()` (or `getAuthorizedAdminEmail`/`isAdminAuthorized` for admin/cron routes) — never trust a client-supplied user id or email.
- `redirectTo`/`callbackUrl` values passed around the login flow must be relative paths (start with `/` but not `//`, which browsers treat as protocol-relative to an external host) — NextAuth's default `redirect` callback already restricts cross-origin targets, but validate defensively at the call site too.
- Reuse existing SSRF guards (`isSafeSubmissionUrl`, `isSafeFetchTarget` in `lib/urlSafety.ts`) for every new outbound fetch — no new unguarded fetch surface.
- No test framework exists in this repo (`package.json` has no test script, no `*.test.*` files). Pure-logic modules are verified with a throwaway `tsx` script (written, run, deleted — never committed). Routes/UI are verified manually against `npm run preview` (real D1 + Workers bindings via `opennextjs-cloudflare`), per the existing project convention.
- Follow existing file conventions exactly: server components fetch data and pass plain props to client components (see `app/admin/page.tsx` → `AdminClient`); new files use the `@/*` path alias (see `app/login/page.tsx`); files being *modified* keep their existing relative-import style.
- Migrations in this repo are hand-written SQL + a hand-edited `drizzle/meta/_journal.json` entry (migrations `0005`–`0007` have no matching `drizzle/meta/*_snapshot.json`, confirming `drizzle-kit generate` was not used for them) — follow that exact pattern, do not run `drizzle-kit generate`.

---

## File Structure

```
db/schema.ts                                  MODIFY  add reciprocalBadgeOk, badgeLastCheckedAt
drizzle/0008_claim_ownership.sql              CREATE  the two ALTER TABLE statements
drizzle/meta/_journal.json                    MODIFY  register migration 0008

lib/pendingRevision.ts                        CREATE  diff/serialize/parse for the pendingRevision JSON blob
lib/verification.ts                           MODIFY  extract websiteHasReciprocalBadge()
lib/linkRel.ts                                MODIFY  websiteLinkRel() gains reciprocalBadgeOk param
lib/notify.ts                                 CREATE  shared NotificationEmail sender

app/mcp/[id]/page.tsx                         MODIFY  Server type + websiteLinkRel call site
app/api/claim/route.ts                        MODIFY  auth gate, ownerUserId assignment/transfer
app/mcp/[id]/claim/page.tsx                   MODIFY  pass isSignedIn to ClaimClient
app/mcp/[id]/claim/ClaimClient.tsx             MODIFY  redirect to /login when unauthenticated
app/login/page.tsx                            MODIFY  callbackUrl -> hidden redirectTo field

app/api/dashboard/edit/route.ts               CREATE  owner submits an edit -> pendingRevision
app/dashboard/page.tsx                        CREATE  owner's "my listings" page (server component)
app/dashboard/DashboardClient.tsx             CREATE  edit form + pending-draft UI (client component)

app/admin/page.tsx                            MODIFY  fetch pending-edit listings
app/admin/AdminClient.tsx                     MODIFY  "Pending edits" section with before/after diff
app/api/admin/action/route.ts                 MODIFY  approve_edit / reject_edit actions

app/api/cron/health/route.ts                  MODIFY  set reciprocalBadgeOk / badgeLastCheckedAt
```

---

## Task 1: Schema — `reciprocalBadgeOk` and `badgeLastCheckedAt`

**Files:**
- Modify: `db/schema.ts:31-33` (insert after `lastCheckedAt`)
- Create: `drizzle/0008_claim_ownership.sql`
- Modify: `drizzle/meta/_journal.json`

**Interfaces:**
- Produces: `servers.reciprocalBadgeOk: boolean` (default `false`), `servers.badgeLastCheckedAt: Date | null` — read/written by Tasks 4, 8, 9.

- [ ] **Step 1: Add the columns to the Drizzle schema**

In `db/schema.ts`, the `servers` table currently has (around line 31-33):

```ts
  lastCheckedAt: integer('last_checked_at', { mode: 'timestamp' }),
  isVerifiedActive: integer('is_verified_active', { mode: 'boolean' }).notNull().default(false),
  healthStatus: text('health_status').notNull().default('unknown'),
```

Insert two new columns right after `healthStatus`:

```ts
  lastCheckedAt: integer('last_checked_at', { mode: 'timestamp' }),
  isVerifiedActive: integer('is_verified_active', { mode: 'boolean' }).notNull().default(false),
  healthStatus: text('health_status').notNull().default('unknown'),
  /** Whether the periodic recheck last found our badge/link still live (README or site). Drives dofollow for non-premium claimed listings. */
  reciprocalBadgeOk: integer('reciprocal_badge_ok', { mode: 'boolean' }).notNull().default(false),
  /** Last time the reciprocal-badge recheck ran for this listing (set alongside lastCheckedAt by the health cron). */
  badgeLastCheckedAt: integer('badge_last_checked_at', { mode: 'timestamp' }),
```

- [ ] **Step 2: Write the migration SQL**

Create `drizzle/0008_claim_ownership.sql`:

```sql
ALTER TABLE `servers` ADD `reciprocal_badge_ok` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `servers` ADD `badge_last_checked_at` integer;
```

- [ ] **Step 3: Register the migration in the journal**

In `drizzle/meta/_journal.json`, add a new entry after the `0007_stripe_premium` entry (currently the last one, ending at line 60 with `"when": 1785230000000`):

```json
    {
      "idx": 8,
      "version": "6",
      "when": 1785236000000,
      "tag": "0008_claim_ownership",
      "breakpoints": true
    }
```

(Remember to add a comma after the `0007_stripe_premium` entry's closing `}` before this new entry.)

- [ ] **Step 4: Apply the migration locally and verify**

Run: `npx wrangler d1 migrations apply all-mcps --local`
Expected: reports migration `0008_claim_ownership` applied.

Run: `npx wrangler d1 execute all-mcps --local --command "PRAGMA table_info(servers);"`
Expected: output includes rows for `reciprocal_badge_ok` and `badge_last_checked_at`.

- [ ] **Step 5: Commit**

```bash
git add db/schema.ts drizzle/0008_claim_ownership.sql drizzle/meta/_journal.json
git commit -m "Add reciprocalBadgeOk/badgeLastCheckedAt columns for reciprocal-dofollow tracking"
```

---

## Task 2: `lib/pendingRevision.ts` — diff/serialize/parse helpers

**Files:**
- Create: `lib/pendingRevision.ts`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces: `EditableServerFields` type, `diffEditableFields(current, submitted)`, `serializePendingRevision(proposed)`, `parsePendingRevision(raw)` — used by Task 7 (`app/api/dashboard/edit/route.ts`), Task 8 (`app/api/admin/action/route.ts`, `app/admin/AdminClient.tsx`), and Task 7's `app/dashboard/DashboardClient.tsx`.

- [ ] **Step 1: Write the module**

```ts
export type EditableServerFields = {
  name: string;
  description: string;
  category: string;
  websiteUrl: string;
};

export type PendingRevision = {
  proposed: Partial<EditableServerFields>;
  submittedAt: string;
};

const EDITABLE_KEYS: (keyof EditableServerFields)[] = ['name', 'description', 'category', 'websiteUrl'];

/** Returns only the fields that actually changed vs. the live row. Empty object if nothing changed. */
export function diffEditableFields(
  current: EditableServerFields,
  submitted: EditableServerFields
): Partial<EditableServerFields> {
  const diff: Partial<EditableServerFields> = {};
  for (const key of EDITABLE_KEYS) {
    const next = (submitted[key] ?? '').trim();
    const prev = (current[key] ?? '').trim();
    if (next !== prev) {
      diff[key] = next;
    }
  }
  return diff;
}

export function serializePendingRevision(proposed: Partial<EditableServerFields>): string {
  const revision: PendingRevision = { proposed, submittedAt: new Date().toISOString() };
  return JSON.stringify(revision);
}

export function parsePendingRevision(raw: string | null | undefined): PendingRevision | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.proposed && typeof parsed.proposed === 'object') {
      return parsed as PendingRevision;
    }
  } catch {
    // fall through
  }
  return null;
}
```

- [ ] **Step 2: Write a throwaway verification script**

Create a temporary file `scripts/tmp-verify-pending-revision.ts` (not committed — deleted in Step 4):

```ts
import { diffEditableFields, serializePendingRevision, parsePendingRevision } from '../lib/pendingRevision';

const current = { name: 'Old', description: 'Old desc', category: 'tools', websiteUrl: 'https://old.com' };
const submitted = { name: 'New', description: 'Old desc', category: 'tools', websiteUrl: 'https://old.com' };

const diff = diffEditableFields(current, submitted);
if (Object.keys(diff).length !== 1 || diff.name !== 'New') {
  throw new Error(`expected only name to differ, got ${JSON.stringify(diff)}`);
}

const raw = serializePendingRevision(diff);
const parsed = parsePendingRevision(raw);
if (parsed?.proposed.name !== 'New') {
  throw new Error(`round-trip failed: ${JSON.stringify(parsed)}`);
}

if (parsePendingRevision(null) !== null) throw new Error('null input should parse to null');
if (parsePendingRevision('not json') !== null) throw new Error('invalid json should parse to null');
if (Object.keys(diffEditableFields(current, current)).length !== 0) {
  throw new Error('identical input should produce an empty diff');
}

console.log('OK: pendingRevision helpers behave as expected');
```

- [ ] **Step 3: Run it and confirm it passes**

Run: `npx tsx scripts/tmp-verify-pending-revision.ts`
Expected: prints `OK: pendingRevision helpers behave as expected` with no thrown error.

- [ ] **Step 4: Delete the throwaway script**

```bash
rm scripts/tmp-verify-pending-revision.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/pendingRevision.ts
git commit -m "Add pendingRevision diff/serialize/parse helpers"
```

---

## Task 3: Extract `websiteHasReciprocalBadge` from `lib/verification.ts`

**Files:**
- Modify: `lib/verification.ts:22-75` (the `verifyWebsiteHtml` function)

**Interfaces:**
- Consumes: nothing new.
- Produces: `websiteHasReciprocalBadge(html: string, serverId: string): boolean` — used by Task 9 (`app/api/cron/health/route.ts`).

- [ ] **Step 1: Add the exported function and refactor `verifyWebsiteHtml` to use it**

In `lib/verification.ts`, `verifyWebsiteHtml` currently computes (around lines 62-64):

```ts
  const hasBadgeLink =
    lower.includes(`allmcps.com/mcp/${serverId.toLowerCase()}`) ||
    lower.includes(`allmcps.com/api/badge/${serverId.toLowerCase()}`);
```

Replace that block, and add the new exported function above `verifyWebsiteHtml`:

```ts
/**
 * True only if the page contains an actual visible AllMCPs badge/link (not just
 * the hidden meta tag) — used for reciprocal-dofollow eligibility, which requires
 * a real backlink, not a hidden verification marker.
 */
export function websiteHasReciprocalBadge(html: string, serverId: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes(`allmcps.com/mcp/${serverId.toLowerCase()}`) ||
    lower.includes(`allmcps.com/api/badge/${serverId.toLowerCase()}`)
  );
}
```

Then inside `verifyWebsiteHtml`, replace the `hasBadgeLink` computation with a call to the new function:

```ts
  const hasBadgeLink = websiteHasReciprocalBadge(html, serverId);
```

(`verifyWebsiteHtml`'s behavior is unchanged — it still accepts either the meta tag or the badge link — this step only removes duplicated logic.)

- [ ] **Step 2: Write a throwaway verification script**

Create `scripts/tmp-verify-reciprocal-badge.ts` (not committed):

```ts
import { websiteHasReciprocalBadge } from '../lib/verification';

const withBadge = '<html><body><a href="https://allmcps.com/mcp/my-server">Listed</a></body></html>';
const withoutBadge = '<html><body><meta name="allmcps-verification" content="abc123"></body></html>';
const withImgBadge = '<img src="https://allmcps.com/api/badge/my-server">';

if (!websiteHasReciprocalBadge(withBadge, 'my-server')) throw new Error('should detect link badge');
if (websiteHasReciprocalBadge(withoutBadge, 'my-server')) throw new Error('meta tag alone should not count');
if (!websiteHasReciprocalBadge(withImgBadge, 'my-server')) throw new Error('should detect img badge url');

console.log('OK: websiteHasReciprocalBadge behaves as expected');
```

- [ ] **Step 3: Run it and confirm it passes**

Run: `npx tsx scripts/tmp-verify-reciprocal-badge.ts`
Expected: prints `OK: websiteHasReciprocalBadge behaves as expected`.

- [ ] **Step 4: Delete the throwaway script**

```bash
rm scripts/tmp-verify-reciprocal-badge.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/verification.ts
git commit -m "Extract websiteHasReciprocalBadge for reciprocal-dofollow rechecks"
```

---

## Task 4: Dofollow policy — `websiteLinkRel` gains `reciprocalBadgeOk`

**Files:**
- Modify: `lib/linkRel.ts`
- Modify: `app/mcp/[id]/page.tsx:19-38` (Server type), `:427-436` (call site)

**Interfaces:**
- Consumes: `server.reciprocalBadgeOk` (from Task 1's schema column; not yet populated for existing rows until Task 9 runs, defaults `false` which is the correct conservative default).
- Produces: `websiteLinkRel(isPremium: boolean, reciprocalBadgeOk: boolean): string` — this is the only call site today; no other consumers to update.

- [ ] **Step 1: Update `lib/linkRel.ts`**

```ts
/**
 * SEO link policy for outbound listing links.
 * - Premium/paid listings: dofollow website (and repo when claimed)
 * - Free listings: dofollow website only while a reciprocal AllMCPs badge is
 *   confirmed live (rechecked periodically by the health cron); nofollow otherwise
 * Claimed/official free listings still use nofollow on the website unless premium
 * or reciprocal.
 */
export function websiteLinkRel(isPremium: boolean, reciprocalBadgeOk: boolean): string {
  return isPremium || reciprocalBadgeOk ? 'noopener noreferrer' : 'noopener noreferrer nofollow';
}

export function repoLinkRel(isPremium: boolean, isOfficial: boolean): string {
  // Paid listings always dofollow; free claimed listings keep historical dofollow on repo.
  if (isPremium || isOfficial) return 'noopener noreferrer';
  return 'noopener noreferrer nofollow';
}
```

- [ ] **Step 2: Update the `Server` type and call site in `app/mcp/[id]/page.tsx`**

In the `Server` type (around line 32), add the new field next to the other optional booleans:

```ts
  healthStatus?: string;
  reciprocalBadgeOk?: boolean;
  views?: number;
```

At the call site (around lines 423-437):

```tsx
              {server.websiteUrl && (
                <a
                  href={server.websiteUrl}
                  target="_blank"
                  rel={websiteLinkRel(!!server.isPremium, !!server.reciprocalBadgeOk)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontWeight: 500, transition: 'background 0.2s', border: '1px solid var(--border-color)' }}
                  className="nav-link"
                >
                  <Globe size={18} /> Website
                  {server.isPremium || server.reciprocalBadgeOk ? (
                    <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#00E5FF', fontWeight: 700 }}>DOFOLLOW</span>
                  ) : (
                    <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600 }}>nofollow</span>
                  )}
                </a>
              )}
```

- [ ] **Step 3: Write a throwaway verification script for `websiteLinkRel`**

Create `scripts/tmp-verify-link-rel.ts` (not committed):

```ts
import { websiteLinkRel } from '../lib/linkRel';

if (websiteLinkRel(false, false) !== 'noopener noreferrer nofollow') throw new Error('free, no badge should be nofollow');
if (websiteLinkRel(true, false) !== 'noopener noreferrer') throw new Error('premium should be dofollow regardless');
if (websiteLinkRel(false, true) !== 'noopener noreferrer') throw new Error('reciprocal badge should be dofollow');

console.log('OK: websiteLinkRel behaves as expected');
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx tsx scripts/tmp-verify-link-rel.ts`
Expected: prints `OK: websiteLinkRel behaves as expected`.

- [ ] **Step 5: Delete the throwaway script**

```bash
rm scripts/tmp-verify-link-rel.ts
```

- [ ] **Step 6: Commit**

```bash
git add lib/linkRel.ts "app/mcp/[id]/page.tsx"
git commit -m "Make free-listing dofollow depend on reciprocal badge, not just claim status"
```

---

## Task 5: `lib/notify.ts` — shared notification email sender

**Files:**
- Create: `lib/notify.ts`

**Interfaces:**
- Consumes: `NotificationEmail` from `components/emails/NotificationEmail.tsx` (existing, unused until now — props `heading: string; message: string; actionText?: string; actionUrl?: string`).
- Produces: `sendNotificationEmail(params: { to: string; heading: string; message: string; actionText?: string; actionUrl?: string }): Promise<void>` — used by Task 7 (`app/api/dashboard/edit/route.ts`) and Task 8 (`app/api/admin/action/route.ts`).

- [ ] **Step 1: Write the module**

```ts
import { Resend } from 'resend';
import { NotificationEmail } from '@/components/emails/NotificationEmail';

/**
 * Sends a generic notification email via Resend. No-ops (rather than throwing)
 * when RESEND_API_KEY isn't configured, so a missing secret in a given
 * environment degrades to "no email sent" instead of failing the caller's request.
 */
export async function sendNotificationEmail(params: {
  to: string;
  heading: string;
  message: string;
  actionText?: string;
  actionUrl?: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: params.to,
    subject: params.heading,
    react: NotificationEmail({
      heading: params.heading,
      message: params.message,
      actionText: params.actionText,
      actionUrl: params.actionUrl,
    }) as React.ReactElement,
  });

  if (error) {
    console.error('sendNotificationEmail error:', error);
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `lib/notify.ts`. (This project has pre-existing `.next`/build artifacts; focus only on errors mentioning `notify.ts`.)

- [ ] **Step 3: Commit**

```bash
git add lib/notify.ts
git commit -m "Add shared sendNotificationEmail helper"
```

---

## Task 6: Gate the claim flow behind sign-in; persist/transfer ownership

**Files:**
- Modify: `app/api/claim/route.ts`
- Modify: `app/mcp/[id]/claim/page.tsx`
- Modify: `app/mcp/[id]/claim/ClaimClient.tsx`
- Modify: `app/login/page.tsx`

**Interfaces:**
- Consumes: `auth()` from `lib/auth.ts` (existing export).
- Produces: `servers.ownerUserId` is now set/reassigned on successful claim/re-verify — consumed by Task 7's dashboard query and Task 8's owner-notification lookup.

- [ ] **Step 1: Add the auth gate and ownership assignment to `app/api/claim/route.ts`**

Add the import near the top (after the existing `verification` import):

```ts
import { auth } from '../../../lib/auth';
```

Right after the `server` lookup (`const server = dbServers[0];` … `if (!server) { ... }`), add the session check — every method requires a signed-in user from here on:

```ts
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required to claim or update a listing.' }, { status: 401 });
    }
```

In the `attach_website` branch, after the existing `if (!server.isOfficial) { ... }` check, add an ownership check (a listing claimed before this change has `ownerUserId === null`, so this only blocks a *mismatched* owner, not a not-yet-linked legacy claim):

```ts
      if (server.ownerUserId && server.ownerUserId !== userId) {
        return NextResponse.json({ error: 'Only the listing owner can update its website.' }, { status: 403 });
      }
```

In the final `updates` object (currently `{ isOfficial: true, claimedAt: server.claimedAt || new Date() }`), add `ownerUserId`:

```ts
    const updates: Record<string, unknown> = {
      isOfficial: true,
      claimedAt: server.claimedAt || new Date(),
      ownerUserId: userId,
    };
```

(This reassigns `ownerUserId` on every successful verify, including re-verifies by a different account — matching the decision that proof-of-control, not first-claimer, is the security boundary.)

- [ ] **Step 2: Pass session state into `ClaimClient` from `app/mcp/[id]/claim/page.tsx`**

Add the import:

```ts
import { auth } from '../../../../lib/auth';
```

In `ClaimPage`, before the `return`:

```ts
  const session = await auth();
```

Add `isSignedIn={!!session?.user}` to the `<ClaimClient ... />` props:

```tsx
        <ClaimClient
          serverId={server.id}
          serverName={server.name}
          repoUrl={server.url}
          websiteUrl={(server as any).websiteUrl}
          isOfficial={(server as any).isOfficial}
          websiteVerified={(server as any).websiteVerified}
          isSignedIn={!!session?.user}
        />
```

- [ ] **Step 3: Gate `ClaimClient`'s verify/attach actions on `isSignedIn`**

Add `isSignedIn` to the props type and destructure it:

```tsx
export default function ClaimClient({
  serverId,
  serverName,
  repoUrl,
  websiteUrl: initialWebsite,
  isOfficial,
  websiteVerified,
  isSignedIn,
}: {
  serverId: string;
  serverName: string;
  repoUrl: string;
  websiteUrl?: string | null;
  isOfficial?: boolean;
  websiteVerified?: boolean;
  isSignedIn: boolean;
}) {
```

At the top of `handleVerify` (before `setLoading(true)`):

```ts
  const handleVerify = async () => {
    if (!isSignedIn) {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(`/mcp/${serverId}/claim`)}`;
      return;
    }
    setLoading(true);
```

At the top of `handleAttachWebsite` (before the `if (!websiteUrl.trim())` check):

```ts
  const handleAttachWebsite = async () => {
    if (!isSignedIn) {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(`/mcp/${serverId}/claim`)}`;
      return;
    }
    if (!websiteUrl.trim()) {
```

- [ ] **Step 4: Add `callbackUrl` support to `app/login/page.tsx`**

Replace the file's export with an async component reading `searchParams` (matching the pattern in `app/pricing/page.tsx`) and forwarding a `redirectTo` hidden field to the existing `signIn('resend', formData)` call — NextAuth's `signIn` destructures `redirectTo` out of the FormData automatically (`options instanceof FormData ? Object.fromEntries(options) : options`), so no change to the `signIn` call itself is needed:

```tsx
import { signIn } from '@/lib/auth';
import { BrandLogo } from '@/components/BrandLogo';
import { PageShell } from '@/components/PageShell';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  // Must be a same-app relative path: reject absolute/protocol-relative URLs
  // (e.g. "//evil.com" starts with "/" but browsers treat it as external).
  const redirectTo =
    callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : undefined;

  return (
    <PageShell variant="auth" panel>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <BrandLogo size="lg" href={null} showWordmark={false} />
        </div>
        <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>
          Sign in to <span className="text-brand-gradient">AllMCPs</span>
        </h1>
        <p className="text-meta" style={{ lineHeight: 1.5 }}>
          Enter your email to receive a secure login link. No password required.
        </p>
      </div>

      <form
        action={async (formData) => {
          'use server';
          await signIn('resend', formData);
        }}
        className="form-stack"
        style={{ textAlign: 'left' }}
      >
        <div className="form-field">
          <label htmlFor="email" className="form-label">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="form-input"
          />
        </div>

        {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

        <button type="submit" className="btn btn-primary btn-full">
          Send Magic Link
        </button>
      </form>
    </PageShell>
  );
}
```

- [ ] **Step 5: Manually verify the auth gate**

Run: `npm run preview` (builds and serves with real Workers bindings via `opennextjs-cloudflare`).

With the server running, confirm the unauthenticated-request path from a separate terminal:

Run: `curl -s -X POST http://localhost:8771/api/claim -H "Content-Type: application/json" -d '{"id":"some-existing-server-id","method":"github"}'`
(Substitute a real listing id from your local D1; check the preview server's printed port if not 8771.)
Expected: `{"error":"Sign in required to claim or update a listing."}` with HTTP 401.

Then in a browser: visit `/mcp/<id>/claim`, click **Verify & claim listing** while signed out — expect a redirect to `/login?callbackUrl=%2Fmcp%2F<id>%2Fclaim`. Sign in via the magic link and confirm you land back on the claim page.

- [ ] **Step 6: Commit**

```bash
git add "app/api/claim/route.ts" "app/mcp/[id]/claim/page.tsx" "app/mcp/[id]/claim/ClaimClient.tsx" app/login/page.tsx
git commit -m "Require sign-in to claim/re-verify a listing and persist ownerUserId"
```

---

## Task 7: Owner dashboard (`/dashboard`) and edit submission

**Files:**
- Create: `app/api/dashboard/edit/route.ts`
- Create: `app/dashboard/page.tsx`
- Create: `app/dashboard/DashboardClient.tsx`

**Interfaces:**
- Consumes: `auth()` (`lib/auth.ts`), `diffEditableFields`/`serializePendingRevision`/`parsePendingRevision` (Task 2, `lib/pendingRevision.ts`), `isSafeSubmissionUrl` (`lib/urlSafety.ts`), `sendNotificationEmail` (Task 5, `lib/notify.ts`), `getAppUrl` (`lib/stripe.ts`).
- Produces: `POST /api/dashboard/edit` endpoint; `/dashboard` page. No other task consumes these directly, but Task 8's admin queue reads the `pendingRevision` this route writes.

- [ ] **Step 1: Write `app/api/dashboard/edit/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { servers } from '@/db/schema';
import { auth } from '@/lib/auth';
import { diffEditableFields, serializePendingRevision } from '@/lib/pendingRevision';
import { isSafeSubmissionUrl } from '@/lib/urlSafety';
import { sendNotificationEmail } from '@/lib/notify';
import { getAppUrl } from '@/lib/stripe';

const editSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  category: z.string().min(1).max(100),
  websiteUrl: z.string().url().optional().or(z.literal('')),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }

    const parsed = editSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { id, name, description, category } = parsed.data;
    const websiteUrl = (parsed.data.websiteUrl || '').trim();
    if (websiteUrl && !isSafeSubmissionUrl(websiteUrl)) {
      return NextResponse.json({ error: 'Website URL must be a public http(s) address.' }, { status: 400 });
    }

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
    }
    if (!env?.DB) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
    }

    const db = drizzle(env.DB as any);
    const rows = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
    const server = rows[0];
    if (!server) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }
    if (server.ownerUserId !== userId) {
      return NextResponse.json({ error: 'You do not own this listing.' }, { status: 403 });
    }

    const diff = diffEditableFields(
      {
        name: server.name,
        description: server.description,
        category: server.category,
        websiteUrl: server.websiteUrl || '',
      },
      { name, description, category, websiteUrl }
    );

    if (Object.keys(diff).length === 0) {
      return NextResponse.json({ error: 'No changes to submit.' }, { status: 400 });
    }

    await db
      .update(servers)
      .set({ pendingRevision: serializePendingRevision(diff) })
      .where(eq(servers.id, id));

    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await sendNotificationEmail({
        to: adminEmail,
        heading: 'New pending edit',
        message: `${server.name} has a pending edit awaiting review.`,
        actionText: 'Review in admin',
        actionUrl: `${getAppUrl()}/admin`,
      });
    }

    return NextResponse.json({ success: true, message: 'Edit submitted for review.' });
  } catch (error) {
    console.error('Dashboard edit error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write `app/dashboard/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { servers } from '@/db/schema';
import { auth } from '@/lib/auth';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

async function getOwnedServers(userId: string) {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx?.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      const rows = await db.select().from(servers).where(eq(servers.ownerUserId, userId));
      return rows.map((s) => ({
        ...s,
        createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
      }));
    }
  } catch {
    // fall through with an empty list
  }
  return [];
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/dashboard');
  }

  const ownedServers = await getOwnedServers(session.user.id);

  return (
    <main className="page-shell page-shell--content animate-fade-in">
      <div className="page-shell-inner">
        <header className="page-header">
          <h1 className="text-page-title">My listings</h1>
          <p className="text-lead">Edits go live after a quick review.</p>
        </header>
        <DashboardClient initialServers={ownedServers as any} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Write `app/dashboard/DashboardClient.tsx`**

```tsx
'use client';

import { useState, type CSSProperties } from 'react';
import { toast } from '@/components/ui/Toast';
import { parsePendingRevision } from '@/lib/pendingRevision';

type Server = {
  id: string;
  name: string;
  description: string;
  category: string;
  websiteUrl?: string | null;
  pendingRevision?: string | null;
};

export default function DashboardClient({ initialServers }: { initialServers: Server[] }) {
  const [servers, setServers] = useState(initialServers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', category: '', websiteUrl: '' });
  const [saving, setSaving] = useState(false);

  const startEdit = (server: Server) => {
    setEditingId(server.id);
    setForm({
      name: server.name,
      description: server.description,
      category: server.category,
      websiteUrl: server.websiteUrl || '',
    });
  };

  const submitEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/dashboard/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...form }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Could not submit edit');
      }
      const submittedAt = new Date().toISOString();
      setServers((prev) =>
        prev.map((s) =>
          s.id === editingId
            ? { ...s, pendingRevision: JSON.stringify({ proposed: form, submittedAt }) }
            : s
        )
      );
      toast.success('Edit submitted', { description: data.message || 'Awaiting review.' });
      setEditingId(null);
    } catch (err: any) {
      toast.error('Could not submit edit', { description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  if (servers.length === 0) {
    return <p style={{ color: 'var(--text-secondary)' }}>You don&apos;t have any claimed listings yet.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {servers.map((server) => {
        const pending = parsePendingRevision(server.pendingRevision);
        const isEditing = editingId === server.id;
        return (
          <div key={server.id} style={cardStyle}>
            <h3 style={{ marginBottom: '0.25rem' }}>{server.name}</h3>
            {pending && (
              <p style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.75rem' }}>
                Awaiting review since {new Date(pending.submittedAt).toLocaleDateString()}
              </p>
            )}
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Name"
                />
                <textarea
                  className="form-input"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Description"
                  rows={4}
                />
                <input
                  className="form-input"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Category"
                />
                <input
                  className="form-input"
                  type="url"
                  value={form.websiteUrl}
                  onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                  placeholder="https://yoursite.com"
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" disabled={saving} onClick={submitEdit}>
                    {saving ? 'Submitting…' : pending ? 'Update pending edit' : 'Submit for review'}
                  </button>
                  <button className="btn btn-secondary" disabled={saving} onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{server.description}</p>
                <button className="btn btn-secondary" onClick={() => startEdit(server)}>
                  {pending ? 'Edit pending draft' : 'Edit'}
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  padding: '1.5rem',
};
```

- [ ] **Step 4: Manually verify**

Run: `npm run preview`.

- `curl -s -X POST http://localhost:8771/api/dashboard/edit -H "Content-Type: application/json" -d '{"id":"x","name":"a","description":"b","category":"c"}'` → expect 401 `{"error":"Sign in required."}`.
- In a browser, sign in, claim a listing (Task 6), visit `/dashboard` — confirm it's listed. Edit a field, submit, confirm the toast and the "Awaiting review" banner appear.
- Run: `npx wrangler d1 execute all-mcps --local --command "SELECT id, pending_revision FROM servers WHERE owner_user_id IS NOT NULL;"` — confirm the JSON diff was persisted and only the changed field(s) are present.

- [ ] **Step 5: Commit**

```bash
git add app/api/dashboard/edit/route.ts app/dashboard/page.tsx app/dashboard/DashboardClient.tsx
git commit -m "Add owner dashboard for submitting listing edits"
```

---

## Task 8: Admin review queue for pending edits

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `app/admin/AdminClient.tsx`
- Modify: `app/api/admin/action/route.ts`

**Interfaces:**
- Consumes: `parsePendingRevision` (Task 2), `sendNotificationEmail` (Task 5), `getAppUrl` (`lib/stripe.ts`), `users` table (`db/schema.ts`, existing).
- Produces: `approve_edit`/`reject_edit` actions on `POST /api/admin/action`; no other task consumes these.

- [ ] **Step 1: Fetch pending-edit listings in `app/admin/page.tsx`**

Add `and`, `isNotNull` to the existing `drizzle-orm` import (currently `import { eq, desc } from 'drizzle-orm';`):

```ts
import { eq, desc, isNotNull } from 'drizzle-orm';
```

In `getAdminData`, after the existing `activeServers` query, add:

```ts
      const pendingEdits = await db
        .select()
        .from(servers)
        .where(isNotNull(servers.pendingRevision))
        .orderBy(desc(servers.createdAt));
```

Update the return statement to include it:

```ts
      return {
        pending: pendingServers.map(map),
        active: activeServers.map(map),
        pendingEdits: pendingEdits.map(map),
      };
```

Update the function's fallback return and the page component to thread it through:

```ts
  return { pending: [], active: [], pendingEdits: [] };
```

```tsx
  const { pending, active, pendingEdits } = await getAdminData();
```

```tsx
      <AdminClient initialPending={pending as any} initialActive={active as any} initialPendingEdits={pendingEdits as any} />
```

- [ ] **Step 2: Add the "Pending edits" section to `app/admin/AdminClient.tsx`**

Add the import:

```ts
import { parsePendingRevision } from '@/lib/pendingRevision';
```

Extend the `Server` type with the two new fields:

```ts
type Server = {
  id: string;
  name: string;
  url: string;
  websiteUrl?: string | null;
  description: string;
  category?: string;
  createdAt: string;
  isPremium?: boolean;
  reviewPriority?: boolean;
  status?: string;
  pendingRevision?: string | null;
};
```

Update the component signature to accept and manage the new list:

```tsx
export default function AdminClient({
  initialPending,
  initialActive = [],
  initialPendingEdits = [],
}: {
  initialPending: Server[];
  initialActive?: Server[];
  initialPendingEdits?: Server[];
}) {
  const [pending, setPending] = useState<Server[]>(initialPending);
  const [active, setActive] = useState<Server[]>(initialActive);
  const [pendingEdits, setPendingEdits] = useState<Server[]>(initialPendingEdits);
  const [loadingId, setLoadingId] = useState<string | null>(null);
```

Extend `handleAction`'s action union and success branch to also handle the edit actions:

```ts
  const handleAction = async (
    id: string,
    action: 'approve' | 'reject' | 'set_premium' | 'unset_premium' | 'approve_edit' | 'reject_edit',
    list: 'pending' | 'active' | 'pendingEdits' = 'pending'
  ) => {
    setLoadingId(id);

    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || 'Action failed');
      }

      if (action === 'approve' || action === 'reject') {
        setPending((prev) => prev.filter((s) => s.id !== id));
        toast.success(action === 'approve' ? 'Listing approved' : 'Listing rejected');
      } else if (action === 'approve_edit' || action === 'reject_edit') {
        setPendingEdits((prev) => prev.filter((s) => s.id !== id));
        toast.success(action === 'approve_edit' ? 'Edit approved' : 'Edit rejected');
      } else {
        const premium = action === 'set_premium';
        const updater = (prev: Server[]) =>
          prev.map((s) => (s.id === id ? { ...s, isPremium: premium } : s));
        if (list === 'pending') setPending(updater);
        else setActive(updater);
        toast.success(premium ? 'Marked premium (dofollow)' : 'Premium removed (nofollow)');
      }
    } catch (err: any) {
      toast.error('Action failed', {
        description: err?.message || 'Something went wrong.',
      });
    } finally {
      setLoadingId(null);
    }
  };
```

Add a new section to the returned JSX, right after the "Active listings" `</section>`:

```tsx
      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Pending edits</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Owner-submitted changes awaiting approval. Approving applies them immediately; a changed
          website resets its verification.
        </p>
        <PendingEditsTable
          servers={pendingEdits}
          loadingId={loadingId}
          onApprove={(id) => handleAction(id, 'approve_edit', 'pendingEdits')}
          onReject={(id) => handleAction(id, 'reject_edit', 'pendingEdits')}
        />
      </section>
```

Add the new `PendingEditsTable` component (after the existing `ServerTable` function):

```tsx
function PendingEditsTable({
  servers,
  loadingId,
  onApprove,
  onReject,
}: {
  servers: Server[];
  loadingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
            <th style={{ padding: '1rem' }}>Listing</th>
            <th style={{ padding: '1rem' }}>Proposed changes</th>
            <th style={{ padding: '1rem' }}>Submitted</th>
            <th style={{ padding: '1rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {servers.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No pending edits!
              </td>
            </tr>
          ) : (
            servers.map((server) => {
              const pending = parsePendingRevision(server.pendingRevision);
              if (!pending) return null;
              const fields = Object.keys(pending.proposed) as (keyof typeof pending.proposed)[];
              const currentValues: Record<string, string | undefined> = {
                name: server.name,
                description: server.description,
                category: server.category,
                websiteUrl: server.websiteUrl ?? '',
              };
              return (
                <tr key={server.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem' }}>
                    <strong>{server.name}</strong>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {fields.map((field) => (
                      <div key={field} style={{ marginBottom: '0.5rem' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                          {field}
                        </div>
                        <div style={{ fontSize: '0.8rem', textDecoration: 'line-through', color: 'var(--text-secondary)' }}>
                          {currentValues[field] || '(empty)'}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#10b981' }}>{pending.proposed[field]}</div>
                      </div>
                    ))}
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                    {new Date(pending.submittedAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => onApprove(server.id)}
                        disabled={loadingId === server.id}
                        style={btnStyle('#10b981', loadingId === server.id)}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onReject(server.id)}
                        disabled={loadingId === server.id}
                        style={btnStyle('#ef4444', loadingId === server.id)}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Add `approve_edit`/`reject_edit` to `app/api/admin/action/route.ts`**

Update imports:

```ts
import { servers, users } from '../../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getAuthorizedAdminEmail } from '../../../../lib/accessAuth';
import { parsePendingRevision } from '../../../../lib/pendingRevision';
import { sendNotificationEmail } from '../../../../lib/notify';
import { getAppUrl } from '../../../../lib/stripe';
```

Update the schema:

```ts
const actionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['approve', 'reject', 'set_premium', 'unset_premium', 'approve_edit', 'reject_edit']),
});
```

After the existing `set_premium`/`unset_premium` branch (`else if (action === 'set_premium' || ...) { ... }`), add:

```ts
    } else if (action === 'approve_edit' || action === 'reject_edit') {
      const rows = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
      const server = rows[0];
      if (!server || !server.pendingRevision) {
        return NextResponse.json({ error: 'No pending edit for this listing.' }, { status: 400 });
      }

      const pending = parsePendingRevision(server.pendingRevision);
      if (!pending) {
        // Corrupt blob — clear it rather than getting permanently stuck.
        await db.update(servers).set({ pendingRevision: null }).where(eq(servers.id, id));
        return NextResponse.json({ error: 'Stored edit was corrupt and has been cleared.' }, { status: 400 });
      }

      if (action === 'approve_edit') {
        const fieldUpdates: Record<string, unknown> = { ...pending.proposed, pendingRevision: null };
        if ('websiteUrl' in pending.proposed) {
          fieldUpdates.websiteVerified = false;
        }
        await db.update(servers).set(fieldUpdates).where(eq(servers.id, id));
      } else {
        await db.update(servers).set({ pendingRevision: null }).where(eq(servers.id, id));
      }

      if (server.ownerUserId) {
        const ownerRows = await db.select().from(users).where(eq(users.id, server.ownerUserId)).limit(1);
        const ownerEmail = ownerRows[0]?.email;
        if (ownerEmail) {
          await sendNotificationEmail({
            to: ownerEmail,
            heading: action === 'approve_edit' ? 'Your edit was approved' : 'Your edit needs changes',
            message:
              action === 'approve_edit'
                ? `Your changes to ${server.name} are now live.`
                : `Your proposed changes to ${server.name} were not approved. You can submit a new edit from your dashboard.`,
            actionText: 'View listing',
            actionUrl: `${getAppUrl()}/mcp/${id}`,
          });
        }
      }
    }
```

Update the final success message to read correctly for the new actions (replace the existing `return NextResponse.json({ success: true, message: \`Server successfully ${action}d.\` });`):

```ts
    const messages: Record<string, string> = {
      approve: 'Listing approved.',
      reject: 'Listing rejected.',
      set_premium: 'Marked premium.',
      unset_premium: 'Premium removed.',
      approve_edit: 'Edit approved and applied.',
      reject_edit: 'Edit rejected.',
    };
    return NextResponse.json({ success: true, message: messages[action] });
```

- [ ] **Step 4: Manually verify**

Run: `npm run preview`.

- Submit an edit via `/dashboard` (Task 7), then visit `/admin` (requires Cloudflare Access locally — see `lib/accessAuth.ts`; if Access isn't configured locally, set `ADMIN_SECRET`/use the `isAdminAuthorized` path is only for cron, so for `/admin` itself you'll need a real or stubbed Access JWT, or test this step against a deployed preview environment instead).
- Confirm the "Pending edits" section shows the correct before/after diff.
- Click Approve — confirm the listing's live fields update (`npx wrangler d1 execute all-mcps --local --command "SELECT name, description, category, website_url, pending_revision, website_verified FROM servers WHERE id='<id>';"`) and `pending_revision` is now `NULL`.
- Repeat with Reject on a second edit — confirm `pending_revision` clears without changing live fields.

- [ ] **Step 5: Commit**

```bash
git add app/admin/page.tsx app/admin/AdminClient.tsx app/api/admin/action/route.ts
git commit -m "Add admin review queue for owner-submitted listing edits"
```

---

## Task 9: Cron — recheck the reciprocal badge

**Files:**
- Modify: `app/api/cron/health/route.ts`

**Interfaces:**
- Consumes: `websiteHasReciprocalBadge` (Task 3, `lib/verification.ts`), `isSafeFetchTarget` (existing import), `servers.reciprocalBadgeOk`/`badgeLastCheckedAt` (Task 1).
- Produces: keeps `servers.reciprocalBadgeOk` current — consumed by Task 4's `websiteLinkRel` call site.

- [ ] **Step 1: Extend the health-check loop**

Add the import:

```ts
import { websiteHasReciprocalBadge } from '../../../../lib/verification';
```

Inside the `for (const server of batch)` loop, add `reciprocalBadgeOk` alongside the existing `isOfficial`/`healthStatus` locals (near the top of the loop body):

```ts
      let isOfficial = server.isOfficial;
      let reciprocalBadgeOk = server.reciprocalBadgeOk;
```

In the GitHub branch, where the badge check currently sets `isOfficial`:

```ts
                if (text.replace(/\s+/g, '').includes(badge.replace(/\s+/g, ''))) {
                  isOfficial = true; // They added the badge!
                } else {
                  isOfficial = false; // Badge not found, remove verification
                }
```

change it to also update `reciprocalBadgeOk` (the README badge is itself a reciprocal link):

```ts
                if (text.replace(/\s+/g, '').includes(badge.replace(/\s+/g, ''))) {
                  isOfficial = true; // They added the badge!
                  reciprocalBadgeOk = true;
                } else {
                  isOfficial = false; // Badge not found, remove verification
                  reciprocalBadgeOk = false;
                }
```

After the existing `try { ... } catch (e) { healthStatus = 'offline'; }` block for the main health check, and before the `await db.update(servers).set({...})` call, add a second, independent check for listings that have a separately verified marketing website (skip premium — already dofollow, and skip anything not already `websiteVerified` — this recheck should only run against a site whose control was already proven, not an arbitrary stored URL):

```ts
      if (!server.isPremium && server.websiteUrl && server.websiteVerified && isSafeFetchTarget(server.websiteUrl)) {
        try {
          const siteRes = await fetch(server.websiteUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(10000),
          });
          reciprocalBadgeOk = siteRes.ok && websiteHasReciprocalBadge(await siteRes.text(), server.id);
        } catch {
          reciprocalBadgeOk = false;
        }
      }
```

Update the final `db.update` call to persist both new fields:

```ts
      // Update the record in D1
      await db.update(servers).set({
        lastCheckedAt: now,
        isVerifiedActive,
        healthStatus,
        isOfficial,
        reciprocalBadgeOk,
        badgeLastCheckedAt: now,
      }).where(eq(servers.id, server.id));
```

- [ ] **Step 2: Manually verify**

Run: `npm run preview`.

Set up one test row with a verified website that visibly contains the badge (any public page you control, e.g. a GitHub Pages site with `<a href="https://allmcps.com/mcp/<id>">` in its HTML), and `websiteVerified = 1`, `isPremium = 0`:

Run: `npx wrangler d1 execute all-mcps --local --command "UPDATE servers SET website_url='https://<your-test-page>', website_verified=1, is_premium=0 WHERE id='<id>';"`

Trigger the cron:

Run: `curl -s -X POST http://localhost:8771/api/cron/health -H "Authorization: Bearer $ADMIN_SECRET"`

Confirm the flag flips on:

Run: `npx wrangler d1 execute all-mcps --local --command "SELECT reciprocal_badge_ok, badge_last_checked_at FROM servers WHERE id='<id>';"`
Expected: `reciprocal_badge_ok = 1`, `badge_last_checked_at` populated.

Remove the badge markup from that test page (or point `website_url` at a page without it), rerun the cron, and confirm `reciprocal_badge_ok` flips back to `0`.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/health/route.ts
git commit -m "Recheck reciprocal badge presence in the health cron"
```

---

## Task 10: Remote migration and end-to-end smoke test

**Files:** none (operational task — applies Task 1's migration to the live database and runs the spec's full manual test checklist).

- [ ] **Step 1: Apply the migration to the remote D1 database**

Run: `npx wrangler d1 migrations apply all-mcps --remote`
Expected: reports `0008_claim_ownership` applied (alongside any other already-applied migrations, which will no-op).

- [ ] **Step 2: Deploy**

Run: `npm run deploy`

- [ ] **Step 3: Run the full smoke-test checklist from the spec**

Against the deployed site (`https://allmcps.com`), walk through, in order:

1. Claim a listing as user A (real magic-link email round trip) → `/dashboard` shows the listing.
2. Submit an edit → `/admin` shows a correct before/after diff → Approve → live fields update and A receives the approval email.
3. Submit a second edit → Reject → `pendingRevision` clears and A receives the rejection email.
4. Sign in as user B (different email) → re-prove control of the same listing (GitHub README / badge / DNS) → confirm `ownerUserId` reassigns to B (B now sees it on their `/dashboard`, A no longer does).
5. As B, edit `websiteUrl` via the dashboard → after admin approval, confirm the website link shows `nofollow` until re-verified via DNS/badge.
6. Remove the reciprocal badge from a live claimed site → after the next `cron/health` run (or a manual trigger), confirm the website link reverts to `nofollow`.

- [ ] **Step 4: Confirm nothing else regressed**

Run: `npx next build`
Expected: builds cleanly (no new errors).
