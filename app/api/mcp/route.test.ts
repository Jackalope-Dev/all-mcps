import { describe, expect, it, vi } from 'vitest';

// These pull in next-auth, which does not load under Vitest, and none of the
// protocol paths below touch them.
vi.mock('@/lib/claimListing', () => ({ claimListing: vi.fn() }));
vi.mock('@/lib/agentAuth', () => ({
  AGENT_SCOPES: ['listings:claim'],
  getAgentAuthDb: vi.fn(),
  hasAgentScope: vi.fn(),
  resolveAgentAuthFlexible: vi.fn(),
}));
vi.mock('@/lib/agentConfirm', () => ({ confirmAgentRegistration: vi.fn() }));
vi.mock('@/lib/agentRegister', () => ({ registerAgent: vi.fn() }));
vi.mock('@/lib/submitListing', () => ({ submitListing: vi.fn() }));

const { GET, POST } = await import('./route');

const MODERN_META = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1.0.0' },
  'io.modelcontextprotocol/clientCapabilities': {},
};

function rpc(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request('https://allmcps.com/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
  );
}

describe('/api/mcp protocol handling', () => {
  it('negotiates a legacy version at initialize', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', clientInfo: { name: 't' } },
    });
    const body = (await res.json()) as any;
    expect(body.result.protocolVersion).toBe('2025-06-18');
    expect(body.result.resultType).toBeUndefined();

    const unknown = (await (
      await rpc({
        jsonrpc: '2.0',
        id: 2,
        method: 'initialize',
        params: { protocolVersion: '2099-01-01' },
      })
    ).json()) as any;
    expect(unknown.result.protocolVersion).toBe('2025-11-25');
  });

  it('answers server/discover with supported versions', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 'd',
      method: 'server/discover',
      params: { _meta: MODERN_META },
    });
    const body = (await res.json()) as any;
    expect(body.result.resultType).toBe('complete');
    expect(body.result.supportedVersions).toContain('2026-07-28');
    expect(body.result.capabilities.tools).toEqual({});
  });

  it('rejects an unsupported modern version with -32022 and 400', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/list',
      params: {
        _meta: {
          ...MODERN_META,
          'io.modelcontextprotocol/protocolVersion': '1900-01-01',
        },
      },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe(-32022);
    expect(body.error.data.requested).toBe('1900-01-01');
  });

  it('rejects a header that disagrees with the body', async () => {
    const res = await rpc(
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/list',
        params: { _meta: MODERN_META },
      },
      { 'MCP-Protocol-Version': '2025-11-25' },
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error.code).toBe(-32020);
  });

  it('lists tools with resultType for modern clients', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/list',
      params: { _meta: MODERN_META },
    });
    const body = (await res.json()) as any;
    expect(body.result.resultType).toBe('complete');
    const names = body.result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'search_mcp_servers',
        'get_mcp_install_config',
        'get_mcp_alternatives',
        'compare_mcp_servers',
        'recommend_mcp_stack',
      ]),
    );
  });

  it('accepts notifications with 202 and no body', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    expect(res.status).toBe(202);
    expect(await res.text()).toBe('');
  });

  it('returns 404 / -32601 for an unknown method and -32602 for an unknown tool', async () => {
    const method = await rpc({ jsonrpc: '2.0', id: 6, method: 'nope/nope' });
    expect(method.status).toBe(404);
    expect(((await method.json()) as any).error.code).toBe(-32601);

    const tool = await rpc({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'no_such_tool', arguments: {} },
    });
    expect(((await tool.json()) as any).error.code).toBe(-32602);
  });

  it('searches with filters and returns structured results', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: {
        name: 'search_mcp_servers',
        arguments: { query: 'github', limit: 3, transport: 'stdio' },
        _meta: MODERN_META,
      },
    });
    const body = (await res.json()) as any;
    expect(body.result.resultType).toBe('complete');
    expect(Array.isArray(body.result.structuredContent.results)).toBe(true);
    for (const r of body.result.structuredContent.results) {
      expect(r.transport).toBe('stdio');
    }
    // No instructions addressed to the model anywhere in the output.
    expect(JSON.stringify(body)).not.toContain('Note for AI Assistants');
  });

  it('refuses a GET event stream and describes itself otherwise', async () => {
    const stream = await GET(
      new Request('https://allmcps.com/api/mcp', {
        headers: { Accept: 'text/event-stream' },
      }),
    );
    expect(stream.status).toBe(405);
    const info = await GET(new Request('https://allmcps.com/api/mcp'));
    expect(((await info.json()) as any).protocolVersions).toContain(
      '2026-07-28',
    );
  });
});
