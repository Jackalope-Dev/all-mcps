import {
  type AdminAdapter,
  cachedCheck,
  createAdminAdapter,
  memoryAuditStore,
  type Page,
  type ServiceCheck,
  signedAuth,
} from '@lopebase/adapter';
import {
  and,
  asc,
  count,
  countDistinct,
  eq,
  gt,
  gte,
  like,
  or,
} from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { servers, users } from '../db/schema';
import { PAID_PRODUCTS } from './pricing';

/**
 * Read-only LopeBase admin adapter, mounted at /api/lopebase.
 *
 * LopeBase (our ops console) calls it with HMAC-signed requests keyed on
 * LOPEBASE_SIGNING_SECRET. It exposes counts plus two resources (users,
 * listings) cut down to the fields declared below; there are no updates or
 * actions. Personal fields (emails, names) leave masked — the owner chose
 * "masked" when this was set up.
 *
 * Data access goes through `LopebaseStore` so the conformance suite can run
 * against an in-memory store without D1.
 */

type Row = Record<string, unknown>;

type ListArgs = { limit: number; cursor?: string; search?: string };

export interface LopebaseStore {
  stats(): Promise<Record<string, number>>;
  listUsers(args: ListArgs): Promise<Page<Row>>;
  getUser(id: string): Promise<Row | null>;
  listListings(args: ListArgs): Promise<Page<Row>>;
  getListing(id: string): Promise<Row | null>;
}

const PREMIUM_MONTHLY_USD = PAID_PRODUCTS.premium_monthly.unitAmount / 100;

export function createLopebaseAdapter(opts: {
  secrets: (string | undefined)[];
  store: LopebaseStore;
  services?: ServiceCheck[];
}): AdminAdapter {
  const { store } = opts;
  return createAdminAdapter({
    connectorId: 'all-mcps',
    personalData: 'masked',
    authenticate: signedAuth({
      secrets: opts.secrets,
      capabilities: ['users.read', 'system.read'],
    }),
    audit: memoryAuditStore(), // read-only: nothing is written
    services: opts.services,
    async overview() {
      return { attentionItems: [], stats: await store.stats() };
    },
    resources: [
      {
        name: 'users',
        label: 'Users',
        readCapability: 'users.read',
        fields: [
          { name: 'id', label: 'ID', type: 'string' },
          { name: 'name', label: 'Name', type: 'string', inList: true },
          { name: 'email', label: 'Email', type: 'string', inList: true },
          {
            name: 'role',
            label: 'Role',
            type: 'enum',
            enumValues: ['user', 'admin'],
            inList: true,
          },
        ],
        list: ({ limit, cursor, search }) =>
          store.listUsers({ limit: clampLimit(limit), cursor, search }),
        get: (id) => store.getUser(id),
      },
      {
        name: 'listings',
        label: 'MCP listings',
        readCapability: 'users.read',
        fields: [
          { name: 'id', label: 'ID', type: 'string' },
          { name: 'name', label: 'Name', type: 'string', inList: true },
          { name: 'category', label: 'Category', type: 'string', inList: true },
          { name: 'status', label: 'Status', type: 'string', inList: true },
          {
            name: 'premium_status',
            label: 'Premium',
            type: 'enum',
            enumValues: ['free', 'active', 'past_due', 'canceled'],
            inList: true,
          },
          { name: 'is_official', label: 'Official', type: 'boolean' },
          { name: 'health_status', label: 'Health', type: 'string' },
          { name: 'github_stars', label: 'GitHub stars', type: 'number' },
          {
            name: 'created_at',
            label: 'Submitted',
            type: 'date',
            inList: true,
          },
        ],
        list: ({ limit, cursor, search }) =>
          store.listListings({ limit: clampLimit(limit), cursor, search }),
        get: (id) => store.getListing(id),
      },
    ],
  });
}

/** Bindings and secrets the service checks read, resolved per health poll. */
export type ServiceDeps = {
  db: D1Database;
  isrCache?: R2Bucket;
  logos: R2Bucket;
  vectors: VectorizeIndex;
  jobs?: Fetcher;
  resendApiKey?: string;
};

/**
 * What the app cannot work without, for GET /api/lopebase/health. Each check
 * makes the cheapest call with the app's own bindings/credentials. Build this
 * once at module scope so `cachedCheck` survives across requests.
 */
export function lopebaseServices(
  deps: () => Promise<ServiceDeps>,
): ServiceCheck[] {
  return [
    {
      id: 'db',
      label: 'D1 database',
      check: async () => {
        await (await deps()).db.prepare('select 1').first();
      },
    },
    {
      id: 'isr-cache',
      label: 'ISR cache (R2)',
      check: async () => {
        const { isrCache } = await deps();
        if (!isrCache) return false;
        await isrCache.head('lopebase-health');
      },
    },
    {
      id: 'logos',
      label: 'Logos (R2)',
      critical: false,
      check: async () => {
        await (await deps()).logos.head('lopebase-health');
      },
    },
    {
      id: 'vectorize',
      label: 'Search index (Vectorize)',
      critical: false,
      check: async () => {
        await (await deps()).vectors.describe();
      },
    },
    {
      // The jobs Worker has no public routes; a 404 from it proves the
      // isolate is up and the binding is wired.
      id: 'jobs',
      label: 'Jobs worker',
      critical: false,
      check: async () => {
        const { jobs } = await deps();
        if (!jobs) return false;
        const res = await jobs.fetch('https://jobs.internal/lopebase-health');
        await res.body?.cancel();
        return res.status < 500;
      },
    },
    cachedCheck({
      id: 'resend',
      label: 'Email (Resend)',
      critical: false,
      check: async () => {
        const { resendApiKey } = await deps();
        if (!resendApiKey) return false;
        const res = await fetch('https://api.resend.com/domains', {
          headers: { authorization: `Bearer ${resendApiKey}` },
        });
        await res.body?.cancel();
        return res.ok;
      },
    }),
  ];
}

function clampLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? 25, 1), 100);
}

/** Cursor pagination on the primary key: fetch one extra row to know if there's a next page. */
function page(rows: Row[], limit: number): Page<Row> {
  if (rows.length <= limit) return { rows };
  const kept = rows.slice(0, limit);
  return { rows: kept, nextCursor: String(kept[kept.length - 1].id) };
}

const listingColumns = {
  id: servers.id,
  name: servers.name,
  category: servers.category,
  status: servers.status,
  premium_status: servers.premiumStatus,
  is_official: servers.isOfficial,
  health_status: servers.healthStatus,
  github_stars: servers.githubStars,
  created_at: servers.createdAt,
};

const userColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
};

export function d1LopebaseStore(db: DrizzleD1Database): LopebaseStore {
  return {
    async stats() {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [
        [userCount],
        [listingCount],
        [liveCount],
        [newListings],
        [paying],
      ] = await Promise.all([
        db.select({ n: count() }).from(users),
        db.select({ n: count() }).from(servers),
        db
          .select({ n: count() })
          .from(servers)
          .where(eq(servers.status, 'active')),
        db
          .select({ n: count() })
          .from(servers)
          .where(gte(servers.createdAt, weekAgo)),
        db
          .select({ n: countDistinct(servers.stripeSubscriptionId) })
          .from(servers)
          .where(eq(servers.premiumStatus, 'active')),
      ]);
      return {
        users: userCount.n,
        // Users have no signup timestamp (Auth.js schema), so weekly growth is
        // tracked on listing submissions instead.
        listings: listingCount.n,
        listings_live: liveCount.n,
        listings_submitted_7d: newListings.n,
        paying_customers: paying.n,
        mrr_usd: paying.n * PREMIUM_MONTHLY_USD,
      };
    },

    async listUsers({ limit, cursor, search }) {
      const q = search ? `%${search}%` : undefined;
      const rows = await db
        .select(userColumns)
        .from(users)
        .where(
          and(
            cursor ? gt(users.id, cursor) : undefined,
            q ? or(like(users.name, q), like(users.email, q)) : undefined,
          ),
        )
        .orderBy(asc(users.id))
        .limit(limit + 1);
      return page(rows, limit);
    },

    async getUser(id) {
      const [row] = await db
        .select(userColumns)
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return row ?? null;
    },

    async listListings({ limit, cursor, search }) {
      const rows = await db
        .select(listingColumns)
        .from(servers)
        .where(
          and(
            cursor ? gt(servers.id, cursor) : undefined,
            search ? like(servers.name, `%${search}%`) : undefined,
          ),
        )
        .orderBy(asc(servers.id))
        .limit(limit + 1);
      return page(rows, limit);
    },

    async getListing(id) {
      const [row] = await db
        .select(listingColumns)
        .from(servers)
        .where(eq(servers.id, id))
        .limit(1);
      return row ?? null;
    },
  };
}
