export type ClientFormat = 'claude' | 'cursor' | 'windsurf' | 'vscode';

export interface ServerRow {
  /** Client-side row id (crypto.randomUUID()), not a directory id. */
  id: string;
  /** The key this server is registered under in the config (e.g. mcpServers.<name>). */
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  /** Remote/HTTP server URL — mutually exclusive with command/args in practice. */
  url?: string;
  /** Set when this row was added via the directory picker, for the "view listing" link. */
  sourceServerId?: string;
}

export interface ConfigFinding {
  level: 'error' | 'warning';
  path: string;
  message: string;
}

export const CLIENT_FORMAT_LABELS: Record<ClientFormat, string> = {
  claude: 'Claude Desktop / Claude Code',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
  vscode: 'VS Code',
};

export const CLIENT_CONFIG_PATHS: Record<ClientFormat, string[]> = {
  claude: [
    'macOS: ~/Library/Application Support/Claude/claude_desktop_config.json',
    'Windows: %APPDATA%\\Claude\\claude_desktop_config.json',
  ],
  cursor: ['.cursor/mcp.json (project) or ~/.cursor/mcp.json (global)'],
  windsurf: ['~/.codeium/windsurf/mcp_config.json'],
  vscode: ['.vscode/mcp.json (workspace) or user settings.json under "mcp"'],
};

function rowToServerEntry(row: ServerRow): Record<string, unknown> {
  if (row.url) {
    return row.env && Object.keys(row.env).length ? { url: row.url, env: row.env } : { url: row.url };
  }
  const entry: Record<string, unknown> = { command: row.command || '' };
  if (row.args && row.args.length) entry.args = row.args;
  if (row.env && Object.keys(row.env).length) entry.env = row.env;
  return entry;
}

export function serializeConfig(rows: ServerRow[], format: ClientFormat): string {
  const entries: Record<string, unknown> = {};
  for (const row of rows) {
    if (!row.name) continue;
    entries[row.name] = rowToServerEntry(row);
  }
  const key = format === 'vscode' ? 'servers' : 'mcpServers';
  return JSON.stringify({ [key]: entries }, null, 2);
}

export function detectFormat(parsed: unknown): ClientFormat {
  if (parsed && typeof parsed === 'object' && 'servers' in (parsed as Record<string, unknown>)) {
    return 'vscode';
  }
  return 'claude';
}

export function validateConfig(parsed: unknown, format: ClientFormat): ConfigFinding[] {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return [{ level: 'error', path: '$', message: 'Top-level value must be a JSON object.' }];
  }

  const key = format === 'vscode' ? 'servers' : 'mcpServers';
  const container = (parsed as Record<string, unknown>)[key];

  if (container === undefined) {
    return [{ level: 'error', path: '$', message: `Missing top-level "${key}" key for this client format.` }];
  }
  if (typeof container !== 'object' || container === null || Array.isArray(container)) {
    return [{ level: 'error', path: `$.${key}`, message: `"${key}" must be an object mapping server names to their config.` }];
  }

  const findings: ConfigFinding[] = [];

  for (const [name, value] of Object.entries(container as Record<string, unknown>)) {
    const path = `${key}.${name}`;

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      findings.push({ level: 'error', path, message: 'Server entry must be an object.' });
      continue;
    }
    const entry = value as Record<string, unknown>;
    const hasCommand = typeof entry.command === 'string' && entry.command.trim().length > 0;
    const hasUrl = typeof entry.url === 'string' && entry.url.trim().length > 0;

    if (!hasCommand && !hasUrl) {
      findings.push({ level: 'error', path, message: 'Entry needs a non-empty "command" or "url".' });
    }
    if (hasCommand && hasUrl) {
      findings.push({ level: 'warning', path, message: 'Entry has both "command" and "url" — only one transport is normally used.' });
    }
    if ('args' in entry) {
      const args = entry.args;
      if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) {
        findings.push({ level: 'error', path: `${path}.args`, message: '"args" must be an array of strings.' });
      }
    }
    if ('env' in entry) {
      const env = entry.env;
      if (typeof env !== 'object' || env === null || Array.isArray(env)) {
        findings.push({ level: 'error', path: `${path}.env`, message: '"env" must be an object of string values.' });
      } else if (Object.values(env as Record<string, unknown>).some((v) => typeof v !== 'string')) {
        findings.push({ level: 'error', path: `${path}.env`, message: 'All "env" values must be strings.' });
      }
    }
  }

  return findings;
}
