import { describe, expect, it } from 'vitest';
import {
  buildClientConfigs,
  CLIENT_CONFIG_SLUGS,
  type ClientConfigEnv,
  serverConfigKey,
  shellQuote,
} from './clientConfigs';
import { MCP_CLIENTS } from './clients';
import type { ResolvedInstall } from './installConfig';

const stdio: ResolvedInstall = {
  kind: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  packageName: '@modelcontextprotocol/server-github',
  confidence: 'high',
  source: 'cached',
};
const remote: ResolvedInstall = {
  kind: 'remote',
  url: 'https://mcp.example.com/mcp',
  confidence: 'high',
  source: 'cached',
};

function byClient(
  install: ResolvedInstall,
  env: ClientConfigEnv = [{ key: 'GITHUB_TOKEN' }],
) {
  return Object.fromEntries(
    buildClientConfigs({
      install,
      serverKey: 'github',
      serverName: 'GitHub',
      env,
    }).map((c) => [c.client, c]),
  );
}

describe('buildClientConfigs', () => {
  it('covers every client the /clients pages describe', () => {
    expect([...CLIENT_CONFIG_SLUGS].sort()).toEqual(
      MCP_CLIENTS.map((c) => c.slug).sort(),
    );
  });

  it('emits the stdio shape each client documents', () => {
    const c = byClient(stdio);
    expect(JSON.parse(c['claude-desktop'].snippet)).toEqual({
      mcpServers: {
        github: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: { GITHUB_TOKEN: '' },
        },
      },
    });
    const vscode = JSON.parse(c['vs-code'].snippet);
    expect(vscode.servers.github.type).toBe('stdio');
    expect(vscode.servers.github.env.GITHUB_TOKEN).toBe(
      `\${input:github-token}`,
    );
    expect(vscode.inputs[0]).toMatchObject({
      type: 'promptString',
      id: 'github-token',
      password: true,
    });
    expect(JSON.parse(c.zed.snippet).context_servers.github.command).toBe(
      'npx',
    );
    expect(c['claude-code'].snippet).toBe(
      'claude mcp add --env GITHUB_TOKEN= --transport stdio github -- npx -y @modelcontextprotocol/server-github',
    );
    expect(c.codex.snippet).toContain('[mcp_servers.github]');
    expect(c.codex.snippet).toContain('[mcp_servers.github.env]');
    expect(c.continue.snippet).toContain('schema: v1');
    expect(c.cli.snippet).toContain('npx -y');
  });

  it('emits the remote shape each client documents', () => {
    const c = byClient(remote);
    expect(JSON.parse(c.cursor.snippet).mcpServers.github).toEqual({
      url: 'https://mcp.example.com/mcp',
    });
    expect(JSON.parse(c.windsurf.snippet).mcpServers.github.serverUrl).toBe(
      'https://mcp.example.com/mcp',
    );
    expect(JSON.parse(c['gemini-cli'].snippet).mcpServers.github.httpUrl).toBe(
      'https://mcp.example.com/mcp',
    );
    expect(JSON.parse(c.cline.snippet).mcpServers.github.type).toBe(
      'streamableHttp',
    );
    expect(JSON.parse(c['roo-code'].snippet).mcpServers.github.type).toBe(
      'streamable-http',
    );
    expect(JSON.parse(c['vs-code'].snippet).servers.github).toEqual({
      type: 'http',
      url: 'https://mcp.example.com/mcp',
    });
    expect(c['claude-code'].snippet).toBe(
      'claude mcp add --transport http github https://mcp.example.com/mcp',
    );
    // Claude Desktop adds remote servers as connectors, not in the file.
    expect(c['claude-desktop'].format).toBe('text');
    // No stdio smoke test for a hosted endpoint, and no env leaking in.
    expect(c.cli).toBeUndefined();
    expect(c.cursor.snippet).not.toContain('GITHUB_TOKEN');
  });

  it('keeps a typed secret literal in VS Code instead of prompting', () => {
    const c = byClient(stdio, [{ key: 'GITHUB_TOKEN', value: 'ghp_x' }]);
    const vscode = JSON.parse(c['vs-code'].snippet);
    expect(vscode.inputs).toBeUndefined();
    expect(vscode.servers.github.env.GITHUB_TOKEN).toBe('ghp_x');
  });
});

describe('shellQuote', () => {
  it('quotes only what needs it', () => {
    expect(shellQuote('@scope/pkg')).toBe('@scope/pkg');
    expect(shellQuote('/path with space')).toBe("'/path with space'");
    expect(shellQuote("it's")).toBe("'it'\\''s'");
  });
});

describe('serverConfigKey', () => {
  it('produces a key every client accepts', () => {
    expect(serverConfigKey('GitHub MCP / Server')).toBe('github-mcp-server');
    expect(serverConfigKey('!!!')).toBe('mcp-server');
  });
});
