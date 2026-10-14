import { describe, expect, it } from 'vitest';
import {
  checkModernRequest,
  HEADER_MISMATCH,
  modernRequestVersion,
  negotiateLegacyVersion,
  UNSUPPORTED_PROTOCOL_VERSION,
} from './mcpProtocol';

const meta = (v: string) => ({
  _meta: { 'io.modelcontextprotocol/protocolVersion': v },
});

describe('negotiateLegacyVersion', () => {
  it('echoes a legacy version we speak', () => {
    expect(negotiateLegacyVersion('2025-06-18')).toBe('2025-06-18');
    expect(negotiateLegacyVersion('2024-11-05')).toBe('2024-11-05');
  });

  it('answers our newest legacy version otherwise', () => {
    expect(negotiateLegacyVersion('1999-01-01')).toBe('2025-11-25');
    expect(negotiateLegacyVersion(undefined)).toBe('2025-11-25');
  });
});

describe('modernRequestVersion', () => {
  it('reads the per-request _meta version', () => {
    expect(modernRequestVersion(meta('2026-07-28'))).toBe('2026-07-28');
    expect(modernRequestVersion({})).toBeNull();
    expect(modernRequestVersion(undefined)).toBeNull();
  });
});

describe('checkModernRequest', () => {
  const base = { method: 'tools/call', params: { name: 'search_mcp_servers' } };

  it('accepts a supported version with matching or absent headers', () => {
    expect(
      checkModernRequest({
        ...base,
        version: '2026-07-28',
        headers: new Headers({
          'MCP-Protocol-Version': '2026-07-28',
          'Mcp-Method': 'tools/call',
          'Mcp-Name': 'search_mcp_servers',
        }),
      }).ok,
    ).toBe(true);
    expect(
      checkModernRequest({
        ...base,
        version: '2026-07-28',
        headers: new Headers(),
      }).ok,
    ).toBe(true);
  });

  it('rejects headers that disagree with the body', () => {
    const r = checkModernRequest({
      ...base,
      version: '2026-07-28',
      headers: new Headers({ 'Mcp-Name': 'boost_mcp_server' }),
    });
    expect(r).toMatchObject({ ok: false, status: 400, code: HEADER_MISMATCH });
  });

  it('decodes a base64 Mcp-Name before comparing', () => {
    const r = checkModernRequest({
      ...base,
      version: '2026-07-28',
      headers: new Headers({
        'Mcp-Name': `=?base64?${btoa('search_mcp_servers')}?=`,
      }),
    });
    expect(r.ok).toBe(true);
  });

  it('lists supported versions for an unknown one', () => {
    const r = checkModernRequest({
      ...base,
      version: '1900-01-01',
      headers: new Headers(),
    });
    expect(r).toMatchObject({
      ok: false,
      status: 400,
      code: UNSUPPORTED_PROTOCOL_VERSION,
      data: { requested: '1900-01-01' },
    });
    if (!r.ok) expect(r.data?.supported).toContain('2026-07-28');
  });
});
