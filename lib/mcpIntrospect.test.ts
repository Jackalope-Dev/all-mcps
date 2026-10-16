import { afterEach, describe, expect, it, vi } from 'vitest';
import { callMcpEndpoint } from './mcpIntrospect';

const URL = 'https://mcp.example.com/mcp';

function respondWith(res: () => Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => res()),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('callMcpEndpoint error reporting', () => {
  it('treats a 401 with WWW-Authenticate as a healthy OAuth server', async () => {
    respondWith(
      () =>
        new Response(null, {
          status: 401,
          headers: {
            'www-authenticate':
              'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"',
          },
        }),
    );
    const r = await callMcpEndpoint(URL);
    expect(r).toMatchObject({ ok: true, authRequired: true });
  });

  it('reports status and body for a non-JSON-RPC error body', async () => {
    respondWith(
      () =>
        new Response(JSON.stringify({ error: 'blocked by policy' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const r = await callMcpEndpoint(URL);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('HTTP 403: {"error":"blocked by policy"}');
  });

  it('keeps a real JSON-RPC error message on a non-2xx status', async () => {
    respondWith(
      () =>
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            error: { code: -32600, message: 'Bad protocol version' },
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
    );
    const r = await callMcpEndpoint(URL);
    expect(r).toEqual({ ok: false, error: 'Bad protocol version' });
  });

  it('includes status and raw error when a JSON-RPC error has no message', async () => {
    respondWith(
      () =>
        new Response(
          JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32001 } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    const r = await callMcpEndpoint(URL);
    expect(r).toEqual({
      ok: false,
      error: 'initialize failed (HTTP 200, error {"code":-32001})',
    });
  });

  it('uses a bare string error from a 2xx body', async () => {
    respondWith(
      () =>
        new Response(JSON.stringify({ error: 'quota exceeded' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const r = await callMcpEndpoint(URL);
    expect(r).toEqual({ ok: false, error: 'quota exceeded' });
  });
});
