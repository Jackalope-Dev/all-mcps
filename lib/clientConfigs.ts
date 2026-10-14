/**
 * Per-client install configs for one MCP server, generated from its resolved
 * install (lib/installConfig.ts). One source for the listing page's config
 * tabs, the MCP get_mcp_install_config tool and /api/v1/servers/{id}, so every
 * surface hands out the same, client-correct shape.
 *
 * Every format below was checked against the client's own documentation
 * (October 2026); the source is noted on each builder. Pure and dependency-free
 * so it is safe to bundle into 'use client' components.
 */
import type { ResolvedInstall } from './installConfig';

type ClientConfigFormat = 'json' | 'toml' | 'yaml' | 'shell' | 'text';

export type ClientConfig = {
  /** Client slug — matches lib/clients.ts (/clients/<slug>), plus 'cli'. */
  client: string;
  label: string;
  format: ClientConfigFormat;
  /** Where the snippet goes. Empty for a command you run. */
  locations: Array<{ os: string; path: string }>;
  snippet: string;
  /** One line on how to apply it. */
  note: string;
};

export type ClientConfigEnv = Array<{ key: string; value?: string }>;

export type ClientConfigInput = {
  install: ResolvedInstall;
  /** Readable identifier used as the server's key in each config. */
  serverKey: string;
  /** Display name, used where a client wants one (Continue). */
  serverName: string;
  /** Environment variables the server needs. Ignored for remote servers. */
  env?: ClientConfigEnv;
};

/** A config key every client accepts: lowercase letters, digits, - and _. */
export function serverConfigKey(idOrName: string): string {
  return (
    idOrName
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'mcp-server'
  );
}

type Stdio = Extract<ResolvedInstall, { kind: 'stdio' }>;
type Remote = Extract<ResolvedInstall, { kind: 'remote' }>;
type Ctx = { key: string; name: string; env: Record<string, string> };

const json = (v: unknown) => JSON.stringify(v, null, 2);

function withEnv(entry: Record<string, unknown>, env: Record<string, string>) {
  return Object.keys(env).length > 0 ? { ...entry, env } : entry;
}

/** POSIX shell quoting: bare when safe, otherwise single-quoted. */
export function shellQuote(arg: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

function tomlString(s: string): string {
  return JSON.stringify(s);
}

function tomlKey(k: string): string {
  return /^[A-Za-z0-9_-]+$/.test(k) ? k : JSON.stringify(k);
}

function yamlString(s: string): string {
  // JSON strings are valid YAML double-quoted scalars.
  return JSON.stringify(s);
}

type Builder = {
  client: string;
  label: string;
  stdio: (i: Stdio, c: Ctx) => Omit<ClientConfig, 'client' | 'label'>;
  remote: (i: Remote, c: Ctx) => Omit<ClientConfig, 'client' | 'label'>;
};

const CLAUDE_DESKTOP_LOCATIONS = [
  {
    os: 'macOS',
    path: '~/Library/Application Support/Claude/claude_desktop_config.json',
  },
  { os: 'Windows', path: '%APPDATA%\\Claude\\claude_desktop_config.json' },
];

const BUILDERS: Builder[] = [
  {
    // modelcontextprotocol.io quickstart; support.claude.com "custom connectors
    // using remote MCP" — remote servers are added in the app, not the file.
    client: 'claude-desktop',
    label: 'Claude Desktop',
    stdio: (i, c) => ({
      format: 'json',
      locations: CLAUDE_DESKTOP_LOCATIONS,
      snippet: json({
        mcpServers: {
          [c.key]: withEnv({ command: i.command, args: i.args }, c.env),
        },
      }),
      note: 'Settings → Developer → Edit Config, merge this into mcpServers, then fully quit and reopen Claude Desktop.',
    }),
    remote: (i) => ({
      format: 'text',
      locations: [],
      snippet: i.url,
      note: 'Remote servers are added in the app, not the config file: Customize → Connectors → Add custom connector, then paste this URL.',
    }),
  },
  {
    // code.claude.com/docs/en/mcp — options (--env, --transport) go before the
    // name, and the server command after `--`.
    client: 'claude-code',
    label: 'Claude Code',
    stdio: (i, c) => ({
      format: 'shell',
      locations: [],
      snippet: [
        'claude mcp add',
        ...Object.entries(c.env).map(
          ([k, v]) => `--env ${shellQuote(`${k}=${v}`)}`,
        ),
        '--transport stdio',
        shellQuote(c.key),
        '--',
        shellQuote(i.command),
        ...i.args.map(shellQuote),
      ].join(' '),
      note: 'Run in your terminal. Add --scope project to share it with your team through .mcp.json.',
    }),
    remote: (i, c) => ({
      format: 'shell',
      locations: [],
      snippet: `claude mcp add --transport http ${shellQuote(c.key)} ${shellQuote(i.url)}`,
      note: 'Run in your terminal, then run /mcp in Claude Code to sign in if the server asks.',
    }),
  },
  {
    // cursor.com/docs/context/mcp
    client: 'cursor',
    label: 'Cursor',
    stdio: (i, c) => ({
      format: 'json',
      locations: [
        { os: 'Global', path: '~/.cursor/mcp.json' },
        { os: 'Project', path: '.cursor/mcp.json' },
      ],
      snippet: json({
        mcpServers: {
          [c.key]: withEnv({ command: i.command, args: i.args }, c.env),
        },
      }),
      note: 'Merge into mcpServers; Cursor picks the change up, then enable the server in Settings → MCP.',
    }),
    remote: (i, c) => ({
      format: 'json',
      locations: [
        { os: 'Global', path: '~/.cursor/mcp.json' },
        { os: 'Project', path: '.cursor/mcp.json' },
      ],
      snippet: json({ mcpServers: { [c.key]: { url: i.url } } }),
      note: 'Merge into mcpServers, then enable the server in Settings → MCP.',
    }),
  },
  {
    // code.visualstudio.com/docs/agents/reference/mcp-configuration — top-level
    // `servers`, explicit `type`, and secrets as promptString inputs.
    client: 'vs-code',
    label: 'VS Code',
    stdio: (i, c) => {
      const inputs: Array<Record<string, unknown>> = [];
      const env: Record<string, string> = {};
      for (const [k, v] of Object.entries(c.env)) {
        if (v && v !== 'YOUR_VALUE_HERE') {
          env[k] = v;
          continue;
        }
        const id = k.toLowerCase().replace(/_/g, '-');
        inputs.push({
          type: 'promptString',
          id,
          description: k,
          password: true,
        });
        env[k] = `\${input:${id}}`;
      }
      return {
        format: 'json',
        locations: [
          { os: 'Workspace', path: '.vscode/mcp.json' },
          {
            os: 'User',
            path: 'Command Palette → MCP: Open User Configuration',
          },
        ],
        snippet: json({
          ...(inputs.length > 0 ? { inputs } : {}),
          servers: {
            [c.key]: withEnv(
              { type: 'stdio', command: i.command, args: i.args },
              env,
            ),
          },
        }),
        note: 'Merge into servers (and inputs); VS Code prompts for each secret the first time the server starts.',
      };
    },
    remote: (i, c) => ({
      format: 'json',
      locations: [
        { os: 'Workspace', path: '.vscode/mcp.json' },
        { os: 'User', path: 'Command Palette → MCP: Open User Configuration' },
      ],
      snippet: json({ servers: { [c.key]: { type: 'http', url: i.url } } }),
      note: 'Merge into servers, then start it from the MCP Servers view.',
    }),
  },
  {
    // docs.devin.ai/desktop/cascade/mcp (docs.windsurf.com redirects there since
    // the June 2026 rename) — remote servers use serverUrl.
    client: 'windsurf',
    label: 'Windsurf / Devin Desktop',
    stdio: (i, c) => ({
      format: 'json',
      locations: WINDSURF_LOCATIONS,
      snippet: json({
        mcpServers: {
          [c.key]: withEnv({ command: i.command, args: i.args }, c.env),
        },
      }),
      note: 'Merge into mcpServers, then refresh the MCP list in the agent panel.',
    }),
    remote: (i, c) => ({
      format: 'json',
      locations: WINDSURF_LOCATIONS,
      snippet: json({ mcpServers: { [c.key]: { serverUrl: i.url } } }),
      note: 'Merge into mcpServers, then refresh the MCP list in the agent panel.',
    }),
  },
  {
    // docs.cline.bot/mcp/configuring-mcp-servers — remote needs
    // type "streamableHttp"; omitting it falls back to legacy SSE.
    client: 'cline',
    label: 'Cline',
    stdio: (i, c) => ({
      format: 'json',
      locations: CLINE_LOCATIONS,
      snippet: json({
        mcpServers: {
          [c.key]: {
            ...withEnv({ command: i.command, args: i.args }, c.env),
            disabled: false,
            autoApprove: [],
          },
        },
      }),
      note: 'Cline → MCP Servers → Configure → Configure MCP Servers opens this file; merge into mcpServers.',
    }),
    remote: (i, c) => ({
      format: 'json',
      locations: CLINE_LOCATIONS,
      snippet: json({
        mcpServers: {
          [c.key]: {
            type: 'streamableHttp',
            url: i.url,
            disabled: false,
            autoApprove: [],
          },
        },
      }),
      note: 'Cline → MCP Servers → Configure → Configure MCP Servers opens this file; merge into mcpServers.',
    }),
  },
  {
    // zed.dev/docs/ai/mcp — context_servers is an object keyed by name.
    client: 'zed',
    label: 'Zed',
    stdio: (i, c) => ({
      format: 'json',
      locations: ZED_LOCATIONS,
      snippet: json({
        context_servers: {
          [c.key]: withEnv({ command: i.command, args: i.args }, c.env),
        },
      }),
      note: 'Merge into context_servers in your Zed settings; the Agent Panel shows it once it starts.',
    }),
    remote: (i, c) => ({
      format: 'json',
      locations: ZED_LOCATIONS,
      snippet: json({ context_servers: { [c.key]: { url: i.url } } }),
      note: 'Merge into context_servers in your Zed settings.',
    }),
  },
  {
    // learn.chatgpt.com/docs/extend/mcp (developers.openai.com/codex/mcp).
    client: 'codex',
    label: 'Codex CLI',
    stdio: (i, c) => {
      const lines = [
        `[mcp_servers.${tomlKey(c.key)}]`,
        `command = ${tomlString(i.command)}`,
        `args = [${i.args.map(tomlString).join(', ')}]`,
      ];
      const env = Object.entries(c.env);
      if (env.length > 0) {
        lines.push('', `[mcp_servers.${tomlKey(c.key)}.env]`);
        for (const [k, v] of env)
          lines.push(`${tomlKey(k)} = ${tomlString(v)}`);
      }
      return {
        format: 'toml',
        locations: [{ os: 'All', path: '~/.codex/config.toml' }],
        snippet: lines.join('\n'),
        note: `Append to config.toml, or run: codex mcp add ${shellQuote(c.key)} -- ${[i.command, ...i.args].map(shellQuote).join(' ')}`,
      };
    },
    remote: (i, c) => ({
      format: 'toml',
      locations: [{ os: 'All', path: '~/.codex/config.toml' }],
      snippet: [
        `[mcp_servers.${tomlKey(c.key)}]`,
        `url = ${tomlString(i.url)}`,
      ].join('\n'),
      note: 'Append to config.toml. For a bearer token, add bearer_token_env_var with the name of the variable holding it.',
    }),
  },
  {
    // geminicli.com/docs/tools/mcp-server — httpUrl is streamable HTTP
    // (url means SSE there).
    client: 'gemini-cli',
    label: 'Gemini CLI',
    stdio: (i, c) => ({
      format: 'json',
      locations: GEMINI_LOCATIONS,
      snippet: json({
        mcpServers: {
          [c.key]: withEnv({ command: i.command, args: i.args }, c.env),
        },
      }),
      note: 'Merge into mcpServers, then check it with /mcp inside Gemini CLI.',
    }),
    remote: (i, c) => ({
      format: 'json',
      locations: GEMINI_LOCATIONS,
      snippet: json({ mcpServers: { [c.key]: { httpUrl: i.url } } }),
      note: 'Merge into mcpServers, then check it with /mcp inside Gemini CLI.',
    }),
  },
  {
    // jetbrains.com/help/ai-assistant/mcp.html — "As JSON" in the New MCP
    // Server dialog takes the mcpServers shape; remote servers use url.
    client: 'jetbrains',
    label: 'JetBrains AI Assistant',
    stdio: (i, c) => ({
      format: 'json',
      locations: JETBRAINS_LOCATIONS,
      snippet: json({
        mcpServers: {
          [c.key]: withEnv({ command: i.command, args: i.args }, c.env),
        },
      }),
      note: 'Settings → Tools → AI Assistant → Model Context Protocol (MCP) → Add → As JSON, then paste.',
    }),
    remote: (i, c) => ({
      format: 'json',
      locations: JETBRAINS_LOCATIONS,
      snippet: json({ mcpServers: { [c.key]: { url: i.url } } }),
      note: 'Settings → Tools → AI Assistant → Model Context Protocol (MCP) → Add → As JSON, then paste.',
    }),
  },
  {
    // roocodeinc.github.io/Roo-Code/features/mcp/using-mcp-in-roo
    client: 'roo-code',
    label: 'Roo Code',
    stdio: (i, c) => ({
      format: 'json',
      locations: ROO_LOCATIONS,
      snippet: json({
        mcpServers: {
          [c.key]: {
            ...withEnv({ command: i.command, args: i.args }, c.env),
            alwaysAllow: [],
            disabled: false,
          },
        },
      }),
      note: 'Roo → MCP Servers → Edit Global MCP (or Edit Project MCP), then merge into mcpServers.',
    }),
    remote: (i, c) => ({
      format: 'json',
      locations: ROO_LOCATIONS,
      snippet: json({
        mcpServers: {
          [c.key]: { type: 'streamable-http', url: i.url, disabled: false },
        },
      }),
      note: 'Roo → MCP Servers → Edit Global MCP (or Edit Project MCP), then merge into mcpServers.',
    }),
  },
  {
    // docs.continue.dev/customize/deep-dives/mcp — one YAML block per file in
    // .continue/mcpServers/.
    client: 'continue',
    label: 'Continue',
    stdio: (i, c) => {
      const lines = [
        `name: ${yamlString(c.name)}`,
        'version: 0.0.1',
        'schema: v1',
        'mcpServers:',
        `  - name: ${yamlString(c.name)}`,
        `    command: ${yamlString(i.command)}`,
      ];
      if (i.args.length > 0) {
        lines.push('    args:');
        for (const a of i.args) lines.push(`      - ${yamlString(a)}`);
      }
      const env = Object.entries(c.env);
      if (env.length > 0) {
        lines.push('    env:');
        for (const [k, v] of env) lines.push(`      ${k}: ${yamlString(v)}`);
      }
      return {
        format: 'yaml',
        locations: [
          { os: 'Project', path: `.continue/mcpServers/${c.key}.yaml` },
        ],
        snippet: lines.join('\n'),
        note: 'Save as its own file; MCP tools work in Continue agent mode.',
      };
    },
    remote: (i, c) => ({
      format: 'yaml',
      locations: [
        { os: 'Project', path: `.continue/mcpServers/${c.key}.yaml` },
      ],
      snippet: [
        `name: ${yamlString(c.name)}`,
        'version: 0.0.1',
        'schema: v1',
        'mcpServers:',
        `  - name: ${yamlString(c.name)}`,
        '    type: streamable-http',
        `    url: ${yamlString(i.url)}`,
      ].join('\n'),
      note: 'Save as its own file; MCP tools work in Continue agent mode.',
    }),
  },
  {
    // lmstudio.ai/docs/app/mcp — Cursor's mcp.json notation.
    client: 'lm-studio',
    label: 'LM Studio',
    stdio: (i, c) => ({
      format: 'json',
      locations: LM_STUDIO_LOCATIONS,
      snippet: json({
        mcpServers: {
          [c.key]: withEnv({ command: i.command, args: i.args }, c.env),
        },
      }),
      note: 'Program tab → Install → Edit mcp.json, then merge into mcpServers.',
    }),
    remote: (i, c) => ({
      format: 'json',
      locations: LM_STUDIO_LOCATIONS,
      snippet: json({ mcpServers: { [c.key]: { url: i.url } } }),
      note: 'Program tab → Install → Edit mcp.json, then merge into mcpServers.',
    }),
  },
];

const WINDSURF_LOCATIONS = [
  { os: 'macOS / Linux', path: '~/.config/devin/mcp_config.json' },
  { os: 'Windows', path: '%APPDATA%\\devin\\mcp_config.json' },
  {
    os: 'Windsurf (before the rename)',
    path: '~/.codeium/windsurf/mcp_config.json',
  },
];
const CLINE_LOCATIONS = [
  {
    os: 'VS Code (macOS)',
    path: '~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json',
  },
  {
    os: 'VS Code (Windows)',
    path: '%APPDATA%\\Code\\User\\globalStorage\\saoudrizwan.claude-dev\\settings\\cline_mcp_settings.json',
  },
  { os: 'Cline CLI', path: '~/.cline/data/settings/cline_mcp_settings.json' },
];
const ZED_LOCATIONS = [
  { os: 'macOS / Linux', path: '~/.config/zed/settings.json' },
  { os: 'Windows', path: '%APPDATA%\\Zed\\settings.json' },
];
const GEMINI_LOCATIONS = [
  { os: 'User', path: '~/.gemini/settings.json' },
  { os: 'Project', path: '.gemini/settings.json' },
];
const JETBRAINS_LOCATIONS = [
  {
    os: 'IDE',
    path: 'Settings → Tools → AI Assistant → Model Context Protocol (MCP)',
  },
];
const ROO_LOCATIONS = [
  {
    os: 'Global',
    path: 'mcp_settings.json (Roo → MCP Servers → Edit Global MCP)',
  },
  { os: 'Project', path: '.roo/mcp.json' },
];
const LM_STUDIO_LOCATIONS = [{ os: 'All', path: '~/.lmstudio/mcp.json' }];

/** Running the server directly — a smoke test, not a client config. */
function terminalConfig(i: Stdio, c: Ctx): ClientConfig {
  const env = Object.entries(c.env).map(([k, v]) => shellQuote(`${k}=${v}`));
  return {
    client: 'cli',
    label: 'Terminal',
    format: 'shell',
    locations: [],
    snippet: [...env, shellQuote(i.command), ...i.args.map(shellQuote)].join(
      ' ',
    ),
    note: 'Runs the server on stdio to check it starts; press Ctrl+C to stop.',
  };
}

/** Client slugs covered, in display order. */
export const CLIENT_CONFIG_SLUGS = BUILDERS.map((b) => b.client);

export function buildClientConfigs(input: ClientConfigInput): ClientConfig[] {
  const env: Record<string, string> = {};
  if (input.install.kind === 'stdio') {
    for (const { key, value } of input.env ?? []) {
      const k = key.trim();
      if (k) env[k] = value ?? '';
    }
  }
  const ctx: Ctx = { key: input.serverKey, name: input.serverName, env };
  const install = input.install;
  const out: ClientConfig[] = BUILDERS.map((b) => ({
    client: b.client,
    label: b.label,
    ...(install.kind === 'stdio'
      ? b.stdio(install, ctx)
      : b.remote(install, ctx)),
  }));
  if (install.kind === 'stdio') out.push(terminalConfig(install, ctx));
  return out;
}
