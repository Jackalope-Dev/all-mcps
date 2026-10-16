/**
 * D1 read replication for anonymous page traffic.
 *
 * D1 runs every query against one primary unless a request opts into a
 * session. Searches spent 3-6s there waiting behind the crons and crawler load
 * while the query itself took 33-84ms, and that same contention reset the
 * database ("exceeded its CPU time limit") several times an hour. A
 * `first-unconstrained` session lets a read-only request start on the nearest
 * replica; writes inside the session still go to the primary, and later reads
 * in the same session see them.
 *
 * Only anonymous GET/HEAD requests get one. Signed-in visitors, the dashboard,
 * auth, billing and crons stay on the primary, so a user never reads an edit
 * they just made from a replica that hasn't caught up yet (there is no
 * bookmark cookie carrying consistency across requests).
 *
 * Until read replication is enabled on the database, a session simply uses
 * the primary, so this is safe to ship first.
 */

/** Paths whose reads must reflect the visitor's own recent writes, or that write. */
const PRIMARY_ONLY_PREFIXES = [
  '/admin',
  '/dashboard',
  '/login',
  '/verify-request',
  '/submit',
  '/api/admin',
  '/api/auth',
  '/api/cron',
  '/api/dashboard',
  '/api/lopebase',
  '/api/stripe',
  '/api/submit',
];

/** Auth.js session cookies (the `__Secure-` form is used over HTTPS). */
const SESSION_COOKIE =
  /(?:^|;\s*)(?:__Secure-)?authjs\.session-token(?:\.\d+)?=/;

function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Whether this request may read from a D1 replica. */
export function canUseReadReplica(request: Request): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const { pathname } = new URL(request.url);
  if (PRIMARY_ONLY_PREFIXES.some((p) => underPrefix(pathname, p))) {
    return false;
  }
  return !SESSION_COOKIE.test(request.headers.get('cookie') ?? '');
}

/**
 * `env` with `DB` swapped for a replica-capable session when the request
 * allows it. Routes reach the binding through getCloudflareContext().env, so
 * swapping it here covers every query without touching call sites.
 */
export function withReadReplicaDb<E extends { DB?: D1Database }>(
  env: E,
  request: Request,
): E {
  const db = env.DB;
  if (!db || typeof db.withSession !== 'function') return env;
  if (!canUseReadReplica(request)) return env;
  // A session exposes prepare/batch, which is all Drizzle's D1 driver and the
  // routes use; it lacks exec/dump/withSession, which nothing here calls.
  return {
    ...env,
    DB: db.withSession('first-unconstrained') as unknown as D1Database,
  };
}
