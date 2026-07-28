/**
 * Client-IP based dedup for the upvote metric — not tied to any account or
 * cookie. See docs/superpowers/specs/2026-07-27-upvote-dedup-design.md.
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
 */
export async function hashUpvoteVoter(ip: string, serverId: string): Promise<string | null> {
  const pepper = process.env.UPVOTE_HASH_SECRET;
  if (!pepper) return null;

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${ip}:${serverId}:${pepper}`)
  );

  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
