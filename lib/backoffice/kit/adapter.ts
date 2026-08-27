// Vendored from jackalope-digital-hub/packages/admin-adapter/src/adapter.ts
// Source commit: ca08b44. Do not edit here — sync from source (jackalope-digital-hub).

/**
 * createAdminAdapter — turn declarative resource/action definitions into the
 * full ADR 0006 `/api/admin/*` surface: routing, token auth, capability checks,
 * cursor pagination passthrough, and automatic `admin_audit` writes on every
 * mutation.
 *
 * Framework-agnostic: `adapter.handle(request)` takes a WHATWG `Request` and
 * returns a `Response`. Bindings for Next route handlers / Convex httpAction /
 * Hono are one-liners on top.
 */

import { randomUUID } from 'node:crypto';
import type {
  ActionMeta,
  ActionResult,
  AdapterContext,
  AuditEvent,
  Capability,
  Overview,
  Page,
  ParamSpec,
  Query,
  ResourceMeta,
} from './contract';

export interface AdapterResource<Row = Record<string, unknown>>
  extends ResourceMeta {
  list(query: Query, ctx: AdapterContext): Promise<Page<Row>>;
  get(id: string, ctx: AdapterContext): Promise<Row | null>;
  /** Return the updated row. The adapter reads `get` before + after to build the
   *  audit before/after — you do not write audit yourself. */
  update?(id: string, patch: Partial<Row>, ctx: AdapterContext): Promise<Row>;
}

export interface AdapterAction extends ActionMeta {
  run(
    params: Record<string, unknown>,
    ctx: AdapterContext,
  ): Promise<ActionResult>;
}

export interface AuditStore {
  write(event: AuditEvent): Promise<void>;
  list(query: Query): Promise<Page<AuditEvent>>;
}

export interface AdapterConfig {
  connectorId: string;
  /** Resolve a request to a context, or null to 401. Throw for 500. */
  authenticate(
    req: Request,
  ): Promise<AdapterContext | null> | AdapterContext | null;
  audit: AuditStore;
  resources: AdapterResource[];
  actions?: AdapterAction[];
  overview?(ctx: AdapterContext): Promise<Overview>;
  health?(): Promise<{ ok: boolean; detail?: string }>;
  /** Path prefix to strip before routing. Default "/api/admin". */
  basePath?: string;
}

export interface AdminAdapter {
  handle(req: Request): Promise<Response>;
  /** For debugging / the conformance suite. */
  config: AdapterConfig;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const err = (status: number, message: string) =>
  json({ error: message }, status);

function parseQuery(url: URL): Query {
  const q: Query = {};
  const limit = url.searchParams.get('limit');
  if (limit) q.limit = Number(limit);
  q.cursor = url.searchParams.get('cursor') ?? undefined;
  q.search = url.searchParams.get('search') ?? undefined;
  const sort = url.searchParams.get('sort');
  if (sort) {
    const [field, dir] = sort.split(':');
    q.sort = [{ field, dir: dir === 'desc' ? 'desc' : 'asc' }];
  }
  const filters: Record<string, unknown> = {};
  for (const [k, v] of url.searchParams) {
    if (k.startsWith('filter.')) filters[k.slice(7)] = v;
  }
  if (Object.keys(filters).length) q.filters = filters;
  return q;
}

function has(ctx: AdapterContext, cap: Capability): boolean {
  return ctx.capabilities.includes(cap);
}

function validateParams(
  specs: ParamSpec[],
  params: Record<string, unknown>,
): string | null {
  for (const s of specs) {
    const v = params[s.name];
    if (s.required && (v === undefined || v === null || v === '')) {
      return `missing required param: ${s.name}`;
    }
    if (v !== undefined && s.type === 'number' && typeof v !== 'number') {
      return `param ${s.name} must be a number`;
    }
    if (
      v !== undefined &&
      s.type === 'enum' &&
      s.enumValues &&
      !s.enumValues.includes(String(v))
    ) {
      return `param ${s.name} must be one of ${s.enumValues.join(', ')}`;
    }
  }
  return null;
}

export function createAdminAdapter(config: AdapterConfig): AdminAdapter {
  const basePath = (config.basePath ?? '/api/admin').replace(/\/$/, '');
  const resources = new Map(config.resources.map((r) => [r.name, r]));
  const actions = new Map((config.actions ?? []).map((a) => [a.name, a]));

  const resourceCatalog: ResourceMeta[] = config.resources.map((r) => ({
    name: r.name,
    label: r.label,
    readCapability: r.readCapability,
    writeCapability: r.writeCapability,
    fields: r.fields,
  }));
  const actionCatalog: ActionMeta[] = (config.actions ?? []).map((a) => ({
    name: a.name,
    label: a.label,
    capability: a.capability,
    destructive: a.destructive,
    params: a.params,
  }));

  async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    let path = url.pathname;
    const idx = path.indexOf(basePath);
    if (idx === -1) return err(404, 'not found');
    path = path.slice(idx + basePath.length) || '/';
    const seg = path.split('/').filter(Boolean);

    // /health is unauthenticated (probe only, no data).
    if (seg[0] === 'health' && req.method === 'GET') {
      const h = config.health ? await config.health() : { ok: true };
      return json(h);
    }

    let ctx: AdapterContext | null;
    try {
      ctx = await config.authenticate(req);
    } catch (e) {
      return err(500, e instanceof Error ? e.message : 'auth error');
    }
    if (!ctx) return err(401, 'unauthorized');

    try {
      // GET /overview
      if (seg[0] === 'overview' && req.method === 'GET') {
        if (!config.overview) return json({ attentionItems: [], stats: {} });
        return json(await config.overview(ctx));
      }

      // GET /resources
      if (seg[0] === 'resources' && seg.length === 1 && req.method === 'GET') {
        return json({ resources: resourceCatalog });
      }

      // /resources/:name ...
      if (seg[0] === 'resources' && seg[1]) {
        const resource = resources.get(seg[1]);
        if (!resource) return err(404, `unknown resource: ${seg[1]}`);
        if (!has(ctx, resource.readCapability))
          return err(403, `need ${resource.readCapability}`);

        // GET /resources/:name
        if (seg.length === 2 && req.method === 'GET') {
          const page = await resource.list(parseQuery(url), ctx);
          return json(page);
        }

        const id = seg[2] ? decodeURIComponent(seg[2]) : undefined;

        // GET /resources/:name/:id
        if (id && seg.length === 3 && req.method === 'GET') {
          const row = await resource.get(id, ctx);
          return row ? json(row) : json(null, 404);
        }

        // PATCH /resources/:name/:id
        if (id && seg.length === 3 && req.method === 'PATCH') {
          if (
            !resource.writeCapability ||
            !has(ctx, resource.writeCapability)
          ) {
            return err(
              403,
              `need ${resource.writeCapability ?? 'write capability'}`,
            );
          }
          if (!resource.update)
            return err(405, `${resource.name} is read-only`);
          const body = (await req.json().catch(() => ({}))) as {
            patch?: Record<string, unknown>;
          };
          const patch = body.patch ?? {};
          // Snapshot before mutating — a resource impl may return a live
          // reference that `update` then mutates in place.
          const beforeRaw = await resource.get(id, ctx);
          const before =
            beforeRaw == null ? beforeRaw : structuredClone(beforeRaw);
          const after = await resource.update(id, patch, ctx);
          await writeAudit(ctx, {
            action: `update_${resource.name}`,
            targetType: resource.name,
            targetId: id,
            before,
            after,
          });
          return json(after);
        }
      }

      // GET /actions
      if (seg[0] === 'actions' && seg.length === 1 && req.method === 'GET') {
        return json({ actions: actionCatalog });
      }

      // POST /actions/:name
      if (seg[0] === 'actions' && seg[1] && req.method === 'POST') {
        const action = actions.get(seg[1]);
        if (!action) return err(404, `unknown action: ${seg[1]}`);
        if (!has(ctx, action.capability))
          return err(403, `need ${action.capability}`);
        const body = (await req.json().catch(() => ({}))) as {
          params?: Record<string, unknown>;
        };
        const params = body.params ?? {};
        const invalid = validateParams(action.params, params);
        if (invalid) return err(400, invalid);

        const result = await action.run(params, ctx);
        await writeAudit(ctx, {
          action: result.audit.action ?? action.name,
          targetType: result.audit.targetType,
          targetId: result.audit.targetId,
          before: result.audit.before,
          after: result.audit.after,
        });
        return json(result);
      }

      // GET /audit
      if (seg[0] === 'audit' && req.method === 'GET') {
        if (!has(ctx, 'system.read')) return err(403, 'need system.read');
        return json(await config.audit.list(parseQuery(url)));
      }

      return err(404, `no route: ${req.method} ${path}`);
    } catch (e) {
      return err(500, e instanceof Error ? e.message : 'adapter error');
    }
  }

  async function writeAudit(
    ctx: AdapterContext,
    partial: Pick<AuditEvent, 'action' | 'targetType' | 'targetId'> &
      Partial<Pick<AuditEvent, 'before' | 'after'>>,
  ): Promise<void> {
    const event: AuditEvent = {
      id: randomUUID(),
      connectorId: config.connectorId,
      actorId: ctx.actorId,
      requestId: ctx.requestId,
      createdAt: new Date().toISOString(),
      before: undefined,
      after: undefined,
      ...partial,
    };
    await config.audit.write(event);
  }

  return { handle, config };
}

/** Convenience: a bearer-token authenticator with a fixed capability set. */
export function bearerAuth(opts: {
  token: string;
  capabilities: Capability[];
}): AdapterConfig['authenticate'] {
  return (req: Request) => {
    const header = req.headers.get('authorization') ?? '';
    const got = header.replace(/^Bearer\s+/i, '');
    if (!opts.token || got !== opts.token) return null;
    return {
      actorId: req.headers.get('x-actor-id') ?? 'backoffice',
      requestId: req.headers.get('x-request-id') ?? randomUUID(),
      capabilities: opts.capabilities,
    };
  };
}
