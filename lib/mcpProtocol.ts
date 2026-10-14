/**
 * MCP protocol-version handling for the AllMCPs remote server (app/api/mcp).
 *
 * The server is dual-era (spec 2026-07-28, basic/versioning):
 *   - modern requests carry `_meta["io.modelcontextprotocol/protocolVersion"]`
 *     on every call and are served statelessly;
 *   - legacy clients open with `initialize` and negotiate one of the
 *     handshake-based revisions (2025-11-25 and earlier).
 * Nothing here keeps state, so both eras share one endpoint.
 */

const MODERN_PROTOCOL_VERSIONS = ['2026-07-28'] as const;
const LEGACY_PROTOCOL_VERSIONS = [
  '2025-11-25',
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
] as const;
export const SUPPORTED_PROTOCOL_VERSIONS: readonly string[] = [
  ...MODERN_PROTOCOL_VERSIONS,
  ...LEGACY_PROTOCOL_VERSIONS,
];

const META_VERSION_KEY = 'io.modelcontextprotocol/protocolVersion';

/** JSON-RPC error codes the spec reserves for protocol errors. */
export const HEADER_MISMATCH = -32020;
export const UNSUPPORTED_PROTOCOL_VERSION = -32022;

/**
 * The version a legacy `initialize` should answer with: the client's own when
 * we speak it, otherwise our newest legacy revision (the handshake rule —
 * the client then decides whether it can continue).
 */
export function negotiateLegacyVersion(requested: unknown): string {
  return typeof requested === 'string' &&
    (LEGACY_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : LEGACY_PROTOCOL_VERSIONS[0];
}

/** The per-request version a modern client declared, or null for a legacy request. */
export function modernRequestVersion(params: unknown): string | null {
  const meta = (params as { _meta?: Record<string, unknown> } | null)?._meta;
  const v = meta?.[META_VERSION_KEY];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Decode the `=?base64?…?=` sentinel the spec allows in Mcp-Name. */
function decodeHeaderValue(raw: string): string {
  const m = /^=\?base64\?(.*)\?=$/.exec(raw);
  if (!m) return raw;
  try {
    return new TextDecoder().decode(
      Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)),
    );
  } catch {
    return raw;
  }
}

export type ProtocolCheck =
  | { ok: true }
  | {
      ok: false;
      status: number;
      code: number;
      message: string;
      data?: Record<string, unknown>;
    };

/**
 * Validate a modern request: mirrored headers must match the body, and the
 * declared version must be one we serve. Mirrored headers that are absent are
 * tolerated rather than rejected, so thin proxies that forward only the body
 * keep working; a header that is present and disagrees is always rejected,
 * which is the case the rule exists for (an intermediary routing on a value
 * the server would not execute).
 */
export function checkModernRequest(input: {
  version: string;
  method: string;
  params: unknown;
  headers: Headers;
}): ProtocolCheck {
  const { version, method, params, headers } = input;
  const mismatch = (message: string): ProtocolCheck => ({
    ok: false,
    status: 400,
    code: HEADER_MISMATCH,
    message: `Header mismatch: ${message}`,
  });

  const headerVersion = headers.get('mcp-protocol-version');
  if (headerVersion && headerVersion.trim() !== version) {
    return mismatch(
      `MCP-Protocol-Version header '${headerVersion}' does not match body value '${version}'`,
    );
  }
  const headerMethod = headers.get('mcp-method');
  if (headerMethod && headerMethod.trim() !== method) {
    return mismatch(
      `Mcp-Method header '${headerMethod}' does not match body value '${method}'`,
    );
  }
  const headerName = headers.get('mcp-name');
  const p = params as { name?: unknown; uri?: unknown } | null;
  const bodyName =
    typeof p?.name === 'string'
      ? p.name
      : typeof p?.uri === 'string'
        ? p.uri
        : null;
  if (headerName && bodyName !== null) {
    const decoded = decodeHeaderValue(headerName.trim());
    if (decoded !== bodyName) {
      return mismatch(
        `Mcp-Name header value '${decoded}' does not match body value '${bodyName}'`,
      );
    }
  }

  if (!SUPPORTED_PROTOCOL_VERSIONS.includes(version)) {
    return {
      ok: false,
      status: 400,
      code: UNSUPPORTED_PROTOCOL_VERSION,
      message: 'Unsupported protocol version',
      data: { supported: [...SUPPORTED_PROTOCOL_VERSIONS], requested: version },
    };
  }
  return { ok: true };
}
