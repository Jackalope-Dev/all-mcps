/**
 * Per-user claim verification token — proves the *currently signed-in account*
 * controls the site, not just that someone, at some point, controlled it. This
 * is what's checked by the DNS/meta-tag claim flow (never satisfied by a stale
 * or another account's token, which matters since ownership can transfer to
 * whoever next proves control).
 */
export function getClaimVerificationToken(serverId: string, userId: string): string {
  return `allmcps-site-verification=${serverId}:${userId}`;
}
