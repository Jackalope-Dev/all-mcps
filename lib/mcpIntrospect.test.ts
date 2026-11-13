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
    expect(r).toEqual({
      ok: false,
      error: 'Bad protocol version',
      httpStatus: 400,
    });
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

describe('callMcpEndpoint block signals for the health-cron backoff', () => {
  it('reports the status and Retry-After of a rate-limited answer', async () => {
    respondWith(
      () =>
        new Response('Too many requests', {
          status: 429,
          headers: { 'retry-after': '3600' },
        }),
    );
    const r = await callMcpEndpoint(URL);
    expect(r).toMatchObject({
      ok: false,
      httpStatus: 429,
      retryAfterSeconds: 3600,
    });
  });

  it('keeps the ban text and status of a JSON-RPC error answer', async () => {
    respondWith(
      () =>
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            error: {
              code: -32003,
              message:
                'Agent identification and administrator verification are required. 0 further unauthorized attempts remain before an automatic ban.',
            },
          }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        ),
    );
    const r = await callMcpEndpoint(URL);
    expect(r.ok).toBe(false);
    expect(r.httpStatus).toBe(401);
    expect(r.error).toContain('attempts remain');
  });

  it('identifies itself with the AllMCPs health-check User-Agent', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(null, { status: 503 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await callMcpEndpoint(URL);
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<
      string,
      string
    >;
    expect(headers['User-Agent']).toBe(
      'AllMCPs-HealthCheck/1.0 (+https://allmcps.com/contact)',
    );
  });
});
