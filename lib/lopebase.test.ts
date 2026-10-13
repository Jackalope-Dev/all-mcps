import { conformanceChecks } from '@lopebase/adapter/conformance';
import { describe, expect, it } from 'vitest';
import {
  createLopebaseAdapter,
  type LopebaseStore,
  lopebaseServices,
  type ServiceDeps,
} from './lopebase';

const SECRET = 'lbs_test_secret_at_least_16_chars';

const USERS = [
  { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com', role: 'admin' },
  { id: 'u2', name: 'Grace Hopper', email: 'grace@example.com', role: 'user' },
];
const LISTINGS = [
  {
    id: 'l1',
    name: 'Example MCP',
    category: 'Developer Tools',
    status: 'active',
    premium_status: 'free',
    is_official: false,
    health_status: 'healthy',
    github_stars: 12,
    created_at: new Date('2026-09-01T00:00:00Z'),
    // Undeclared column: the adapter must drop it.
    stripe_customer_id: 'cus_123',
  },
];

function list<T extends { id: string }>(rows: T[]) {
  return async ({ limit, cursor }: { limit: number; cursor?: string }) => {
    const after = cursor ? rows.filter((r) => r.id > cursor) : rows;
    const kept = after.slice(0, limit);
    return {
      rows: kept,
      nextCursor: after.length > limit ? kept[kept.length - 1].id : undefined,
    };
  };
}

const store: LopebaseStore = {
  stats: async () => ({ users: USERS.length, listings: LISTINGS.length }),
  listUsers: list(USERS),
  getUser: async (id) => USERS.find((u) => u.id === id) ?? null,
  listListings: list(LISTINGS),
  getListing: async (id) => LISTINGS.find((l) => l.id === id) ?? null,
};

describe('LopeBase adapter conformance', () => {
  const adapter = createLopebaseAdapter({ secrets: [SECRET], store });
  for (const c of conformanceChecks({
    adapter,
    secret: SECRET,
    basePath: '/api/lopebase',
    sampleResource: 'listings',
  })) {
    it(c.name, c.run);
  }
});

describe('LopeBase health services', () => {
  const ok = {
    db: { prepare: () => ({ first: async () => ({ 1: 1 }) }) },
    isrCache: { head: async () => null },
    logos: { head: async () => null },
    vectors: { describe: async () => ({}) },
    jobs: { fetch: async () => new Response('Not found', { status: 404 }) },
  } as unknown as ServiceDeps;

  async function health(deps: ServiceDeps) {
    const adapter = createLopebaseAdapter({
      secrets: [SECRET],
      store,
      services: lopebaseServices(async () => deps),
    });
    const res = await adapter.handle(
      new Request('https://allmcps.com/api/lopebase/health'),
    );
    return {
      status: res.status,
      body: (await res.json()) as { status: string },
    };
  }

  it('reports degraded, not down, when only non-critical services fail', async () => {
    // No Resend key and no JOBS binding: both non-critical.
    const { status, body } = await health(ok);
    expect(status).toBe(200);
    expect(body.status).toBe('degraded');
  });

  it('reports down when the database fails', async () => {
    const { status, body } = await health({
      ...ok,
      db: {
        prepare: () => ({
          first: async () => {
            throw new Error('D1 unavailable');
          },
        }),
      } as unknown as D1Database,
    });
    expect(status).toBe(503);
    expect(body.status).toBe('down');
  });
});
