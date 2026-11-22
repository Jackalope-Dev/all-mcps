/**
 * Documentation placeholders: hosts reserved for examples (RFC 2606 / 6761),
 * which READMEs and registry entries copy straight out of a config snippet —
 * `https://mcp.example.com:8443/mcp`, `https://your-server.example.com`,
 * `https://fhir.example.org`. None of them is anyone's real website or a
 * server a client can connect to, so they must never be stored as one.
 *
 * Matches any host with an `example` label (example.com, api.example.org,
 * host.example.cn, lib.example.edu) or one of the reserved-for-testing TLDs.
 * `localhost` is deliberately not here: it is a real host, just not a public
 * one. The endpoint check rejects it separately (`isPrivateOrReservedHost`).
 */

const RESERVED_TLDS = new Set(['example', 'invalid', 'test']);

export function isPlaceholderHost(hostname: string): boolean {
  const labels = hostname.toLowerCase().replace(/\.$/, '').split('.');
  if (labels.length === 0) return false;
  if (RESERVED_TLDS.has(labels[labels.length - 1])) return true;
  return labels.includes('example');
}

/** True for a parseable URL on a placeholder host; false for anything else. */
export function isPlaceholderUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    return isPlaceholderHost(new URL(raw.trim()).hostname);
  } catch {
    return false;
  }
}

/**
 * An address at a reserved domain (`someone@example.com`, `a@b.test`). Nobody
 * receives mail there, so a submission from one is a probe or a throwaway: in
 * Nov 2026 eighteen SSRF/XSS probe listings all came in as `@example.com`, and
 * each one sent a confirmation email that bounced and added a dead Sequenzy
 * subscriber.
 */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  const domain = (email ?? '').trim().split('@')[1];
  return Boolean(domain) && isPlaceholderHost(domain);
}

/** Shown when a submitted URL is a documentation placeholder. */
export const PLACEHOLDER_URL_ERROR =
  'example.com-style addresses are documentation placeholders. Enter the real URL of your server, repository or website.';

/** Shown when a submitter email is at a reserved domain. */
export const PLACEHOLDER_EMAIL_ERROR =
  'Enter an email address you can receive mail at: we send the review result there.';
