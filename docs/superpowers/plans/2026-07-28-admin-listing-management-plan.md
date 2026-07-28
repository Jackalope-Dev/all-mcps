# Admin Listing Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/admin` from a two-section, 50-row-capped page into one that can find, edit, publish/unpublish, delete, and featured-boost any listing, with an at-a-glance stats overview.

**Architecture:** No schema migration — `servers.status` already accepts arbitrary text (this adds a `'removed'` value) and `servers.featuredUntil` already exists and is already read by `lib/featuredStatus.ts`. Two new `GET` routes (`/api/admin/listings` for server-side search/filter/pagination, `/api/admin/stats` for the overview) plus five new actions on the existing `POST /api/admin/action`. The capped "Active listings" table in `AdminClient` is replaced by a new self-fetching client component (`ManageListings`); the "Pending submissions" queue is untouched except for losing its now-dead premium-toggle code path.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM over Cloudflare D1, Zod, TypeScript. No test framework exists in this repo.

## Global Constraints

- Every new/modified admin route re-derives identity via `getAuthorizedAdminEmail(req.headers)` server-side (`lib/accessAuth.ts`) — never trust a client-supplied admin status.
- Reuse `isSafeSubmissionUrl` (`lib/urlSafety.ts`) for every URL the new `edit` action accepts — no new unguarded fetch/storage surface, matching the guard `app/api/submit/route.ts` already applies to public submissions.
- No migration needed: `servers.status` is free-text today (`'pending'` | `'active'`); this plan adds `'removed'` as a third value only. `servers.featuredUntil` (timestamp, nullable) already exists in `db/schema.ts`.
- No test framework exists in this repo (`package.json` has no test script, no `*.test.*` files). The one pure-logic module this plan adds (`lib/featuredGrant.ts`) is verified with a throwaway `tsx` script (written, run, deleted — never committed). Routes/UI are verified manually against `npm run preview` (real D1 + Workers bindings via `opennextjs-cloudflare`), per the existing project convention (see `docs/superpowers/plans/2026-07-28-claim-ownership-plan.md`).
- Follow existing file conventions exactly: server components fetch data and pass plain props to client components (`app/admin/page.tsx` → `AdminClient`); new files use the `@/*` path alias; files being *modified* keep their existing relative-import style (`app/api/admin/action/route.ts`, `app/admin/page.tsx`, `app/admin/AdminClient.tsx` all currently use `../../` style).
- `delete` is irreversible; the client requires a `window.confirm()` before calling it. `unpublish` is reversible via `republish` and needs no confirmation.

---

## File Structure

```
lib/featuredGrant.ts                    CREATE  pure date math for +days featured grants (stacks on remaining time)
lib/adminStats.ts                       CREATE  shared stats aggregation, used by both the SSR page and the stats route
app/api/admin/action/route.ts           MODIFY  add edit / unpublish / republish / delete / feature actions
app/api/admin/stats/route.ts            CREATE  GET wrapper around lib/adminStats.ts
app/api/admin/listings/route.ts         CREATE  GET search/filter/paginate listings
app/admin/StatsBar.tsx                  CREATE  stats overview cards
app/admin/ManageListings.tsx            CREATE  search/filter/pagination/edit/publish/feature table (client component)
app/admin/page.tsx                      MODIFY  drop the capped active-listings query, SSR-fetch stats, render StatsBar
app/admin/AdminClient.tsx               MODIFY  drop active-listings state/UI, render ManageListings
```

---

## Task 1: `lib/featuredGrant.ts` — featured-day stacking math

**Files:**
- Create: `lib/featuredGrant.ts`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces: `computeFeaturedUntil(currentFeaturedUntil: Date | null, days: number, now?: Date): Date` — used by Task 2 (`app/api/admin/action/route.ts`'s `feature` action).

- [ ] **Step 1: Write the module**

```ts
/**
 * Pure date math for the admin "grant N featured days" action. Stacks on top of
 * any remaining featured time rather than resetting it — a goodwill grant on a
 * listing that already has 5 days left should leave 5+N, not just N.
 */
export function computeFeaturedUntil(
  currentFeaturedUntil: Date | null,
  days: number,
  now: Date = new Date()
): Date {
  const base =
    currentFeaturedUntil && currentFeaturedUntil.getTime() > now.getTime()
      ? currentFeaturedUntil.getTime()
      : now.getTime();
  return new Date(base + days * 24 * 60 * 60 * 1000);
}
```

- [ ] **Step 2: Write a throwaway verification script**

Create `scripts/tmp-verify-featured-grant.ts` (not committed — deleted in Step 4):

```ts
import { computeFeaturedUntil } from '../lib/featuredGrant';

const now = new Date('2026-07-28T00:00:00.000Z');

// No existing featured time: +7 days from now
const a = computeFeaturedUntil(null, 7, now);
if (a.getTime() !== now.getTime() + 7 * 86400000) {
  throw new Error(`expected 7 days from now, got ${a.toISOString()}`);
}

// Existing featured time still in the future (5 days left): stacks on top of it
const existing = new Date(now.getTime() + 5 * 86400000);
const b = computeFeaturedUntil(existing, 7, now);
if (b.getTime() !== existing.getTime() + 7 * 86400000) {
  throw new Error(`expected to stack on existing time, got ${b.toISOString()}`);
}

// Existing featured time already expired: treated the same as no existing time
const expired = new Date(now.getTime() - 3 * 86400000);
const c = computeFeaturedUntil(expired, 7, now);
if (c.getTime() !== now.getTime() + 7 * 86400000) {
  throw new Error(`expected expired time to reset from now, got ${c.toISOString()}`);
}

console.log('OK: computeFeaturedUntil behaves as expected');
```

- [ ] **Step 3: Run it and confirm it passes**

Run: `npx tsx scripts/tmp-verify-featured-grant.ts`
Expected: prints `OK: computeFeaturedUntil behaves as expected` with no thrown error.

- [ ] **Step 4: Delete the throwaway script**

```bash
rm scripts/tmp-verify-featured-grant.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/featuredGrant.ts
git commit -m "Add computeFeaturedUntil helper for stacked featured-day grants"
```

---

## Task 2: Extend `POST /api/admin/action` with edit / unpublish / republish / delete / feature

**Files:**
- Modify: `app/api/admin/action/route.ts` (full file — see below)

**Interfaces:**
- Consumes: `computeFeaturedUntil` (Task 1, `lib/featuredGrant.ts`), `isSafeSubmissionUrl` (existing, `lib/urlSafety.ts`).
- Produces: the extended action contract `{ id, action, fields?, days? }` → `{ success, message, featuredUntil? }` — consumed by Task 6 (`app/admin/ManageListings.tsx`).

- [ ] **Step 1: Replace the file contents**

`app/api/admin/action/route.ts` currently handles `approve | reject | set_premium | unset_premium`. Replace the whole file with:

```ts
import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getAuthorizedAdminEmail } from '../../../../lib/accessAuth';
import { isSafeSubmissionUrl } from '../../../../lib/urlSafety';
import { computeFeaturedUntil } from '../../../../lib/featuredGrant';

const actionSchema = z.object({
  id: z.string().min(1),
  action: z.enum([
    'approve',
    'reject',
    'set_premium',
    'unset_premium',
    'edit',
    'unpublish',
    'republish',
    'delete',
    'feature',
  ]),
  fields: z
    .object({
      name: z.string().trim().min(1).max(200).optional(),
      description: z.string().trim().min(1).max(2000).optional(),
      category: z.string().trim().min(1).max(100).optional(),
      url: z.string().trim().min(1).optional(),
      websiteUrl: z.string().trim().optional(),
    })
    .optional(),
  days: z.number().int().min(1).max(365).optional(),
});

const MESSAGES: Record<string, string> = {
  approve: 'Listing approved.',
  reject: 'Listing rejected.',
  set_premium: 'Marked premium (dofollow).',
  unset_premium: 'Premium removed (nofollow).',
  edit: 'Listing updated.',
  unpublish: 'Listing unpublished.',
  republish: 'Listing republished.',
  delete: 'Listing permanently deleted.',
  feature: 'Featured placement granted.',
};

export async function POST(req: Request) {
  try {
    if (!(await getAuthorizedAdminEmail(req.headers))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const result = actionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues }, { status: 400 });
    }

    const { id, action, fields, days } = result.data;

    let env;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch (e) {
      throw new Error("Could not get Cloudflare context.");
    }

    if (!env || !env.DB) {
      throw new Error("Database binding not found");
    }

    const db = drizzle(env.DB as any);

    if (action === 'approve') {
      const updateResult = await db.update(servers)
        .set({ status: 'active' })
        .where(and(eq(servers.id, id), eq(servers.status, 'pending')))
        .returning();

      if (updateResult.length === 0) {
         return NextResponse.json({ error: "Server not found or not in pending state." }, { status: 400 });
      }
    } else if (action === 'reject') {
      const deleteResult = await db.delete(servers)
        .where(and(eq(servers.id, id), eq(servers.status, 'pending')))
        .returning();

      if (deleteResult.length === 0) {
         return NextResponse.json({ error: "Server not found or not in pending state." }, { status: 400 });
      }
    } else if (action === 'set_premium' || action === 'unset_premium') {
      const updateResult = await db.update(servers)
        .set({ isPremium: action === 'set_premium' })
        .where(eq(servers.id, id))
        .returning();

      if (updateResult.length === 0) {
        return NextResponse.json({ error: "Server not found." }, { status: 404 });
      }
    } else if (action === 'edit') {
      if (!fields || Object.keys(fields).length === 0) {
        return NextResponse.json({ error: "No fields provided." }, { status: 400 });
      }

      const updates: Record<string, unknown> = {};
      if (fields.name !== undefined) updates.name = fields.name;
      if (fields.description !== undefined) updates.description = fields.description;
      if (fields.category !== undefined) updates.category = fields.category;
      if (fields.url !== undefined) {
        if (!isSafeSubmissionUrl(fields.url)) {
          return NextResponse.json({ error: "Primary URL must be a public http(s) address." }, { status: 400 });
        }
        updates.url = fields.url;
      }
      if (fields.websiteUrl !== undefined) {
        if (fields.websiteUrl && !isSafeSubmissionUrl(fields.websiteUrl)) {
          return NextResponse.json({ error: "Website URL must be a public http(s) address." }, { status: 400 });
        }
        updates.websiteUrl = fields.websiteUrl || null;
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
      }

      const updateResult = await db.update(servers)
        .set(updates)
        .where(eq(servers.id, id))
        .returning();

      if (updateResult.length === 0) {
        return NextResponse.json({ error: "Server not found." }, { status: 404 });
      }
    } else if (action === 'unpublish' || action === 'republish') {
      const fromStatus = action === 'unpublish' ? 'active' : 'removed';
      const toStatus = action === 'unpublish' ? 'removed' : 'active';

      const updateResult = await db.update(servers)
        .set({ status: toStatus })
        .where(and(eq(servers.id, id), eq(servers.status, fromStatus)))
        .returning();

      if (updateResult.length === 0) {
        return NextResponse.json(
          { error: `Server not found or not currently ${fromStatus}.` },
          { status: 400 }
        );
      }
    } else if (action === 'delete') {
      const deleteResult = await db.delete(servers)
        .where(eq(servers.id, id))
        .returning();

      if (deleteResult.length === 0) {
        return NextResponse.json({ error: "Server not found." }, { status: 404 });
      }
    } else if (action === 'feature') {
      if (!days) {
        return NextResponse.json({ error: "days is required." }, { status: 400 });
      }

      const rows = await db.select({ featuredUntil: servers.featuredUntil })
        .from(servers)
        .where(eq(servers.id, id))
        .limit(1);

      if (rows.length === 0) {
        return NextResponse.json({ error: "Server not found." }, { status: 404 });
      }

      const newFeaturedUntil = computeFeaturedUntil(rows[0].featuredUntil, days);

      await db.update(servers)
        .set({ featuredUntil: newFeaturedUntil })
        .where(eq(servers.id, id));

      return NextResponse.json({
        success: true,
        message: MESSAGES.feature,
        featuredUntil: newFeaturedUntil.toISOString(),
      });
    }

    return NextResponse.json({ success: true, message: MESSAGES[action] });
  } catch (error) {
    console.error("Admin action error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manually verify**

Run: `npm run preview`.

- `curl -s -X POST http://localhost:8771/api/admin/action -H "Content-Type: application/json" -d '{"id":"x","action":"edit","fields":{"websiteUrl":"http://127.0.0.1"}}'` (adjust port to what `preview` prints) → expect 401 (no Access JWT locally) confirming the auth gate still runs first. If testing against a deployed preview with real Access, expect `{"error":"Website URL must be a public http(s) address."}` with 400 instead.
- Pick a real listing id from local D1 (`npx wrangler d1 execute all-mcps --local --command "SELECT id FROM servers LIMIT 1;"`) and, against a deployed/Access-authenticated environment, exercise `edit`, `unpublish`, `republish`, `feature` (twice, confirming the second grant's `featuredUntil` is later than `now + days` by roughly the first grant's remaining time), and `delete` — confirm each returns `success: true` with the expected `MESSAGES` text and the DB row reflects the change (`npx wrangler d1 execute all-mcps --local --command "SELECT status, featured_until FROM servers WHERE id='<id>';"`).

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/action/route.ts
git commit -m "Add edit/unpublish/republish/delete/feature actions to admin action route"
```

---

## Task 3: `lib/adminStats.ts` and `GET /api/admin/stats`

**Files:**
- Create: `lib/adminStats.ts`
- Create: `app/api/admin/stats/route.ts`

**Interfaces:**
- Produces: `AdminStats` type and `getAdminStats(db): Promise<AdminStats>` — consumed directly by Task 7's `app/admin/page.tsx` (SSR, no HTTP round-trip) and wrapped by this task's own route. Also consumed by Task 5 (`app/admin/StatsBar.tsx`) for the `AdminStats` type.

- [ ] **Step 1: Write `lib/adminStats.ts`**

```ts
import { and, count, desc, eq, gt, ne, sum } from 'drizzle-orm';
import { servers } from '../db/schema';

export type AdminStats = {
  statusCounts: { pending: number; active: number; removed: number };
  premiumCount: number;
  featuredCount: number;
  unhealthyCount: number;
  engagement: { totalViews: number; totalUpvotes: number; totalCopies: number };
  topByViews: { id: string; name: string; views: number }[];
};

/** `db` is a drizzle-orm/d1 database instance (typed loosely, matching this repo's `drizzle(env.DB as any)` convention). */
export async function getAdminStats(db: any): Promise<AdminStats> {
  const now = new Date();

  const [statusRows, premiumRows, featuredRows, unhealthyRows, engagementRows, topByViewsRows] =
    await Promise.all([
      db.select({ status: servers.status, total: count() }).from(servers).groupBy(servers.status),
      db.select({ total: count() }).from(servers).where(eq(servers.isPremium, true)),
      db
        .select({ total: count() })
        .from(servers)
        .where(and(eq(servers.status, 'active'), gt(servers.featuredUntil, now))),
      db
        .select({ total: count() })
        .from(servers)
        .where(and(eq(servers.status, 'active'), ne(servers.healthStatus, 'healthy'))),
      db
        .select({
          totalViews: sum(servers.views),
          totalUpvotes: sum(servers.upvotes),
          totalCopies: sum(servers.copies),
        })
        .from(servers),
      db
        .select({ id: servers.id, name: servers.name, views: servers.views })
        .from(servers)
        .orderBy(desc(servers.views))
        .limit(5),
    ]);

  const statusCounts = { pending: 0, active: 0, removed: 0 };
  for (const row of statusRows as { status: string; total: number }[]) {
    if (row.status === 'pending' || row.status === 'active' || row.status === 'removed') {
      statusCounts[row.status] = row.total;
    }
  }

  return {
    statusCounts,
    premiumCount: premiumRows[0]?.total ?? 0,
    featuredCount: featuredRows[0]?.total ?? 0,
    unhealthyCount: unhealthyRows[0]?.total ?? 0,
    engagement: {
      totalViews: Number(engagementRows[0]?.totalViews ?? 0),
      totalUpvotes: Number(engagementRows[0]?.totalUpvotes ?? 0),
      totalCopies: Number(engagementRows[0]?.totalCopies ?? 0),
    },
    topByViews: topByViewsRows,
  };
}
```

- [ ] **Step 2: Write `app/api/admin/stats/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { getAuthorizedAdminEmail } from '@/lib/accessAuth';
import { getAdminStats } from '@/lib/adminStats';

export async function GET(req: Request) {
  try {
    if (!(await getAuthorizedAdminEmail(req.headers))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    let env;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch (e) {
      throw new Error('Could not get Cloudflare context.');
    }

    if (!env || !env.DB) {
      throw new Error('Database binding not found');
    }

    const db = drizzle(env.DB as any);
    const stats = await getAdminStats(db);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Manually verify**

Run: `npm run preview`.

Run: `curl -s http://localhost:8771/api/admin/stats` (adjust port) → expect 401 without an Access JWT locally, confirming the auth gate. Against a deployed/Access-authenticated environment, expect a JSON body matching the `AdminStats` shape; spot-check `statusCounts.pending` against `npx wrangler d1 execute all-mcps --local --command "SELECT status, COUNT(*) FROM servers GROUP BY status;"`.

- [ ] **Step 4: Commit**

```bash
git add lib/adminStats.ts app/api/admin/stats/route.ts
git commit -m "Add admin stats aggregation and GET /api/admin/stats"
```

---

## Task 4: `GET /api/admin/listings` — search, filter, paginate

**Files:**
- Create: `app/api/admin/listings/route.ts`

**Interfaces:**
- Produces: `GET /api/admin/listings?search=&status=&premium=&featured=&health=&offset=&limit=` → `{ items: Listing[], total: number }` — consumed by Task 6 (`app/admin/ManageListings.tsx`).

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { and, count, desc, eq, gt, like, or } from 'drizzle-orm';
import { servers } from '@/db/schema';
import { getAuthorizedAdminEmail } from '@/lib/accessAuth';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

export async function GET(req: Request) {
  try {
    if (!(await getAuthorizedAdminEmail(req.headers))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const url = new URL(req.url);
    const search = (url.searchParams.get('search') || '').trim();
    const status = url.searchParams.get('status') || 'all';
    const premium = url.searchParams.get('premium');
    const featured = url.searchParams.get('featured');
    const health = url.searchParams.get('health');
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(url.searchParams.get('limit')) || DEFAULT_LIMIT)
    );

    let env;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch (e) {
      throw new Error('Could not get Cloudflare context.');
    }

    if (!env || !env.DB) {
      throw new Error('Database binding not found');
    }

    const db = drizzle(env.DB as any);

    const conditions = [];
    if (status !== 'all') {
      conditions.push(eq(servers.status, status));
    }
    if (search) {
      conditions.push(or(like(servers.name, `%${search}%`), like(servers.url, `%${search}%`)));
    }
    if (premium === 'true' || premium === 'false') {
      conditions.push(eq(servers.isPremium, premium === 'true'));
    }
    if (featured === 'true') {
      conditions.push(gt(servers.featuredUntil, new Date()));
    }
    if (health) {
      conditions.push(eq(servers.healthStatus, health));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalRows] = await Promise.all([
      db.select().from(servers).where(where).orderBy(desc(servers.createdAt)).limit(limit).offset(offset),
      db.select({ total: count() }).from(servers).where(where),
    ]);

    return NextResponse.json({
      items: items.map((s: typeof items[number]) => ({
        ...s,
        createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
        featuredUntil: s.featuredUntil instanceof Date ? s.featuredUntil.toISOString() : s.featuredUntil,
      })),
      total: totalRows[0]?.total ?? 0,
    });
  } catch (error) {
    console.error('Admin listings error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manually verify**

Run: `npm run preview`.

Against a deployed/Access-authenticated environment:
- `GET /api/admin/listings` (no params) → `items.length <= 25`, `total` matches `SELECT COUNT(*) FROM servers`.
- `GET /api/admin/listings?search=<part of a known listing name>` → that listing is in `items` regardless of its `createdAt` rank.
- `GET /api/admin/listings?status=active&premium=true` → every item has `status: 'active'` and `isPremium: true`.
- `GET /api/admin/listings?featured=true` → every item's `featuredUntil` is a future ISO timestamp.
- `GET /api/admin/listings?offset=25&limit=25` → returns the next page (different `items` than offset 0, assuming more than 25 rows exist).

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/listings/route.ts
git commit -m "Add GET /api/admin/listings for admin search/filter/pagination"
```

---

## Task 5: `app/admin/StatsBar.tsx`

**Files:**
- Create: `app/admin/StatsBar.tsx`

**Interfaces:**
- Consumes: `AdminStats` type (Task 3, `lib/adminStats.ts`).
- Produces: `StatsBar({ stats: AdminStats })` — a plain (non-`'use client'`) component, rendered server-side by Task 7's `app/admin/page.tsx`.

- [ ] **Step 1: Write the component**

```tsx
import type { AdminStats } from '@/lib/adminStats';

export function StatsBar({ stats }: { stats: AdminStats }) {
  const cards: { label: string; value: string }[] = [
    { label: 'Pending', value: String(stats.statusCounts.pending) },
    { label: 'Active', value: String(stats.statusCounts.active) },
    { label: 'Removed', value: String(stats.statusCounts.removed) },
    { label: 'Premium', value: String(stats.premiumCount) },
    { label: 'Featured', value: String(stats.featuredCount) },
    { label: 'Unhealthy', value: String(stats.unhealthyCount) },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '0.75rem',
        marginBottom: '2rem',
      }}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1rem',
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              marginBottom: '0.35rem',
            }}
          >
            {card.label}
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{card.value}</div>
        </div>
      ))}

      <div
        style={{
          gridColumn: '1 / -1',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem',
        }}
      >
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            marginBottom: '0.5rem',
          }}
        >
          Engagement: {stats.engagement.totalViews} views · {stats.engagement.totalUpvotes} upvotes ·{' '}
          {stats.engagement.totalCopies} installs
        </div>
        {stats.topByViews.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {stats.topByViews.map((s) => (
              <span key={s.id} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {s.name} ({s.views})
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `app/admin/StatsBar.tsx` (it isn't wired into a page yet — that's Task 7 — so this only confirms the file itself compiles standalone; an unresolved-import error would show here since `@/lib/adminStats` must already exist from Task 3).

- [ ] **Step 3: Commit**

```bash
git add app/admin/StatsBar.tsx
git commit -m "Add admin StatsBar overview component"
```

---

## Task 6: `app/admin/ManageListings.tsx`

**Files:**
- Create: `app/admin/ManageListings.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/listings` (Task 4), `POST /api/admin/action` (Task 2's extended contract), `toast` (existing, `components/ui/Toast.tsx`).
- Produces: `<ManageListings />` (no props — fetches its own data) — rendered by Task 7's `app/admin/AdminClient.tsx`.

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { toast } from '../../components/ui/Toast';

type Listing = {
  id: string;
  name: string;
  url: string;
  websiteUrl?: string | null;
  description: string;
  category: string;
  createdAt: string;
  isPremium: boolean;
  status: string;
  healthStatus: string;
  featuredUntil?: string | null;
};

type EditFields = {
  name: string;
  description: string;
  category: string;
  url: string;
  websiteUrl: string;
};

const PAGE_SIZE = 25;

export default function ManageListings() {
  const [items, setItems] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [premiumFilter, setPremiumFilter] = useState('');
  const [featuredFilter, setFeaturedFilter] = useState('');
  const [healthFilter, setHealthFilter] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFields>({
    name: '',
    description: '',
    category: '',
    url: '',
    websiteUrl: '',
  });
  const [featureDays, setFeatureDays] = useState<Record<string, string>>({});

  const fetchListings = async (nextOffset: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (premiumFilter) params.set('premium', premiumFilter);
      if (featuredFilter) params.set('featured', featuredFilter);
      if (healthFilter) params.set('health', healthFilter);
      params.set('offset', String(nextOffset));
      params.set('limit', String(PAGE_SIZE));

      const res = await fetch(`/api/admin/listings?${params.toString()}`);
      const data = (await res.json()) as { items?: Listing[]; total?: number; error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not load listings');

      setItems(data.items || []);
      setTotal(data.total || 0);
      setOffset(nextOffset);
    } catch (err: any) {
      toast.error('Could not load listings', { description: err?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchListings(0);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, premiumFilter, featuredFilter, healthFilter]);

  const runAction = async (
    id: string,
    action: 'set_premium' | 'unset_premium' | 'edit' | 'unpublish' | 'republish' | 'delete' | 'feature',
    extra?: { fields?: Partial<EditFields>; days?: number }
  ) => {
    setLoadingId(id);
    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const data = (await res.json()) as { error?: string; message?: string; featuredUntil?: string };
      if (!res.ok) throw new Error(data.error || 'Action failed');

      if (action === 'delete') {
        setItems((prev) => prev.filter((s) => s.id !== id));
        setTotal((prev) => Math.max(0, prev - 1));
      } else if (action === 'set_premium' || action === 'unset_premium') {
        setItems((prev) =>
          prev.map((s) => (s.id === id ? { ...s, isPremium: action === 'set_premium' } : s))
        );
      } else if (action === 'unpublish' || action === 'republish') {
        setItems((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status: action === 'unpublish' ? 'removed' : 'active' } : s))
        );
      } else if (action === 'edit') {
        setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...extra?.fields } : s)));
        setEditingId(null);
      } else if (action === 'feature') {
        setItems((prev) =>
          prev.map((s) => (s.id === id ? { ...s, featuredUntil: data.featuredUntil ?? s.featuredUntil } : s))
        );
        setFeatureDays((prev) => ({ ...prev, [id]: '' }));
      }

      toast.success(data.message || 'Done');
    } catch (err: any) {
      toast.error('Action failed', { description: err?.message || 'Something went wrong.' });
    } finally {
      setLoadingId(null);
    }
  };

  const startEdit = (listing: Listing) => {
    setEditingId(listing.id);
    setEditForm({
      name: listing.name,
      description: listing.description,
      category: listing.category,
      url: listing.url,
      websiteUrl: listing.websiteUrl || '',
    });
  };

  const saveEdit = (id: string) => {
    runAction(id, 'edit', {
      fields: {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        category: editForm.category.trim(),
        url: editForm.url.trim(),
        websiteUrl: editForm.websiteUrl.trim(),
      },
    });
  };

  const grantFeatured = (id: string) => {
    const days = Number(featureDays[id]);
    if (!days || days < 1) {
      toast.error('Enter a number of days to grant.');
      return;
    }
    runAction(id, 'feature', { days });
  };

  const deleteListing = (listing: Listing) => {
    if (!window.confirm(`Permanently delete "${listing.name}"? This cannot be undone.`)) return;
    runAction(listing.id, 'delete');
  };

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <input
          className="form-input"
          placeholder="Search name or URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 220px' }}
        />
        <select
          className="form-input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: 'auto' }}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="removed">Removed</option>
        </select>
        <select
          className="form-input"
          value={premiumFilter}
          onChange={(e) => setPremiumFilter(e.target.value)}
          style={{ width: 'auto' }}
        >
          <option value="">Any premium</option>
          <option value="true">Premium only</option>
          <option value="false">Free only</option>
        </select>
        <select
          className="form-input"
          value={featuredFilter}
          onChange={(e) => setFeaturedFilter(e.target.value)}
          style={{ width: 'auto' }}
        >
          <option value="">Any featured</option>
          <option value="true">Currently featured</option>
        </select>
        <select
          className="form-input"
          value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value)}
          style={{ width: 'auto' }}
        >
          <option value="">Any health</option>
          <option value="healthy">Healthy</option>
          <option value="unknown">Unknown</option>
          <option value="archived">Archived</option>
          <option value="offline">Offline</option>
        </select>
      </div>

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
              <th style={{ padding: '1rem' }}>Name</th>
              <th style={{ padding: '1rem' }}>Links</th>
              <th style={{ padding: '1rem' }}>Featured</th>
              <th style={{ padding: '1rem' }}>Submitted</th>
              <th style={{ padding: '1rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No listings match these filters.
                </td>
              </tr>
            ) : (
              items.map((listing) => {
                const featuredUntilDate = listing.featuredUntil ? new Date(listing.featuredUntil) : null;
                const featuredDaysLeft = featuredUntilDate
                  ? Math.ceil((featuredUntilDate.getTime() - Date.now()) / 86400000)
                  : null;
                const isEditing = editingId === listing.id;
                const rowLoading = loadingId === listing.id;

                return (
                  <tr key={listing.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '260px' }}>
                          <input
                            className="form-input"
                            value={editForm.name}
                            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                            placeholder="Name"
                          />
                          <textarea
                            className="form-input"
                            rows={3}
                            value={editForm.description}
                            onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                            placeholder="Description"
                          />
                          <input
                            className="form-input"
                            value={editForm.category}
                            onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                            placeholder="Category"
                          />
                          <input
                            className="form-input"
                            value={editForm.url}
                            onChange={(e) => setEditForm((f) => ({ ...f, url: e.target.value }))}
                            placeholder="Repo URL"
                          />
                          <input
                            className="form-input"
                            value={editForm.websiteUrl}
                            onChange={(e) => setEditForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                            placeholder="Website URL"
                          />
                        </div>
                      ) : (
                        <>
                          <strong>{listing.name}</strong>
                          {listing.status === 'removed' && (
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>
                              REMOVED
                            </span>
                          )}
                          {listing.isPremium && (
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#00E5FF', fontWeight: 700 }}>
                              PREMIUM
                            </span>
                          )}
                          <div
                            style={{
                              fontSize: '0.875rem',
                              color: 'var(--text-secondary)',
                              marginTop: '0.25rem',
                              maxWidth: '300px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {listing.description}
                          </div>
                        </>
                      )}
                    </td>
                    <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <a
                          href={listing.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}
                        >
                          Repo
                        </a>
                        {listing.websiteUrl && (
                          <a
                            href={listing.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}
                          >
                            Website
                          </a>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        {featuredDaysLeft && featuredDaysLeft > 0 ? `${featuredDaysLeft}d left` : '—'}
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <input
                          type="number"
                          min={1}
                          className="form-input"
                          placeholder="Days"
                          value={featureDays[listing.id] || ''}
                          onChange={(e) => setFeatureDays((prev) => ({ ...prev, [listing.id]: e.target.value }))}
                          style={{ width: '70px' }}
                        />
                        <button
                          onClick={() => grantFeatured(listing.id)}
                          disabled={rowLoading}
                          style={btnStyle('#007BFF', rowLoading)}
                        >
                          Grant
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', verticalAlign: 'top' }}>
                      {new Date(listing.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', maxWidth: '220px' }}>
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit(listing.id)}
                              disabled={rowLoading}
                              style={btnStyle('#10b981', rowLoading)}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              disabled={rowLoading}
                              style={btnStyle('#64748b', rowLoading)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => runAction(listing.id, listing.isPremium ? 'unset_premium' : 'set_premium')}
                              disabled={rowLoading}
                              style={btnStyle(listing.isPremium ? '#64748b' : '#007BFF', rowLoading)}
                            >
                              {listing.isPremium ? 'Remove premium' : 'Make premium'}
                            </button>
                            <button
                              onClick={() => startEdit(listing)}
                              disabled={rowLoading}
                              style={btnStyle('#64748b', rowLoading)}
                            >
                              Edit
                            </button>
                            {listing.status === 'active' ? (
                              <button
                                onClick={() => runAction(listing.id, 'unpublish')}
                                disabled={rowLoading}
                                style={btnStyle('#f59e0b', rowLoading)}
                              >
                                Unpublish
                              </button>
                            ) : listing.status === 'removed' ? (
                              <button
                                onClick={() => runAction(listing.id, 'republish')}
                                disabled={rowLoading}
                                style={btnStyle('#10b981', rowLoading)}
                              >
                                Republish
                              </button>
                            ) : null}
                            <button
                              onClick={() => deleteListing(listing)}
                              disabled={rowLoading}
                              style={btnStyle('#ef4444', rowLoading)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {total === 0
            ? 'No listings'
            : `Showing ${offset + 1}-${Math.min(offset + PAGE_SIZE, total)} of ${total} (page ${page} of ${totalPages})`}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => fetchListings(Math.max(0, offset - PAGE_SIZE))}
            disabled={loading || offset === 0}
            style={btnStyle('#64748b', loading || offset === 0)}
          >
            Prev
          </button>
          <button
            onClick={() => fetchListings(offset + PAGE_SIZE)}
            disabled={loading || offset + PAGE_SIZE >= total}
            style={btnStyle('#64748b', loading || offset + PAGE_SIZE >= total)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function btnStyle(bg: string, disabled: boolean): CSSProperties {
  return {
    padding: '0.5rem 1rem',
    background: bg,
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontSize: '0.85rem',
    fontWeight: 600,
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `app/admin/ManageListings.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/admin/ManageListings.tsx
git commit -m "Add ManageListings: search/filter/paginate/edit/publish/feature admin table"
```

---

## Task 7: Wire it together — `app/admin/page.tsx` and `app/admin/AdminClient.tsx`

**Files:**
- Modify: `app/admin/page.tsx` (full file — see below)
- Modify: `app/admin/AdminClient.tsx` (full file — see below)

**Interfaces:**
- Consumes: `getAdminStats` (Task 3), `StatsBar` (Task 5), `ManageListings` (Task 6).
- Produces: the assembled `/admin` page — no other task consumes this.

- [ ] **Step 1: Replace `app/admin/page.tsx`**

```tsx
import { headers } from 'next/headers';
import { drizzle } from 'drizzle-orm/d1';
import { servers } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { getAuthorizedAdminEmail } from '../../lib/accessAuth';
import { getAdminStats, type AdminStats } from '../../lib/adminStats';
import AdminClient from './AdminClient';
import { StatsBar } from './StatsBar';

export const dynamic = 'force-dynamic';

const EMPTY_STATS: AdminStats = {
  statusCounts: { pending: 0, active: 0, removed: 0 },
  premiumCount: 0,
  featuredCount: 0,
  unhealthyCount: 0,
  engagement: { totalViews: 0, totalUpvotes: 0, totalCopies: 0 },
  topByViews: [],
};

async function getAdminData() {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const db = drizzle((ctx.env as any).DB);
      // Priority-review paid listings first
      const pendingServers = await db
        .select()
        .from(servers)
        .where(eq(servers.status, 'pending'))
        .orderBy(desc(servers.reviewPriority), desc(servers.createdAt));

      const map = (s: typeof pendingServers[0]) => ({
        ...s,
        createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
      });

      return {
        pending: pendingServers.map(map),
        stats: await getAdminStats(db),
      };
    }
  } catch (e) {
    // Fallback if not in edge context
  }
  return { pending: [], stats: EMPTY_STATS };
}

export default async function AdminPage() {
  const reqHeaders = await headers();
  const email = await getAuthorizedAdminEmail(reqHeaders);

  if (!email) {
    return (
      <main className="container animate-fade-in" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <h1>Unauthorized</h1>
        <p style={{ color: 'var(--text-secondary)' }}>This page is only accessible through Cloudflare Access.</p>
      </main>
    );
  }

  const { pending, stats } = await getAdminData();

  return (
    <main className="container animate-fade-in" style={{ padding: '4rem 1rem' }}>
      <h1 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>Admin Dashboard</h1>
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '3rem' }}>
        Review submissions and manage listings. Logged in as {email}.
      </p>

      <div style={{ maxWidth: '1100px', margin: '0 auto 2rem' }}>
        <StatsBar stats={stats} />
      </div>

      <AdminClient initialPending={pending as any} />
    </main>
  );
}
```

- [ ] **Step 2: Replace `app/admin/AdminClient.tsx`**

```tsx
'use client';

import { useState, type CSSProperties } from 'react';
import { toast } from '../../components/ui/Toast';
import ManageListings from './ManageListings';

type Server = {
  id: string;
  name: string;
  url: string;
  websiteUrl?: string | null;
  description: string;
  createdAt: string;
  reviewPriority?: boolean;
};

export default function AdminClient({ initialPending }: { initialPending: Server[] }) {
  const [pending, setPending] = useState<Server[]>(initialPending);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
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

      setPending((prev) => prev.filter((s) => s.id !== id));
      toast.success(action === 'approve' ? 'Listing approved' : 'Listing rejected');
    } catch (err: any) {
      toast.error('Action failed', {
        description: err?.message || 'Something went wrong.',
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '3rem' }}>
      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Pending submissions</h2>
        <PendingTable
          servers={pending}
          loadingId={loadingId}
          onApprove={(id) => handleAction(id, 'approve')}
          onReject={(id) => handleAction(id, 'reject')}
        />
      </section>

      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Manage listings</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Search, edit, publish/unpublish, delete, and grant featured placement. Premium listings get
          a dofollow website backlink; free listings use nofollow.
        </p>
        <ManageListings />
      </section>
    </div>
  );
}

function PendingTable({
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
            <th style={{ padding: '1rem' }}>Name</th>
            <th style={{ padding: '1rem' }}>Links</th>
            <th style={{ padding: '1rem' }}>Submitted</th>
            <th style={{ padding: '1rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {servers.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No pending submissions!
              </td>
            </tr>
          ) : (
            servers.map((server) => (
              <tr key={server.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '1rem' }}>
                  <strong>{server.name}</strong>
                  {server.reviewPriority && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#fbbf24', fontWeight: 700 }}>
                      PRIORITY
                    </span>
                  )}
                  <div
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      marginTop: '0.25rem',
                      maxWidth: '300px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {server.description}
                  </div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <a href={server.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>
                      Repo
                    </a>
                    {server.websiteUrl && (
                      <a href={server.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>
                        Website
                      </a>
                    )}
                  </div>
                </td>
                <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                  {new Date(server.createdAt).toLocaleDateString()}
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
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function btnStyle(bg: string, disabled: boolean): CSSProperties {
  return {
    padding: '0.5rem 1rem',
    background: bg,
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontSize: '0.85rem',
    fontWeight: 600,
  };
}
```

- [ ] **Step 3: Manually verify the assembled page**

Run: `npx tsc --noEmit` — expect no new errors.

Run: `npm run preview`, then against a deployed/Access-authenticated environment (or a locally stubbed Access JWT per `lib/accessAuth.ts`), visit `/admin` and confirm:
- The stats overview renders with plausible numbers at the top.
- "Pending submissions" still lists pending listings with working Approve/Reject.
- "Manage listings" loads a first page of listings with search, four filter dropdowns, and Prev/Next.

- [ ] **Step 4: Commit**

```bash
git add app/admin/page.tsx app/admin/AdminClient.tsx
git commit -m "Wire StatsBar and ManageListings into the admin page"
```

---

## Task 8: End-to-end smoke test (regression pass)

**Files:** none (operational task — runs the full manual checklist from the design spec against the assembled feature).

- [ ] **Step 1: Build check**

Run: `npx next build`
Expected: builds cleanly (no new errors).

- [ ] **Step 2: Run the full smoke-test checklist from the design spec**

Run: `npm run preview`, then against a deployed/Access-authenticated environment walk through, in order:

1. Load `/admin` → stats bar shows counts matching a manual query (`npx wrangler d1 execute all-mcps --local --command "SELECT status, COUNT(*) FROM servers GROUP BY status;"`, and similarly for premium/featured/unhealthy).
2. Search for a listing you know is older than the previous 50-row cutoff (or any listing not among the 25 most recent) → confirm it's found.
3. Filter by Premium=true, Featured=true, Health=offline independently and combined → confirm the row sets and the "Showing X-Y of Z" label match expectations.
4. Click Edit on a listing, change name/description/category/url/websiteUrl, Save → confirm the row updates immediately and `SELECT * FROM servers WHERE id='<id>'` reflects the new values; confirm the live `/mcp/<id>` page shows the new name/description.
5. Edit a listing's `websiteUrl` to `http://127.0.0.1` and Save → confirm a clear error toast and no DB write (SSRF guard).
6. Click Unpublish on an active listing → confirm it disappears from `/browse` and from `GET /api/mcp` (public feed), while `/mcp/<id>` still loads directly. Click Republish → confirm it reappears in `/browse`.
7. Enter 7 in the Days box and click Grant on a listing with no current featured time → confirm it shows "7d left". Grant 7 again → confirm it now shows "14d left" (stacked, not reset).
8. Click Delete on a listing, cancel the confirm dialog → confirm nothing happens. Click Delete again, confirm → confirm the row disappears from the table and from D1 (`SELECT * FROM servers WHERE id='<id>'` returns nothing).
9. Confirm the "Pending submissions" queue and its Approve/Reject actions still work exactly as before this change (regression check).

- [ ] **Step 3: No commit needed for this task** (verification-only; if any step surfaces a bug, fix it in the relevant task's file and commit that fix separately with a message describing the fix.)
