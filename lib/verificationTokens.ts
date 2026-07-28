/** Deterministic site-verification token for DNS TXT / meta tags. */
export function getSiteVerificationToken(serverId: string): string {
  return `allmcps-site-verification=${serverId}`;
}

/** DNS TXT value owners should publish. */
export function getDnsTxtRecordValue(serverId: string): string {
  return getSiteVerificationToken(serverId);
}
