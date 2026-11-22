/**
 * Clients the Worker refuses before any page, API or Next.js code runs.
 * The site has no Cloudflare WAF rules managed from this repo, so this is the
 * one place to shut out a specific abusive client. Keep it short: each entry
 * says who it is and why. Per-submitter blocks (email, domain, IP hash) live
 * in D1 (lib/submitterBlocks.ts) and only guard the intake routes.
 */

/** Raw client IPs (cf-connecting-ip). */
const BLOCKED_IPS = new Set<string>([
  // Nov 22 2026: ANTBOX NETWORKS (AS138995, Los Angeles) host scraping the
  // whole catalog through /api/v1 as "allmcps-catalog-audit/1.0" + aiohttp,
  // ~160 requests a minute, during the probe run that tested SSRF, XSS and a
  // claim-verification bypass. Not ours.
  '192.238.226.25',
]);

/** User agents (matched from the start, case-insensitive). */
const BLOCKED_USER_AGENTS: RegExp[] = [/^allmcps-catalog-audit\//i];

export function isBlockedClient(request: Request): boolean {
  const ip = request.headers.get('cf-connecting-ip');
  if (ip && BLOCKED_IPS.has(ip)) return true;
  const ua = request.headers.get('user-agent') ?? '';
  return BLOCKED_USER_AGENTS.some((re) => re.test(ua));
}

export function blockedResponse(): Response {
  return new Response('Forbidden', {
    status: 403,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
