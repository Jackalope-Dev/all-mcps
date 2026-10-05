import { vi } from 'vitest';

// The signed-in-admin fallback would pull in NextAuth and a D1 binding. Stub it
// (counting calls) so these assertions cover the secret path, the one a
// machine actually uses, and can check the session is only a fallback.
const admin = vi.hoisted(() => ({ calls: 0, email: null as string | null }));
vi.mock('./adminAuth', () => ({
  getAuthorizedAdminEmail: async () => {
    admin.calls++;
    return admin.email;
  },
}));

const { isCronAuthorized } = await import('./cronAuth');

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('Testing cron authorization...');

const SECRET = 'test-cron-secret-value';
process.env.CRON_SECRET = SECRET;
process.env.ADMIN_SECRET = '';

const withHeaders = (headers: Record<string, string>) =>
  new Request('https://allmcps.com/api/cron/health', { headers });

// 1. The scheduler's bearer token is accepted, bare or prefixed.
assert(
  await isCronAuthorized(withHeaders({ authorization: `Bearer ${SECRET}` })),
  'Bearer <secret> should authorize a cron request',
);
assert(
  await isCronAuthorized(withHeaders({ authorization: SECRET })),
  'A bare secret should authorize a cron request',
);
assert(
  await isCronAuthorized(withHeaders({ 'x-cron-secret': SECRET })),
  'x-cron-secret should authorize a cron request',
);

// 2. Anything else is rejected.
assert(
  !(await isCronAuthorized(withHeaders({ authorization: 'Bearer wrong' }))),
  'A wrong secret must be rejected',
);
assert(
  !(await isCronAuthorized(withHeaders({}))),
  'A request with no credential must be rejected',
);
assert(!(await isCronAuthorized()), 'No request at all must be rejected');

// 3. A prefix of the real secret must not pass — guards against a comparison
//    that stops at the shorter string's length.
assert(
  !(await isCronAuthorized(
    withHeaders({ authorization: SECRET.slice(0, -1) }),
  )),
  'A truncated secret must be rejected',
);

// 4. With no secret configured, the secret path fails closed rather than
//    letting every caller through.
process.env.CRON_SECRET = '';
assert(
  !(await isCronAuthorized(withHeaders({ authorization: 'Bearer anything' }))),
  'An unset cron secret must not authorize anything',
);

// 5. ADMIN_SECRET stays accepted while the deployed Worker still sends it.
process.env.ADMIN_SECRET = SECRET;
assert(
  await isCronAuthorized(withHeaders({ authorization: `Bearer ${SECRET}` })),
  'ADMIN_SECRET should still authorize during the migration',
);

// 6. The migration case that matters: the two secrets hold *different* values
//    at once, and callers are cut over one at a time. Both must be accepted —
//    preferring one would 401 every caller still sending the other, which for
//    the every-15-minute jobs means silent cron failure.
const OLD_SECRET = 'previous-admin-secret-value';
const NEW_SECRET = 'rotated-cron-secret-value';
process.env.CRON_SECRET = NEW_SECRET;
process.env.ADMIN_SECRET = OLD_SECRET;
assert(
  await isCronAuthorized(
    withHeaders({ authorization: `Bearer ${NEW_SECRET}` }),
  ),
  'A caller already sending CRON_SECRET must be authorized',
);
assert(
  await isCronAuthorized(
    withHeaders({ authorization: `Bearer ${OLD_SECRET}` }),
  ),
  'A caller still sending ADMIN_SECRET must be authorized',
);
assert(
  !(await isCronAuthorized(withHeaders({ authorization: 'Bearer neither' }))),
  'A value matching neither secret must still be rejected',
);

// 7. A valid secret never touches the session lookup. The jobs Worker runs these
//    routes without AUTH_SECRET, where initializing Auth.js throws.
admin.calls = 0;
assert(
  await isCronAuthorized(
    withHeaders({ authorization: `Bearer ${NEW_SECRET}` }),
  ),
  'A valid secret must authorize',
);
assert(admin.calls === 0, 'A valid secret must not trigger a session lookup');

// 8. A signed-in admin with no secret (the /admin "run job now" path) still
//    passes, via the fallback.
admin.email = 'admin@example.com';
assert(
  await isCronAuthorized(withHeaders({})),
  'A signed-in admin must be authorized without a secret',
);
admin.email = null;

console.log('All cron authorization tests passed.');
