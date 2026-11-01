/**
 * Documentation placeholders: hosts reserved for examples (RFC 2606 / 6761),
 * which READMEs and registry entries copy straight out of a config snippet —
 * `https://mcp.example.com:8443/mcp`, `https://your-server.example.com`,
 * `https://fhir.example.org`. None of them is anyone's real website or a
 * server a client can connect to, so they must never be stored as one.
 *
 * Matches any host with an `example` label (example.com, api.example.org,
 * host.example.cn, lib.example.edu) or one of the reserved-for-testing TLDs.
 * `localhost` is deliberately not here: a self-hosted server's README config
 * really is `http://localhost:8000/mcp`, and that is a separate question.
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
