// Vendored from jackalope-digital-hub/packages/admin-adapter/src/conformance.ts
// Source commit: ca08b44. Do not edit here — sync from source (jackalope-digital-hub).

/**
 * Contract conformance checks. A property's test suite runs these against its
 * adapter to prove ADR 0006 compliance BEFORE the hub is ever pointed at it.
 *
 *   import { conformanceChecks } from "@jackalope/admin-adapter";
 *   import { adapter } from "../lib/admin-adapter";
 *
 *   for (const c of conformanceChecks({ adapter, token: TEST_TOKEN })) {
 *     it(c.name, c.run);
 *   }
 */

import { strict as assert } from 'node:assert';
import type { AdminAdapter } from './adapter';
import type { ActionMeta, ResourceMeta } from './contract';

export interface ConformanceOptions {
  adapter: AdminAdapter;
  /** A token `adapter.config.authenticate` accepts with full capabilities. */
  token: string;
  /** Origin used to build request URLs. */
  origin?: string;
  /** Path prefix. Defaults to the adapter's configured `basePath` (or /api/admin). */
  basePath?: string;
  /** A resource name that exists and has rows, for the list/get checks. */
  sampleResource?: string;
}

export interface Check {
  name: string;
  run: () => Promise<void>;
}

type Row = Record<string, unknown>;
type ListBody = { rows: Row[]; nextCursor?: string; total?: number };

async function body<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export function conformanceChecks(opts: ConformanceOptions): Check[] {
  const origin = opts.origin ?? 'https://property.test';
  const prefix = (
    opts.basePath ??
    opts.adapter.config.basePath ??
    '/api/admin'
  ).replace(/\/$/, '');
  const base = `${origin}${prefix}`;
  const authed = (path: string, init?: RequestInit) =>
    opts.adapter.handle(
      new Request(base + path, {
        ...init,
        headers: { authorization: `Bearer ${opts.token}`, ...init?.headers },
      }),
    );
  const resources = () =>
    authed('/resources').then((r) => body<{ resources: ResourceMeta[] }>(r));

  return [
    {
      name: 'GET /health returns { ok } without auth',
      async run() {
        const res = await opts.adapter.handle(new Request(`${base}/health`));
        assert.equal(res.status, 200);
        const b = await body<{ ok: unknown }>(res);
        assert.equal(typeof b.ok, 'boolean');
      },
    },
    {
      name: 'requests without a valid token get 401',
      async run() {
        const res = await opts.adapter.handle(new Request(`${base}/resources`));
        assert.equal(res.status, 401);
      },
    },
    {
      name: 'GET /resources returns a catalog with field metadata',
      async run() {
        const res = await authed('/resources');
        assert.equal(res.status, 200);
        const b = await body<{ resources: ResourceMeta[] }>(res);
        assert.ok(Array.isArray(b.resources));
        for (const r of b.resources) {
          assert.ok(r.name && r.label && r.readCapability);
          assert.ok(Array.isArray(r.fields));
        }
      },
    },
    {
      name: 'GET /actions returns a catalog with param specs',
      async run() {
        const res = await authed('/actions');
        assert.equal(res.status, 200);
        const b = await body<{ actions: ActionMeta[] }>(res);
        assert.ok(Array.isArray(b.actions));
        for (const a of b.actions) {
          assert.ok(a.name && a.label && a.capability);
          assert.ok(Array.isArray(a.params));
        }
      },
    },
    {
      name: 'GET /resources/:name paginates ({ rows, total? })',
      async run() {
        const cat = await resources();
        const name = opts.sampleResource ?? cat.resources[0]?.name;
        if (!name) return;
        const res = await authed(`/resources/${name}?limit=5`);
        assert.equal(res.status, 200);
        const page = await body<ListBody>(res);
        assert.ok(Array.isArray(page.rows));
      },
    },
    {
      name: 'GET /resources/:name/:id returns a row or 404-null',
      async run() {
        const cat = await resources();
        const meta = opts.sampleResource
          ? cat.resources.find((r) => r.name === opts.sampleResource)
          : cat.resources[0];
        if (!meta) return;
        const page = await body<ListBody>(
          await authed(`/resources/${meta.name}?limit=1`),
        );
        const first = page.rows[0];
        if (!first) return;
        const idField = meta.fields[0]?.name ?? 'id';
        const res = await authed(
          `/resources/${meta.name}/${encodeURIComponent(String(first[idField]))}`,
        );
        assert.ok(res.status === 200 || res.status === 404);
      },
    },
    {
      name: 'GET /audit returns { rows: AuditEvent[] }',
      async run() {
        const res = await authed('/audit');
        assert.equal(res.status, 200);
        const b = await body<{ rows: unknown[] }>(res);
        assert.ok(Array.isArray(b.rows));
      },
    },
    {
      name: 'an unknown route returns 404',
      async run() {
        const res = await authed('/does-not-exist');
        assert.equal(res.status, 404);
      },
    },
    {
      name: 'a mutation writes an audit row (PATCH round-trips into /audit)',
      async run() {
        const cat = await resources();
        const writable = cat.resources.find(
          (r) => r.writeCapability && r.fields.some((f) => f.editable),
        );
        if (!writable) return; // no writable resource — nothing to test
        const page = await body<ListBody>(
          await authed(`/resources/${writable.name}?limit=1`),
        );
        const row = page.rows[0];
        if (!row) return;
        const idField = writable.fields[0]?.name ?? 'id';
        const editField = writable.fields.find((f) => f.editable)?.name;
        if (!editField) return;
        const before = await body<{ rows: unknown[] }>(await authed('/audit'));
        const res = await authed(
          `/resources/${writable.name}/${encodeURIComponent(String(row[idField]))}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ patch: { [editField]: row[editField] } }),
          },
        );
        assert.equal(res.status, 200);
        const after = await body<{ rows: unknown[] }>(await authed('/audit'));
        assert.ok(
          after.rows.length > before.rows.length,
          'expected a new audit row',
        );
      },
    },
  ];
}
