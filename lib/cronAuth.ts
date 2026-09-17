import { getAuthorizedAdminEmail } from './adminAuth';

/**
 * Authorization for `/api/cron/*` only — deliberately separate from
 * `lib/adminAuth.ts`.
 *
 * The cron secret is a machine credential for the scheduler calling the app's
 * own jobs (see custom-worker.ts), not a way to become an admin: it must never
 * gate `/api/admin/*`, where the `role` column on `users` is the sole arbiter.
 * Keeping the two in separate modules is what stops a future route from
 * reaching for the wrong one.
 *
 * A signed-in admin is also accepted so the manual "run job now" trigger in
 * /admin works from a browser session.
 */

/** Constant-time compare so a wrong secret can't be narrowed down by timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Every secret a caller may legitimately present.
 *
 * `CRON_SECRET` is the intended name. `ADMIN_SECRET` is accepted *alongside*
 * it, not as a fallback for it — during the migration the two hold different
 * values, and callers are updated one at a time, so preferring one would 401
 * everything still sending the other. Drop `ADMIN_SECRET` here once nothing
 * sends it.
 */
function getAcceptedCronSecrets(): string[] {
  return [process.env.CRON_SECRET, process.env.ADMIN_SECRET].filter(
    (s): s is string => typeof s === 'string' && s.length > 0,
  );
}

/** True for the scheduler presenting the cron secret, or a signed-in admin. */
export async function isCronAuthorized(request?: Request): Promise<boolean> {
  if (await getAuthorizedAdminEmail()) return true;
  if (!request) return false;

  const secrets = getAcceptedCronSecrets();
  if (secrets.length === 0) return false;

  const presented =
    request.headers.get('authorization') ||
    request.headers.get('x-cron-secret');
  if (!presented) return false;

  // Every candidate is checked rather than returning on the first match, so
  // the time taken doesn't reveal which secret (if any) was the near miss.
  let matched = false;
  for (const secret of secrets) {
    if (
      timingSafeEqual(presented, secret) ||
      timingSafeEqual(presented, `Bearer ${secret}`)
    ) {
      matched = true;
    }
  }
  return matched;
}
