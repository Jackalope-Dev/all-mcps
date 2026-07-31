import { NextResponse } from 'next/server';
import { callMcpEndpoint } from '@/lib/mcpIntrospect';

/**
 * Live MCP inspector proxy. The browser POSTs a remote MCP endpoint URL (plus
 * optional auth headers and a method) and we run the JSON-RPC handshake
 * server-side — no CORS, and SSRF checks stay centralized in callMcpEndpoint.
 *
 * Body: { url, method?, params?, headers? }
 *   - method defaults to "tools/list"; "tools/call" (with params) is allowed.
 *   - headers is an allow-listed bag (Authorization + X-*) so callers can reach
 *     authenticated servers without us proxying arbitrary hop-by-hop headers.
 */

const ALLOWED_METHODS = new Set(['tools/list', 'tools/call', 'resources/list', 'prompts/list']);

function sanitizeHeaders(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== 'object') return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof v !== 'string') continue;
    const key = k.toLowerCase();
    if (key === 'authorization' || key.startsWith('x-') || key === 'mcp-session-id') {
      out[k] = v.slice(0, 4096);
    }
  }
  return out;
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  const method = typeof body?.method === 'string' ? body.method : 'tools/list';
  if (!ALLOWED_METHODS.has(method)) {
    return NextResponse.json({ ok: false, error: 'Unsupported method.' }, { status: 400 });
  }
  if (url.length > 2048) {
    return NextResponse.json({ ok: false, error: 'URL too long.' }, { status: 400 });
  }

  const result = await callMcpEndpoint(url, {
    method,
    params: body?.params,
    headers: sanitizeHeaders(body?.headers),
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
