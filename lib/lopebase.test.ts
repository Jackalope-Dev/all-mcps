import { conformanceChecks } from '@lopebase/adapter/conformance';
import { describe, it } from 'vitest';
import { createLopebaseAdapter, type LopebaseStore } from './lopebase';

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
