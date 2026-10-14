import { describe, expect, it, vi } from 'vitest';

// Same next-auth-loading modules as route.test.ts.
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

const LISTINGS: Record<string, Record<string, unknown>> = {
  live: { id: 'live', name: 'Live', status: 'active', category: 'Files' },
  live2: { id: 'live2', name: 'Live 2', status: 'active', category: 'Files' },
  pending: { id: 'pending', name: 'Pending', status: 'pending' },
  flagged: {
    id: 'flagged',
    name: 'Flagged',
    status: 'active',
    staleFlaggedAt: new Date(),
  },
};

vi.mock('@/lib/servers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/servers')>()),
  getServerById: async (id: string) => LISTINGS[id],
  getRelatedServers: async () => [],
}));

const { POST } = await import('./route');

async function call(name: string, args: unknown) {
  const res = await POST(
    new Request('https://allmcps.com/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    }),
  );
  return (await res.json()) as any;
}

describe('MCP tools never expose listings outside the directory', () => {
  it('compare_mcp_servers reports pending and flagged ids as not found', async () => {
    const body = await call('compare_mcp_servers', {
      ids: ['live', 'pending', 'flagged'],
    });
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain('pending, flagged');
  });

  it('get_mcp_alternatives refuses a non-servable id', async () => {
    const body = await call('get_mcp_alternatives', { id: 'flagged' });
    expect(body.result.isError).toBe(true);
    const ok = await call('get_mcp_alternatives', { id: 'live' });
    expect(ok.result.isError).toBeFalsy();
  });
});
