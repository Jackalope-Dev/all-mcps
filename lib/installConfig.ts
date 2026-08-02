/**
 * Derive install / IDE config snippets from listing signals.
 *
 * Priority:
 *  1. Explicit install hint in description (npx/uvx/bunx/pip/remote URL)
 *  2. Hosted MCP endpoint URL (non-GitHub primary url)
 *  3. Heuristic fallback — marked low-confidence so UIs can warn users
 */

import {
  parseInstallHint,
  isRemoteHint,
  type ParsedInstallHint,
  type InstallHint,
  type RemoteHint,
} from './tools/parseInstallHint';

export type InstallConfidence = 'high' | 'medium' | 'low';

export type ResolvedInstall =
  | {
      kind: 'stdio';
      command: string;
      args: string[];
      packageName: string;
      confidence: InstallConfidence;
      source: 'description' | 'heuristic';
    }
  | {
      kind: 'remote';
      url: string;
      confidence: InstallConfidence;
      source: 'description' | 'endpoint';
    };

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9@/._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'mcp-server'
  );
}

/** Prefer scoped npm-style names from listing name (e.g. @org/pkg). */
function packageCandidateFromName(name: string): string | null {
  const trimmed = name.trim();
  // @scope/package
  if (/^@[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(trimmed)) return trimmed;
  // owner/repo that looks like an npm package without scope (rare)
  if (/^[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(trimmed) && !trimmed.includes(' ')) {
    // github-style owner/repo is NOT a valid npm name for npx -y owner/repo
    return null;
  }
  return null;
}

function isGithubUrl(url: string): boolean {
  return /github\.com/i.test(url || '');
}

function looksLikeMcpHttpEndpoint(url: string): boolean {
  if (!url || isGithubUrl(url)) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    // Common remote MCP path patterns
    if (/\/mcp|\/sse|\/message|api\.|mcp\./i.test(u.href)) return true;
    // Non-github host with no path is still possible (custom domains)
    return u.hostname.length > 0 && !['npmjs.com', 'pypi.org', 'glama.ai'].some((h) =>
      u.hostname.includes(h)
    );
  } catch {
    return false;
  }
}

export function resolveInstallConfig(input: {
  id: string;
  name: string;
  url: string;
  description?: string | null;
}): ResolvedInstall {
  const descHint: ParsedInstallHint = parseInstallHint(input.description || '');

  if (descHint && isRemoteHint(descHint)) {
    return {
      kind: 'remote',
      url: (descHint as RemoteHint).url,
      confidence: 'high',
      source: 'description',
    };
  }

  if (descHint && 'command' in descHint) {
    const hint = descHint as InstallHint;
    const packageName = hint.args[hint.args.length - 1] || input.id;
    return {
      kind: 'stdio',
      command: hint.command,
      args: hint.args,
      packageName,
      confidence: 'high',
      source: 'description',
    };
  }

  // Hosted endpoint as primary URL (not a GitHub repo)
  if (looksLikeMcpHttpEndpoint(input.url)) {
    return {
      kind: 'remote',
      url: input.url,
      confidence: 'medium',
      source: 'endpoint',
    };
  }

  // Heuristic fallback — prefer real package names when we have them
  const fromName = packageCandidateFromName(input.name);
  const packageName = fromName || input.id || slugify(input.name);
  const isPython =
    /python|py-mcp|mcp-py/i.test(input.name + (input.description || '')) ||
    packageName.includes('py');

  if (isPython) {
    return {
      kind: 'stdio',
      command: 'uvx',
      args: [packageName],
      packageName,
      confidence: fromName ? 'medium' : 'low',
      source: 'heuristic',
    };
  }

  return {
    kind: 'stdio',
    command: 'npx',
    args: ['-y', packageName],
    packageName,
    confidence: fromName ? 'medium' : 'low',
    source: 'heuristic',
  };
}

/** Claude Desktop / Cursor style mcpServers fragment for API responses. */
export function toClaudeConfigSnippet(install: ResolvedInstall, key: string): Record<string, unknown> {
  if (install.kind === 'remote') {
    return {
      mcpServers: {
        [key]: {
          url: install.url,
        },
      },
    };
  }
  return {
    mcpServers: {
      [key]: {
        command: install.command,
        args: install.args,
      },
    },
  };
}
