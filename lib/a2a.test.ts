import { describe, expect, it, vi } from 'vitest';
import {
  buildAgentCard,
  handleA2aRequest,
  messageToToolCall,
  negotiateVersion,
} from './a2a';

const TOOLS = [
  { name: 'search_mcp_servers', description: 'Search the directory.' },
  { name: 'get_boost_pricing', description: 'Boost prices.' },
];
const SKILLS = new Set(TOOLS.map((t) => t.name));

const rpc = (method: string, params: unknown = {}) => ({
  jsonrpc: '2.0',
  id: 7,
  method,
  params,
});

function fakeTool() {
  return vi.fn(async (name: string, args: Record<string, unknown>) => ({
    result: {
      content: [{ type: 'text', text: `ran ${name}` }],
      structuredContent: { args },
    },
  }));
}

describe('buildAgentCard', () => {
  it('has every field A2A 1.0 requires, one skill per MCP tool', () => {
    const card = buildAgentCard(TOOLS);
    for (const k of [
      'name',
      'description',
      'supportedInterfaces',
      'version',
      'capabilities',
      'defaultInputModes',
      'defaultOutputModes',
      'skills',
    ]) {
      expect(card).toHaveProperty(k);
    }
    expect(card.supportedInterfaces[0]).toEqual({
      url: 'https://allmcps.com/api/a2a',
      protocolBinding: 'JSONRPC',
      protocolVersion: '1.0',
    });
    expect(card.skills.map((s) => s.id)).toEqual([...SKILLS]);
    expect(card.skills[0]).toMatchObject({
      name: 'Search MCP servers',
      tags: ['discovery', 'mcp'],
    });
  });
});

describe('negotiateVersion', () => {
  it('treats an empty header as 0.3, per spec', () => {
    expect(negotiateVersion(null, 'message/send')).toBe('0.3');
    expect(negotiateVersion('1.0', 'SendMessage')).toBe('1.0');
    expect(negotiateVersion('0.3.0', 'message/send')).toBe('0.3');
    expect(negotiateVersion('2.0', 'SendMessage')).toBeNull();
  });
});

describe('messageToToolCall', () => {
  it('reads a skill from a 1.0 or 0.3 data part', () => {
    expect(
      messageToToolCall({
        parts: [{ data: { skill: 'get_boost_pricing', arguments: {} } }],
      }),
    ).toEqual({ name: 'get_boost_pricing', args: {} });
    expect(
      messageToToolCall({
        parts: [
          {
            kind: 'data',
            data: { skill: 'search_mcp_servers', query: 'git' },
          },
        ],
      }),
    ).toEqual({ name: 'search_mcp_servers', args: { query: 'git' } });
  });

  it('turns plain text into a search', () => {
    expect(messageToToolCall({ parts: [{ text: 'postgres' }] })).toEqual({
      name: 'search_mcp_servers',
      args: { query: 'postgres' },
    });
    expect(messageToToolCall({ parts: [] })).toHaveProperty('error');
  });
});

describe('handleA2aRequest', () => {
  it('answers 1.0 SendMessage with a ROLE_AGENT message', async () => {
    const tool = fakeTool();
    const res = await handleA2aRequest(
      rpc('SendMessage', {
        message: {
          messageId: 'm1',
          role: 'ROLE_USER',
          contextId: 'ctx-acme',
          parts: [{ data: { skill: 'get_boost_pricing', arguments: {} } }],
        },
      }),
      '1.0',
      tool,
      SKILLS,
    );
    expect(tool).toHaveBeenCalledWith('get_boost_pricing', {});
    expect(res).toMatchObject({
      jsonrpc: '2.0',
      id: 7,
      result: {
        message: {
          role: 'ROLE_AGENT',
          contextId: 'ctx-acme',
          parts: [{ text: 'ran get_boost_pricing' }, { data: { args: {} } }],
        },
      },
    });
  });

  it('answers 0.3 message/send with a kind:"message" result', async () => {
    const res = await handleA2aRequest(
      rpc('message/send', {
        message: {
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: 'slack' }],
        },
      }),
      null,
      fakeTool(),
      SKILLS,
    );
    expect(res).toMatchObject({
      result: {
        kind: 'message',
        role: 'agent',
        parts: [
          { kind: 'text', text: 'ran search_mcp_servers' },
          { kind: 'data' },
        ],
      },
    });
  });

  it('uses A2A error codes for what it does not do', async () => {
    const call = (m: string, v = '1.0') =>
      handleA2aRequest(rpc(m, { id: 't1' }), v, fakeTool(), SKILLS);
    expect(await call('GetTask')).toMatchObject({ error: { code: -32001 } });
    expect(await call('SendStreamingMessage')).toMatchObject({
      error: { code: -32004 },
    });
    expect(await call('GetExtendedAgentCard')).toMatchObject({
      error: { code: -32007 },
    });
    expect(await call('Nope')).toMatchObject({ error: { code: -32601 } });
    expect(await call('SendMessage', '9.9')).toMatchObject({
      error: { code: -32009 },
    });
  });

  it('rejects an unknown skill without calling anything', async () => {
    const tool = fakeTool();
    const res = await handleA2aRequest(
      rpc('SendMessage', {
        message: { parts: [{ data: { skill: 'rm_rf' } }] },
      }),
      '1.0',
      tool,
      SKILLS,
    );
    expect(res).toMatchObject({ error: { code: -32602 } });
    expect(tool).not.toHaveBeenCalled();
  });
});
