import { timingSafeEqual } from 'crypto';

/**
 * Verifies the request's `Authorization: Bearer <secret>` header against
 * ADMIN_SECRET. Fails closed: if the secret isn't configured, every request
 * is rejected rather than falling back to a default value.
 */
export function isAdminAuthorized(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;

  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
