/**
 * The listing URL an embedded AllMCPs badge links to. For a signed-in viewer it
 * carries `?verify=<userId>`, so the badge they copy from any generator also
 * proves README ownership in the GitHub claim flow (readmeClaimBadgeStatus
 * requires that token). Signed-out viewers get the plain listing link, which
 * still earns reciprocal-backlink credit but can't claim anything.
 */
export function badgeTargetUrl(
  baseUrl: string,
  serverId: string,
  userId?: string | null,
): string {
  const target = `${baseUrl}/mcp/${serverId}`;
  return userId ? `${target}?verify=${userId}` : target;
}
