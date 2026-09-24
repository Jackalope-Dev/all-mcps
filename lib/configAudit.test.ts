import { describe, expect, it } from 'vitest';
import { auditMcpConfig } from './configAudit';

const server = { command: 'npx', args: ['-y', 'some-server'] };

describe('auditMcpConfig format detection', () => {
  it('detects Claude/Cursor mcpServers', () => {
    const r = auditMcpConfig(JSON.stringify({ mcpServers: { a: server } }));
    expect(r.formatDetected).toBe('claude');
    expect(r.serverCount).toBe(1);
  });

  it('detects the current Zed context_servers object', () => {
    const r = auditMcpConfig(
      JSON.stringify({ context_servers: { a: server } }),
    );
    expect(r.formatDetected).toBe('zed');
    expect(r.serverCount).toBe(1);
  });

  it('detects VS Code servers', () => {
    const r = auditMcpConfig(
      JSON.stringify({ servers: { a: server, b: server } }),
    );
    expect(r.formatDetected).toBe('vs-code');
    expect(r.serverCount).toBe(2);
  });

  it('flags unreplaced placeholders', () => {
    const r = auditMcpConfig(
      JSON.stringify({
        mcpServers: { a: { ...server, env: { KEY: '<YOUR_API_KEY>' } } },
      }),
    );
    expect(r.issues.some((i) => /placeholder/.test(i.message))).toBe(true);
  });
});
