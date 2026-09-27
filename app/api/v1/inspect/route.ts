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

const ALLOWED_METHODS = new Set([
  'tools/list',
  'tools/call',
  'resources/list',
  'prompts/list',
]);

function sanitizeHeaders(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const [rawKey, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof v !== 'string') continue;
    const k = rawKey.trim();
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
      continue;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(k)) continue;
    const lowerKey = k.toLowerCase();
    if (
      lowerKey === 'authorization' ||
      lowerKey.startsWith('x-') ||
      lowerKey === 'mcp-session-id'
    ) {
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
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const rawUrl = typeof body?.url === 'string' ? body.url.trim() : '';
  const method = typeof body?.method === 'string' ? body.method : 'tools/list';
  if (!ALLOWED_METHODS.has(method)) {
    return NextResponse.json(
      { ok: false, error: 'Unsupported method.' },
      { status: 400 },
    );
  }
  if (!rawUrl || rawUrl.length > 2048) {
    return NextResponse.json(
      { ok: false, error: 'Invalid or missing URL.' },
      { status: 400 },
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid URL format.' },
      { status: 400 },
    );
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return NextResponse.json(
      { ok: false, error: 'Only http and https URLs are allowed.' },
      { status: 400 },
    );
  }

  const cleanUrl = parsedUrl.href;
  const result = await callMcpEndpoint(cleanUrl, {
    method,
    params: body?.params,
    headers: sanitizeHeaders(body?.headers),
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
