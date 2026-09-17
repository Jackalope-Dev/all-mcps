import { isSafeFetchTarget } from './urlSafety';

/**
 * Minimal server-side MCP (Streamable HTTP) client used by the live Protocol
 * Inspector and the health cron. Running the handshake server-side sidesteps
 * browser CORS and keeps SSRF checks (isSafeFetchTarget) in one place.
 *
 * Supports both response shapes a compliant server may return: a single JSON
 * body (application/json) or an SSE stream (text/event-stream).
 */

export type McpTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

const PROTOCOL_VERSION = '2025-06-18';
const CLIENT_INFO = { name: 'AllMCPs Inspector', version: '1.0.0' };
const TIMEOUT_MS = 12000;

export type McpResult = {
  ok: boolean;
  error?: string;
  /**
   * True when the endpoint answered with a spec-compliant 401 + WWW-Authenticate
   * (RFC 9728 protected-resource pattern) rather than failing to respond at all.
   * That's a *healthy*, correctly-configured OAuth-protected MCP server, not a
   * broken one — see the health-cron comment where this is consumed. A generic
   * probe that only checks "did initialize succeed anonymously" can't tell these
   * apart, which is a real, reported failure mode for other MCP directories.
   */
  authRequired?: boolean;
  authResourceMetadataUrl?: string;
  serverInfo?: { name?: string; version?: string };
  tools?: McpTool[];
  result?: unknown;
};

/** Carries the HTTP status/headers a plain Error would otherwise throw away. */
class HttpStatusError extends Error {
  status: number;
  wwwAuthenticate: string | null;
  constructor(status: number, wwwAuthenticate: string | null) {
    super(`HTTP ${status}`);
    this.name = 'HttpStatusError';
    this.status = status;
    this.wwwAuthenticate = wwwAuthenticate;
  }
}

function extractJsonRpc(text: string, contentType: string, id: number): any {
  if (contentType.includes('text/event-stream')) {
    let match: any = null;
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const msg = JSON.parse(payload);
        if (msg && (msg.result !== undefined || msg.error !== undefined)) {
          if (msg.id === id) return msg;
          if (match === null) match = msg;
        }
      } catch {
        /* skip non-JSON frames */
      }
    }
    return match;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function rpc(
  endpoint: string,
  body: object,
  id: number,
  headers: Record<string, string>,
  sessionId?: string,
): Promise<{ msg: any; sessionId?: string }> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': PROTOCOL_VERSION,
    ...headers,
  };
  if (sessionId) h['Mcp-Session-Id'] = sessionId;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: h,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const returnedSession = res.headers.get('mcp-session-id') || sessionId;
  const text = await res.text();

  // Checked before any body parsing — confirmed in practice against a real
  // OAuth-protected server (RFC 9728) that its 401 body is valid JSON but not
  // JSON-RPC-shaped (e.g. {"error":"invalid or missing mcp credentials"}),
  // which would otherwise parse "successfully" via extractJsonRpc below and
  // silently skip the throw, masking a healthy auth-required server as a
  // generic "initialize failed".
  if (res.status === 401) {
    const wwwAuthenticate = res.headers.get('www-authenticate');
    if (wwwAuthenticate) throw new HttpStatusError(401, wwwAuthenticate);
  }

  if (!res.ok && !text) {
    throw new HttpStatusError(res.status, res.headers.get('www-authenticate'));
  }
  const msg = extractJsonRpc(text, res.headers.get('content-type') || '', id);
  if (!msg && !res.ok)
    throw new HttpStatusError(res.status, res.headers.get('www-authenticate'));
  return { msg, sessionId: returnedSession || undefined };
}

/**
 * Connect to a remote MCP endpoint, run the initialize handshake, and invoke
 * `method` (defaults to tools/list). Returns a normalized result.
 */
export async function callMcpEndpoint(
  url: string,
  opts: {
    headers?: Record<string, string>;
    method?: string;
    params?: unknown;
  } = {},
): Promise<McpResult> {
  const targetUrl = url?.trim() || '';
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return { ok: false, error: 'Enter a valid http(s) MCP endpoint URL.' };
  }
  if (!isSafeFetchTarget(targetUrl)) {
    return { ok: false, error: 'That URL is not a permitted public endpoint.' };
  }

  const headers = opts.headers || {};
  const method = opts.method || 'tools/list';

  try {
    // 1. initialize
    let init: Awaited<ReturnType<typeof rpc>>;
    try {
      init = await rpc(
        targetUrl,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: CLIENT_INFO,
          },
        },
        1,
        headers,
      );
    } catch (e) {
      // A spec-compliant 401 here means "real MCP server, OAuth required" —
      // never try to complete the flow ourselves (out of scope for a health
      // probe, and the whole point is not to fake anonymous success: a
      // server that *does* answer initialize without auth to please health
      // checkers breaks real clients the same way, confirmed independently
      // by other MCP server operators — see the health-cron caller).
      if (
        e instanceof HttpStatusError &&
        e.status === 401 &&
        e.wwwAuthenticate
      ) {
        const match = e.wwwAuthenticate.match(/resource_metadata="([^"]+)"/i);
        return {
          ok: true,
          authRequired: true,
          authResourceMetadataUrl: match?.[1],
        };
      }
      throw e;
    }
    if (!init.msg)
      return {
        ok: false,
        error: 'No JSON-RPC response from the endpoint (is it an MCP server?).',
      };
    if (init.msg.error)
      return {
        ok: false,
        error: init.msg.error.message || 'initialize failed',
      };
    const serverInfo = init.msg.result?.serverInfo;
    const session = init.sessionId;

    // 2. notifications/initialized (best-effort; ignore transport hiccups)
    try {
      await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'MCP-Protocol-Version': PROTOCOL_VERSION,
          ...(session ? { 'Mcp-Session-Id': session } : {}),
          ...headers,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      /* non-fatal */
    }

    // 3. target method
    const call = await rpc(
      targetUrl,
      { jsonrpc: '2.0', id: 2, method, params: opts.params ?? {} },
      2,
      headers,
      session,
    );
    if (!call.msg)
      return { ok: false, error: `No response to ${method}.`, serverInfo };
    if (call.msg.error)
      return {
        ok: false,
        error: call.msg.error.message || `${method} failed`,
        serverInfo,
      };

    const tools =
      method === 'tools/list' && Array.isArray(call.msg.result?.tools)
        ? (call.msg.result.tools as any[]).map((t) => ({
            name: String(t.name),
            description: t.description ? String(t.description) : undefined,
            inputSchema: t.inputSchema,
          }))
        : undefined;

    return { ok: true, serverInfo, tools, result: call.msg.result };
  } catch (e: any) {
    const msg =
      e?.name === 'TimeoutError'
        ? 'Connection timed out.'
        : e?.message || 'Connection failed.';
    return { ok: false, error: msg };
  }
}
