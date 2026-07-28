# Automated Weekly Newsletter Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A weekly cron-driven route that queries new/trending listings from D1, builds fresh email
content, and schedules a one-off Sequenzy campaign send to the Newsletter Subscribers list.

**Architecture:** `.github/workflows/newsletter-digest.yml` (new, mirrors `health-check.yml`'s
`ADMIN_SECRET` bearer-token curl pattern) triggers `POST /api/cron/newsletter-digest` weekly. That
route queries D1 directly (no repeat-block templating — blocks are built in plain TypeScript),
then calls the Sequenzy REST API directly (`POST /api/v1/campaigns`, `POST
/api/v1/campaigns/{id}/schedule`) with a new, narrowly-scoped API key.

**Tech Stack:** Next.js API route on Cloudflare Workers, Drizzle ORM / D1, Sequenzy REST API,
GitHub Actions.

## Global Constraints

- No `repeat`/`computedLists` blocks anywhere — confirmed during design that mechanism is
  Sequenzy's product-recommendations feature, not a generic array templater. All per-listing
  content is built as flat heading/text/button block objects in a TypeScript loop.
- `schedule_campaign`'s REST equivalent is called **without** `recurringInterval` — every send is
  a one-off; the weekly cadence comes from the GitHub Actions cron re-running this route.
- If both the new-listings and trending-listings queries return empty, the route must return
  early without calling Sequenzy at all — never send an empty digest.
- **The final live-trigger verification (Task 5) can only happen after this code is deployed** —
  the GitHub Actions workflow curls `https://allmcps.com/...`, and the new
  `SEQUENZY_CAMPAIGNS_API_KEY` secret must be set on the deployed Worker first. Do not attempt
  Task 5 in this session; it's a explicit follow-up the user runs once deployed, and it schedules
  a **real send to real subscribers** if not cancelled within the 10-minute window — treat it with
  the same care as any other production send, not as routine dev testing.

---

### Task 1: Scoped Sequenzy API key for campaign sends

**Files:**
- Modify: `.dev.vars` (add `SEQUENZY_CAMPAIGNS_API_KEY=...`)
- Modify: `docs/SEQUENZY_SETUP.md`

- [ ] **Step 1: Create a narrowly-scoped API key**

  Using the Sequenzy MCP tool (explicit `scopes`, not a preset — the closest preset,
  `marketing_sender`, grants 25 scopes including sequence/AB-test/template management this route
  never touches):
  ```
  create_api_key({
    companyId: "o9o6i6w0za04yal2c8ba7gag",
    name: "AllMCPs Newsletter Digest (campaigns)",
    scopes: ["campaigns:read", "campaigns:write", "campaigns:send"]
  })
  ```
  Copy the returned `key`.

- [ ] **Step 2: Add to local secrets**

  Append to `.dev.vars`:
  ```
  SEQUENZY_CAMPAIGNS_API_KEY=<key from Step 1>
  ```

- [ ] **Step 3: Document it**

  In `docs/SEQUENZY_SETUP.md`, add below the existing `SEQUENZY_API_KEY` secrets block:
  ```markdown
  ```bash
  SEQUENZY_CAMPAIGNS_API_KEY=seq_...   # campaigns:read/write/send only, see app/api/cron/newsletter-digest/route.ts
  ```

  Separate from `SEQUENZY_API_KEY` on purpose — that key only ever creates/tags subscribers
  (`data_ingest_safe`); this one creates and schedules real campaign sends, so it's kept on its
  own narrower credential. Production needs it set the same way:

  ```bash
  npx wrangler secret put SEQUENZY_CAMPAIGNS_API_KEY
  ```
  ```
  And extend the "What syncs where" list with:
  ```markdown
  - `POST /api/cron/newsletter-digest` (weekly, via `.github/workflows/newsletter-digest.yml`) —
    builds and schedules the weekly digest campaign to the Newsletter Subscribers list.
  ```

- [ ] **Step 4: Commit reminder**

  `.dev.vars` is gitignored (confirmed in the first Sequenzy piece's plan) — nothing to stage
  there. Stage only `docs/SEQUENZY_SETUP.md`.

---

### Task 2: D1 queries + block-building, verified against a throwaway campaign

**Files:**
- Create: `app/api/cron/newsletter-digest/route.ts` (this task writes the query + block-building
  parts only; Task 3 adds the Sequenzy REST calls)

**Interfaces:**
- Produces: `buildDigestBlocks(newListings, trendingListings): SequenzyBlock[]`, a pure function
  consumed by Task 3.

- [ ] **Step 1: Write the file's query and block-building logic**

  ```ts
  import { NextResponse } from 'next/server';
  import { getCloudflareContext } from '@opennextjs/cloudflare';
  import { drizzle } from 'drizzle-orm/d1';
  import { and, eq, gte, desc, notInArray, sql } from 'drizzle-orm';
  import { servers } from '../../../../db/schema';
  import { isAdminAuthorized } from '../../../../lib/adminAuth';

  const NEW_WINDOW_DAYS = 7;
  const MAX_PER_SECTION = 6;
  const NEWSLETTER_SUBSCRIBERS_LIST_ID = 'ta0zh9e3l9rcjlfpzpk80tcn';
  const SENDER_PROFILE_ID = 'p1dmte08v6jd67cnlvz43396';
  const REPLY_PROFILE_ID = 'nmr7hkbzz2qpkq3mgs7dmhjk';
  const APP_URL = 'https://allmcps.com';

  type ListingSummary = { id: string; name: string; description: string };
  type SequenzyBlock = Record<string, any>;

  function truncate(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
  }

  function listingBlocks(listing: ListingSummary): SequenzyBlock[] {
    return [
      { type: 'heading', content: listing.name, level: 3 },
      { type: 'text', content: `<p>${truncate(listing.description, 140)}</p>`, variant: 'paragraph' },
      { type: 'button', text: 'View →', url: `${APP_URL}/mcp/${listing.id}`, variant: 'secondary' },
    ];
  }

  function buildDigestBlocks(
    newListings: ListingSummary[],
    trendingListings: ListingSummary[]
  ): SequenzyBlock[] {
    const blocks: SequenzyBlock[] = [{ type: 'heading', content: 'This week on AllMCPs', level: 1 }];

    if (newListings.length > 0) {
      blocks.push({ type: 'heading', content: 'New this week', level: 2 });
      for (const listing of newListings) blocks.push(...listingBlocks(listing));
    }

    if (trendingListings.length > 0) {
      blocks.push({ type: 'heading', content: 'Trending', level: 2 });
      for (const listing of trendingListings) blocks.push(...listingBlocks(listing));
    }

    blocks.push({ type: 'button', text: 'Browse the full directory →', url: `${APP_URL}/browse`, variant: 'primary' });

    return blocks;
  }
  ```
  (The `POST` handler using these is added in Task 3 — this task just gets the pure logic in
  place and verified.)

- [ ] **Step 2: Type-check**

  Run: `npx tsc --noEmit -p tsconfig.json` — expected no output. (The file has no `POST` export
  yet, which is fine for a `route.ts` mid-edit; Task 3 completes it.)

- [ ] **Step 3: Verify the block shape against a real throwaway campaign**

  Using the Sequenzy MCP tools (not the app), reproduce `buildDigestBlocks`'s output with sample
  data and confirm it actually renders — this is the exact same class of mistake ruled out earlier
  for merge tags and repeat blocks, so verify rather than assume:
  ```
  create_campaign({
    name: "digest-block-verify-test",
    subject: "test",
    status: "draft",
    blocks: [
      { type: "heading", content: "This week on AllMCPs", level: 1 },
      { type: "heading", content: "New this week", level: 2 },
      { type: "heading", content: "Test Server One", level: 3 },
      { type: "text", content: "<p>Does thing one.</p>", variant: "paragraph" },
      { type: "button", text: "View →", url: "https://allmcps.com/mcp/test-one", variant: "secondary" },
      { type: "button", text: "Browse the full directory →", url: "https://allmcps.com/browse", variant: "primary" }
    ]
  })
  ```
  Then `render_email({ campaignId: "<id from above>" })` and confirm the HTML contains "This week
  on AllMCPs", "Test Server One", "Does thing one.", and both button URLs correctly (not blank,
  not literal template syntax). Then `delete_campaign({ campaignId: "<id>" })` to clean up.

---

### Task 3: Complete the route — D1 query + Sequenzy REST calls

**Files:**
- Modify: `app/api/cron/newsletter-digest/route.ts`

**Interfaces:**
- Consumes: `buildDigestBlocks` (Task 2), `isAdminAuthorized` (existing `lib/adminAuth.ts`),
  `SEQUENZY_CAMPAIGNS_API_KEY` (Task 1).

- [ ] **Step 1: Add the Sequenzy REST helpers and the POST handler**

  Append to `app/api/cron/newsletter-digest/route.ts`:
  ```ts
  async function createSequenzyCampaign(input: { subject: string; blocks: SequenzyBlock[] }): Promise<string> {
    const key = process.env.SEQUENZY_CAMPAIGNS_API_KEY;
    if (!key) throw new Error('SEQUENZY_CAMPAIGNS_API_KEY is not configured');

    const res = await fetch('https://api.sequenzy.com/api/v1/campaigns', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Weekly Digest — ${new Date().toISOString().slice(0, 10)}`,
        subject: input.subject,
        blocks: input.blocks,
        targetLists: { type: 'lists', listIds: [NEWSLETTER_SUBSCRIBERS_LIST_ID] },
        senderProfileId: SENDER_PROFILE_ID,
        replyProfileId: REPLY_PROFILE_ID,
      }),
    });

    if (!res.ok) {
      throw new Error(`Sequenzy campaign creation failed: ${res.status}`);
    }

    const data = (await res.json()) as { campaign?: { id?: string } };
    const campaignId = data.campaign?.id;
    if (!campaignId) throw new Error('Sequenzy campaign creation returned no id');
    return campaignId;
  }

  async function scheduleSequenzyCampaign(campaignId: string): Promise<void> {
    const key = process.env.SEQUENZY_CAMPAIGNS_API_KEY;
    if (!key) throw new Error('SEQUENZY_CAMPAIGNS_API_KEY is not configured');

    const scheduledAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const res = await fetch(`https://api.sequenzy.com/api/v1/campaigns/${campaignId}/schedule`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledAt }),
    });

    if (!res.ok) {
      throw new Error(`Sequenzy campaign scheduling failed: ${res.status}`);
    }
  }

  export async function POST(req: Request) {
    try {
      if (!(await isAdminAuthorized(req))) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
      }

      let env;
      try {
        const ctx = await getCloudflareContext();
        env = ctx.env;
      } catch (e) {
        throw new Error('Could not get Cloudflare context.');
      }
      if (!env || !(env as any).DB) {
        throw new Error('Database binding not found');
      }

      const db = drizzle((env as any).DB);
      const sinceDate = new Date(Date.now() - NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000);

      const newRows = await db
        .select({ id: servers.id, name: servers.name, description: servers.description })
        .from(servers)
        .where(and(eq(servers.status, 'active'), gte(servers.createdAt, sinceDate)))
        .orderBy(desc(servers.createdAt))
        .limit(MAX_PER_SECTION);

      const newIds = newRows.map((r) => r.id);

      const trendingRows = await db
        .select({ id: servers.id, name: servers.name, description: servers.description })
        .from(servers)
        .where(
          newIds.length > 0
            ? and(eq(servers.status, 'active'), notInArray(servers.id, newIds))
            : eq(servers.status, 'active')
        )
        .orderBy(desc(sql`(${servers.upvotes} * 5 + ${servers.copies})`))
        .limit(MAX_PER_SECTION);

      if (newRows.length === 0 && trendingRows.length === 0) {
        return NextResponse.json({ success: true, skipped: true, message: 'No listings to feature this week.' });
      }

      const subjectParts: string[] = [];
      if (newRows.length > 0) subjectParts.push(`${newRows.length} new server${newRows.length === 1 ? '' : 's'}`);
      if (trendingRows.length > 0) subjectParts.push(`${trendingRows.length} trending`);
      const subject = `This week on AllMCPs: ${subjectParts.join(', ')}`;

      const blocks = buildDigestBlocks(newRows, trendingRows);
      const campaignId = await createSequenzyCampaign({ subject, blocks });
      await scheduleSequenzyCampaign(campaignId);

      return NextResponse.json({
        success: true,
        campaignId,
        newCount: newRows.length,
        trendingCount: trendingRows.length,
      });
    } catch (error: any) {
      console.error('Newsletter digest cron error:', error);
      return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
    }
  }
  ```

- [ ] **Step 2: Type-check**

  Run: `npx tsc --noEmit -p tsconfig.json` — expected no output.

- [ ] **Step 3: Verify the D1 query logic against local data**

  ```bash
  npx wrangler d1 execute all-mcps --local --command "SELECT id, name, created_at, upvotes, copies FROM servers WHERE status = 'active' ORDER BY created_at DESC LIMIT 6;"
  npx wrangler d1 execute all-mcps --local --command "SELECT id, name, (upvotes*5 + copies) AS score FROM servers WHERE status = 'active' ORDER BY score DESC LIMIT 6;"
  ```
  Confirm these match what the route's two queries would select (same ordering, same limit) —
  this validates the trending-score SQL expression independently of the Sequenzy calls, without
  needing `SEQUENZY_CAMPAIGNS_API_KEY` to be exercised locally.

---

### Task 4: GitHub Actions weekly trigger

**Files:**
- Create: `.github/workflows/newsletter-digest.yml`

- [ ] **Step 1: Write the workflow**

  ```yaml
  name: 📰 Weekly Newsletter Digest

  on:
    schedule:
      - cron: '0 14 * * 1'
    workflow_dispatch:

  jobs:
    send-digest:
      runs-on: ubuntu-latest
      steps:
        - name: Trigger Newsletter Digest API
          run: |
            curl -f -X POST https://allmcps.com/api/cron/newsletter-digest \
            -H "Authorization: Bearer ${{ secrets.ADMIN_SECRET }}"
  ```
  Same `ADMIN_SECRET` repo secret `health-check.yml` already uses — no new GitHub secret needed.

- [ ] **Step 2: Validate YAML syntax**

  ```bash
  python -c "import yaml, sys; yaml.safe_load(open('.github/workflows/newsletter-digest.yml'))" 2>&1 || npx -y js-yaml .github/workflows/newsletter-digest.yml > /dev/null
  ```
  Expected: no error (either command succeeding confirms valid YAML; use whichever is available).

---

### Task 5: Live verification (deferred — user runs this after deploying)

**Do not execute this task in the implementing session.** It requires the code from Tasks 1-4
deployed to production (`https://allmcps.com`) with `SEQUENZY_CAMPAIGNS_API_KEY` set as a Worker
secret — the GitHub Actions workflow curls the live domain, not localhost. Record it here so it
isn't lost, and hand it back explicitly when the plan finishes.

- [ ] **Step 1: Deploy** (the user's own action — not run automatically here)

- [ ] **Step 2: Set the production secret**

  ```bash
  npx wrangler secret put SEQUENZY_CAMPAIGNS_API_KEY
  ```

- [ ] **Step 3: Manually dispatch the workflow once**

  Via `gh workflow run newsletter-digest.yml` or the GitHub Actions UI's "Run workflow" button.

- [ ] **Step 4: Immediately check the created campaign — this is the real safety net**

  Within the 10-minute window before it actually sends:
  ```
  list_campaigns({ status: "scheduled" })
  get_campaign_audience({ campaignId: "<the new campaign>" })
  ```
  Confirm the audience is exactly the Newsletter Subscribers list (not all subscribers, not some
  other list) and the subject/content match what's expected. If anything is wrong, `cancel_campaign`
  immediately — after 10 minutes it sends for real to real subscribers.

---

## Self-Review Notes

- **Spec coverage:** D1 queries for new/trending with the same trending formula as `DirectoryGrid`
  (Task 2/3); empty-digest skip (Task 3); blocks built without repeat/computedLists, verified
  against a real throwaway campaign (Task 2); one-off `schedule_campaign` REST equivalent with no
  `recurringInterval` (Task 3); GitHub Actions weekly cron mirroring the existing `ADMIN_SECRET`
  pattern (Task 4); the live-send safety net explicitly deferred and never silently skipped
  (Task 5).
- **Type consistency:** `SequenzyBlock` and `ListingSummary` types are defined once in Task 2 and
  reused as-is in Task 3 — no renamed fields between them.
- **No placeholders:** every step is literal code, an exact command, or a precisely described
  manual check with named tools and expected values.
