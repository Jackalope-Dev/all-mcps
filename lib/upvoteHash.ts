/**
 * Client-IP based dedup for engagement metrics (upvotes, views) — not tied to
 * any account or cookie.
 */

export function getClientIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();

  return '127.0.0.1';
}

/**
 * One-way, salted hash of (ip, serverId). Returns null if the server-only
 * pepper isn't configured, so callers can fail closed instead of silently
 * hashing without a secret.
 *
 * Used for both upvote and view uniqueness tables (separate storage, same hash).
 */
export async function hashVisitorForServer(
  ip: string,
  serverId: string,
): Promise<string | null> {
  const pepper = process.env.UPVOTE_HASH_SECRET;
  if (!pepper) return null;

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${ip}:${serverId}:${pepper}`),
  );

  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** @deprecated Prefer hashVisitorForServer — same implementation. */
export async function hashUpvoteVoter(
  ip: string,
  serverId: string,
): Promise<string | null> {
  return hashVisitorForServer(ip, serverId);
}
