# Submitter Email Capture + Stripe ↔ Sequenzy Tagging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture a submitter's email on every listing submission, sync them to Sequenzy, and tag
Stripe purchasers by product — the foundation a later upsell sequence needs.

**Architecture:** A new `lib/sequenzy.ts` fetch-based client (mirrors `lib/stripe.ts`'s Workers-safe
pattern) wraps Sequenzy's `POST /api/v1/subscribers` REST endpoint. `app/api/submit/route.ts` calls
it after a successful DB insert; `app/api/stripe/webhook/route.ts` calls it after a successful
entitlement update. Both calls are fire-and-forget (never block or fail the caller's response).

**Tech Stack:** Next.js API routes on Cloudflare Workers (OpenNext), Drizzle ORM / D1, Sequenzy
REST API (`https://api.sequenzy.com/api/v1/subscribers`, Bearer token auth).

## Global Constraints

- Sequenzy calls must never throw past their call site — wrap in try/catch, `console.error` on
  failure, always return normally (spec: "Error handling").
- Every `POST /api/v1/subscribers` call must pass `duplicateStrategy: 'merge'` — the API default is
  `skip` (no-op on an existing email), which would silently drop the webhook's `paid-*` tag since
  the subscriber already exists from the submit-time call.
- Email is the sole consent mechanism for submit-flow emails — no separate marketing checkbox
  (spec: "Submit flow").
- Migration number is `0010` (`0009` is taken by `pending_claim`).
- Sequenzy company: AllMCPs (`o9o6i6w0za04yal2c8ba7gag`). Product Subscribers list id:
  `x8r0du7z66k34tdyuwnsvxwt`.

---

### Task 1: Sequenzy API key + `lib/sequenzy.ts` client

**Files:**
- Create: `lib/sequenzy.ts`
- Modify: `.dev.vars` (add `SEQUENZY_API_KEY=...`, gitignored — confirmed via `.gitignore:21`)
- Create: `docs/SEQUENZY_SETUP.md`

**Interfaces:**
- Produces: `syncSequenzySubscriber(input: SequenzySubscriberSync): Promise<void>` and
  `PRODUCT_SUBSCRIBERS_LIST_ID: string`, both exported from `lib/sequenzy.ts`, consumed by Tasks 3
  and 4.
  ```ts
  export type SequenzySubscriberSync = {
    email: string;
    tags: string[];
    lists?: string[];
    customAttributes?: Record<string, string>;
  };
  ```

- [ ] **Step 1: Create a scoped Sequenzy API key**

  Using the Sequenzy MCP tool, create a key scoped to data ingestion only (not full access — this
  key lives in a public-facing Workers app):
  ```
  create_api_key({ companyId: "o9o6i6w0za04yal2c8ba7gag", name: "AllMCPs Production (data ingest)", preset: "data_ingest_safe" })
  ```
  The response's `key` field is shown once. Copy it for Step 2.

- [ ] **Step 2: Add the key to local secrets**

  Append to `.dev.vars` (create the file if it doesn't exist yet; it's already gitignored):
  ```
  SEQUENZY_API_KEY=<key from Step 1>
  ```
  Note for the user in the PR description / handoff: production also needs this secret set via
  whatever mechanism `STRIPE_SECRET_KEY` uses today for the deployed Worker (see
  `docs/STRIPE_SETUP.md`'s "Secrets (Workers / local)" section for the existing pattern this
  project follows).

- [ ] **Step 3: Write the Sequenzy client**

  Create `lib/sequenzy.ts`:
  ```ts
  /**
   * Sequenzy subscriber sync. Fetch-based (Cloudflare Workers has no node:https) —
   * same rationale as lib/stripe.ts's explicit fetch http client.
   */

  const SEQUENZY_SUBSCRIBERS_URL = 'https://api.sequenzy.com/api/v1/subscribers';

  /** AllMCPs company, "Product Subscribers" list. */
  export const PRODUCT_SUBSCRIBERS_LIST_ID = 'x8r0du7z66k34tdyuwnsvxwt';

  export type SequenzySubscriberSync = {
    email: string;
    tags: string[];
    lists?: string[];
    customAttributes?: Record<string, string>;
  };

  /**
   * Best-effort create-or-tag a Sequenzy subscriber. Never throws — callers run this
   * alongside a submission or Stripe webhook and must not fail because Sequenzy is down.
   * Always merges (adds tags to an existing subscriber) rather than skipping or overwriting.
   */
  export async function syncSequenzySubscriber(input: SequenzySubscriberSync): Promise<void> {
    const key = process.env.SEQUENZY_API_KEY;
    if (!key) {
      console.warn('SEQUENZY_API_KEY not configured; skipping Sequenzy sync');
      return;
    }

    try {
      const res = await fetch(SEQUENZY_SUBSCRIBERS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: input.email,
          tags: input.tags,
          lists: input.lists,
          customAttributes: input.customAttributes,
          duplicateStrategy: 'merge',
          enrollInSequences: true,
        }),
      });

      if (!res.ok) {
        console.error('Sequenzy subscriber sync failed', res.status, await res.text());
      }
    } catch (e) {
      console.error('Sequenzy subscriber sync error', e);
    }
  }
  ```

- [ ] **Step 4: Verify the client against the live API**

  Run a one-off script to confirm the request shape is accepted (do this from a Node REPL or a
  throwaway `.ts` file — don't commit it):
  ```bash
  node -e "
  fetch('https://api.sequenzy.com/api/v1/subscribers', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.SEQUENZY_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'plan-verify-test@example.com', tags: ['plan-verify'], duplicateStrategy: 'merge' }),
  }).then(r => r.json()).then(console.log)
  " 
  ```
  (Run with `SEQUENZY_API_KEY` exported in the shell from the value in `.dev.vars`.)
  Expected: `{"success":true,"subscriber":{...,"tags":["plan-verify"],...}}`.

- [ ] **Step 5: Document the setup**

  Create `docs/SEQUENZY_SETUP.md`:
  ```markdown
  # Sequenzy setup (AllMCPs subscriber sync)

  ## Secrets (Workers / local)

  ```bash
  SEQUENZY_API_KEY=seq_...   # data_ingest_safe scoped key, see lib/sequenzy.ts
  ```

  Do **not** commit this key. It's created via the Sequenzy dashboard or MCP `create_api_key`
  tool, scoped to `data_ingest_safe` (create/tag subscribers only — this key ships in a
  publicly-deployed Worker's server-side code, never the client bundle).

  ## What syncs where

  - `POST /api/submit` — every submitter is added to the "Product Subscribers" list
    (`x8r0du7z66k34tdyuwnsvxwt`) tagged `submitted-listing`.
  - `POST /api/stripe/webhook` — on `checkout.session.completed`, the same subscriber (matched by
    email) gets tagged `paid-priority_review`, `paid-featured_7d`, or `paid-premium_monthly`.
  - Suppression (not emailing people who already paid) is handled by Sequenzy's **native Stripe
    integration**, already connected in the dashboard — it auto-tags any matching subscriber
    `customer`. The `paid-*` tags above are for future segmentation only, not suppression.

  ## App routes touched

  - `lib/sequenzy.ts` — shared client
  - `app/api/submit/route.ts` — subscriber creation
  - `app/api/stripe/webhook/route.ts` — purchase tagging
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add lib/sequenzy.ts docs/SEQUENZY_SETUP.md
  git commit -m "Add Sequenzy subscriber sync client"
  ```
  (`.dev.vars` is gitignored — it won't be staged.)

---

### Task 2: `submitter_email` column

**Files:**
- Modify: `db/schema.ts`
- Create: `drizzle/0010_submitter_email.sql` (generated, not hand-written)

**Interfaces:**
- Produces: `servers.submitterEmail: string | null` (Drizzle column `submitter_email`), consumed by
  Task 3 (write) and Task 4 (read as fallback).

- [ ] **Step 1: Add the column to the schema**

  In `db/schema.ts`, inside the `servers` table definition, add after `websiteUrl`:
  ```ts
  /** Email the submitter gave at submit time. Used for status notices and the submission upsell sequence. */
  submitterEmail: text('submitter_email'),
  ```

- [ ] **Step 2: Generate the migration**

  ```bash
  npx drizzle-kit generate --name=submitter_email
  ```
  Expected: creates `drizzle/0010_submitter_email.sql` containing
  `ALTER TABLE `servers` ADD `submitter_email` text;` and updates `drizzle/meta/_journal.json`.

- [ ] **Step 3: Apply the migration locally**

  ```bash
  npx wrangler d1 migrations apply all-mcps --local
  ```
  Expected: reports migration `0010_submitter_email` applied.

- [ ] **Step 4: Verify the column exists**

  ```bash
  npx wrangler d1 execute all-mcps --local --command "PRAGMA table_info(servers);"
  ```
  Expected: a row with `name: submitter_email`, `type: text`.

- [ ] **Step 5: Commit**

  ```bash
  git add db/schema.ts drizzle/0010_submitter_email.sql drizzle/meta/_journal.json
  git commit -m "Add servers.submitter_email column"
  ```

---

### Task 3: Submit form + API — collect and sync email

**Files:**
- Modify: `components/forms/SubmitForm.tsx`
- Modify: `app/api/submit/route.ts`

**Interfaces:**
- Consumes: `syncSequenzySubscriber`, `PRODUCT_SUBSCRIBERS_LIST_ID` from `lib/sequenzy.ts` (Task 1);
  `servers.submitterEmail` column (Task 2).

- [ ] **Step 1: Add the email field to the form**

  In `components/forms/SubmitForm.tsx`, add state and an input. Add `const [email, setEmail] =
  useState('');` alongside the existing `name`/`url`/`websiteUrl`/`description` state, and insert
  after the `name` `Input` (which is at line 180 today):
  ```tsx
  <Input
    name="email"
    label="Your email"
    placeholder="you@example.com"
    type="email"
    required
    value={email}
    onChange={(e) => setEmail(e.target.value)}
  />
  <p style={{ margin: '-0.75rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
    We'll email you about your listing status and occasional offers.
  </p>
  ```
  In `handleSubmit`, alongside the existing `data.name = name;` line, add:
  ```ts
  data.email = email;
  ```

- [ ] **Step 2: Require and validate email server-side**

  In `app/api/submit/route.ts`, add `email` to `submitSchema`:
  ```ts
  const submitSchema = z.object({
    url: z.string().optional().or(z.literal('')),
    name: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    email: z.string().email('Enter a valid email'),
    websiteUrl: z
      .string()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v || '').trim())
      .refine((v) => !v || z.string().url().safeParse(v).success, {
        message: 'Website must be a valid URL',
      }),
  });
  ```
  After `let url = ...` add:
  ```ts
  const email = result.data.email;
  ```

- [ ] **Step 3: Persist the email**

  In the `db.insert(servers).values({...})` call, add:
  ```ts
  submitterEmail: email,
  ```
  (alongside the existing `websiteUrl: websiteUrl || null,` line).

- [ ] **Step 4: Sync to Sequenzy after a successful insert**

  Add the import at the top of the file:
  ```ts
  import { syncSequenzySubscriber, PRODUCT_SUBSCRIBERS_LIST_ID } from '../../../lib/sequenzy';
  ```
  After the `.onConflictDoNothing();` insert call and before the `return NextResponse.json({...})`,
  add:
  ```ts
  await syncSequenzySubscriber({
    email,
    tags: ['submitted-listing'],
    lists: [PRODUCT_SUBSCRIBERS_LIST_ID],
    customAttributes: { serverId: id, serverName: name },
  });
  ```
  This runs after the insert succeeds — a Sequenzy failure (already swallowed inside
  `syncSequenzySubscriber`) never affects the `{ success: true, id }` response.

- [ ] **Step 5: Manual verification**

  Run the dev server (`npm run dev`), submit a listing through the UI with a real test email
  address, and confirm:
  - The response is a 200 with `{ success: true, id }`.
  - `npx wrangler d1 execute all-mcps --local --command "SELECT id, submitter_email FROM servers ORDER BY created_at DESC LIMIT 1;"`
    shows the email you entered.
  - In the Sequenzy dashboard (or via the `search_subscribers` MCP tool), the same email appears
    on the Product Subscribers list tagged `submitted-listing` with `serverId`/`serverName`
    attributes.

- [ ] **Step 6: Commit**

  ```bash
  git add components/forms/SubmitForm.tsx app/api/submit/route.ts
  git commit -m "Collect submitter email and sync to Sequenzy on submit"
  ```

---

### Task 4: Stripe webhook — tag purchasers by product

**Files:**
- Modify: `app/api/stripe/webhook/route.ts`

**Interfaces:**
- Consumes: `syncSequenzySubscriber` from `lib/sequenzy.ts` (Task 1); `servers.submitterEmail`
  (Task 2).

- [ ] **Step 1: Replace `applyCheckoutCompleted` with a single-select version that also tags Sequenzy**

  Replace the full function body (currently lines 21-76 of
  `app/api/stripe/webhook/route.ts`) with:
  ```ts
  async function applyCheckoutCompleted(session: Stripe.Checkout.Session) {
    const serverId = session.metadata?.serverId || session.client_reference_id;
    const sku = (session.metadata?.sku || '') as PaidSku;
    if (!serverId || !sku) {
      console.warn('Checkout session missing serverId/sku metadata', session.id);
      return;
    }

    const db = await getDb();
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id || null;

    const rows = await db.select().from(servers).where(eq(servers.id, serverId)).limit(1);
    const current = rows[0];

    if (sku === 'priority_review') {
      await db
        .update(servers)
        .set({
          reviewPriority: true,
          ...(customerId ? { stripeCustomerId: customerId } : {}),
        })
        .where(eq(servers.id, serverId));
    } else if (sku === 'featured_7d') {
      const base =
        current?.featuredUntil && new Date(current.featuredUntil).getTime() > Date.now()
          ? new Date(current.featuredUntil)
          : new Date();
      await db
        .update(servers)
        .set({
          featuredUntil: addDays(base, 7),
          ...(customerId ? { stripeCustomerId: customerId } : {}),
        })
        .where(eq(servers.id, serverId));
    } else if (sku === 'premium_monthly') {
      await db
        .update(servers)
        .set({
          isPremium: true,
          premiumStatus: 'active',
          ...(customerId ? { stripeCustomerId: customerId } : {}),
          ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
        })
        .where(eq(servers.id, serverId));
    }

    const email = session.customer_details?.email || current?.submitterEmail || null;
    if (email) {
      await syncSequenzySubscriber({
        email,
        tags: [`paid-${sku}`],
      });
    }
  }
  ```
  This folds the `featured_7d` branch's existing row-select up to the top (now shared by all three
  branches instead of just one), and adds the Sequenzy call at the end regardless of which branch
  ran.

- [ ] **Step 2: Add the import**

  At the top of `app/api/stripe/webhook/route.ts`, alongside the existing `getStripe` import, add:
  ```ts
  import { syncSequenzySubscriber } from '../../../../lib/sequenzy';
  ```

- [ ] **Step 3: Manual verification**

  Using Stripe CLI test mode (`stripe listen --forward-to localhost:3000/api/stripe/webhook`),
  run a test checkout for each of the three SKUs against a listing that has a `submitter_email`
  set (from Task 3's test submission), then confirm via `search_subscribers` (Sequenzy MCP) or the
  dashboard that the subscriber has gained the matching `paid-priority_review`, `paid-featured_7d`,
  or `paid-premium_monthly` tag. Also confirm the `servers` row itself updated as it did before
  this change (`reviewPriority`/`featuredUntil`/`isPremium` — this refactor must not regress
  existing entitlement behavior).

- [ ] **Step 4: Commit**

  ```bash
  git add app/api/stripe/webhook/route.ts
  git commit -m "Tag Sequenzy subscribers by purchased product on Stripe checkout"
  ```

---

## Self-Review Notes

- **Spec coverage:** email field + required validation (Task 3), `submitter_email` column
  (Task 2), submit-time Sequenzy sync with list/tag/attributes (Task 3), per-SKU webhook tagging
  with email-resolution fallback (Task 4), Sequenzy client + API key + docs (Task 1). No native
  Stripe suppression logic added — confirmed intentional, per spec, since the existing integration
  already handles it.
- **Type consistency:** `SequenzySubscriberSync` fields (`email`, `tags`, `lists`,
  `customAttributes`) match between Task 1's definition and Tasks 3/4's call sites.
- **No placeholders:** all steps contain literal code/commands; manual-verification steps name
  exact commands and exact expected output rather than "test it works."
