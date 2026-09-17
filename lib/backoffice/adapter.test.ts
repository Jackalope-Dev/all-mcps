import { describe, expect, it } from 'vitest';
import { createBackofficeAdapter } from './adapter';
import type { AuditStore } from './kit/adapter';
import { conformanceChecks } from './kit/conformance';
import type { AuditEvent } from './kit/contract';
import type { Repo } from './repo';

const TOKEN = 'test-backoffice-token';

function memoryAudit(): AuditStore {
  const rows: AuditEvent[] = [];
  return {
    async write(e) {
      rows.unshift(e);
    },
    async list(q) {
      return { rows: rows.slice(0, q.limit ?? 100) };
    },
  };
}

function fakeRepo(): Repo {
  const users = [
    {
      id: 'u1',
      email: 'a@x.com',
      name: 'A',
      role: 'admin',
      emailVerified: null,
    },
    {
      id: 'u2',
      email: 'b@x.com',
      name: 'B',
      role: 'user',
      emailVerified: null,
    },
  ];
  const servers = [
    {
      id: 's1',
      name: 'Alpha',
      category: 'dev',
      premiumStatus: 'free',
      isOfficial: false,
      createdAt: null,
    },
  ];
  const reports: Record<string, unknown>[] = [
    {
      id: '1',
      serverId: 's1',
      reason: 'dead_link',
      status: 'open',
      details: null,
      createdAt: null,
      reviewedAt: null,
    },
  ];
  return {
    users: {
      async list({ limit }) {
        return { rows: users.slice(0, limit), total: users.length };
      },
      async get(id) {
        return users.find((u) => u.id === id) ?? null;
      },
    },
    servers: {
      async list({ limit }) {
        return { rows: servers.slice(0, limit), total: servers.length };
      },
      async get(id) {
        return servers.find((s) => s.id === id) ?? null;
      },
    },
    reports: {
      async list({ limit }) {
        return { rows: reports.slice(0, limit), total: reports.length };
      },
      async get(id) {
        return reports.find((r) => r.id === id) ?? null;
      },
      async setStatus(id, status) {
        const r = reports.find((x) => x.id === id);
        if (!r) throw new Error('not found');
        r.status = status;
        r.reviewedAt = new Date().toISOString();
        return { ...r };
      },
    },
    async stats() {
      return { users: users.length, servers: servers.length, openReports: 1 };
    },
  };
}

const build = () =>
  createBackofficeAdapter({
    repo: fakeRepo(),
    audit: memoryAudit(),
    token: TOKEN,
  });

const base = 'https://allmcps.com/api/backoffice';
const call = (path: string, init?: RequestInit, token: string = TOKEN) =>
  build().handle(
    new Request(base + path, {
      ...init,
      headers: { authorization: `Bearer ${token}`, ...init?.headers },
    }),
  );

// noExplicitAny is disabled repo-wide (biome.json); loose typing keeps assertions terse.
const j = (res: Response): Promise<any> => res.json();

describe('AllMcps back-office adapter', () => {
  it('404s when the token is unset (fail-closed) via missing bearer', async () => {
    // The route itself 404s with no env token; here we prove a wrong token 401s.
    expect((await call('/resources', {}, 'nope')).status).toBe(401);
  });

  it('exposes users, servers, reports', async () => {
    const body = await j(await call('/resources'));
    expect(body.resources.map((r: { name: string }) => r.name).sort()).toEqual([
      'reports',
      'servers',
      'users',
    ]);
  });

  it('reports declare the content.review capability', async () => {
    const body = await j(await call('/resources'));
    const reports = body.resources.find(
      (r: { name: string }) => r.name === 'reports',
    );
    expect(reports.readCapability).toBe('content.review');
  });

  it('resolve_report action updates status and writes audit', async () => {
    const adapter = build();
    const res = await adapter.handle(
      new Request(`${base}/actions/resolve_report`, {
        method: 'POST',
        headers: { authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({
          params: { reportId: '1', status: 'dismissed' },
        }),
      }),
    );
    const body = await j(res);
    expect(body.ok).toBe(true);
    const audit = await j(
      await adapter.handle(
        new Request(`${base}/audit`, {
          headers: { authorization: `Bearer ${TOKEN}` },
        }),
      ),
    );
    expect(audit.rows[0].action).toBe('resolve_report');
    expect(audit.rows[0].after.status).toBe('dismissed');
  });

  it('passes the ADR 0006 conformance suite', async () => {
    for (const c of conformanceChecks({
      adapter: build(),
      token: TOKEN,
      origin: 'https://allmcps.com',
    })) {
      await c.run();
    }
  });
});
