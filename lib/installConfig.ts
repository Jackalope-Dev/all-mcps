/**
 * Derive install / IDE config snippets from listing signals.
 *
 * Priority:
 *  1. Cached install hint from DB (health cron README parse)
 *  2. Explicit install hint in description (npx/uvx/bunx/pip/remote URL)
 *  3. Hosted MCP endpoint URL (non-GitHub primary url)
 *  4. Heuristic fallback — marked low-confidence so UIs can warn users
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
      source: 'description' | 'heuristic' | 'cached';
    }
  | {
      kind: 'remote';
      url: string;
      confidence: InstallConfidence;
      source: 'description' | 'endpoint' | 'cached';
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
  if (/^@[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(trimmed)) return trimmed;
  if (/^[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(trimmed) && !trimmed.includes(' ')) {
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
    if (/\/mcp|\/sse|\/message|api\.|mcp\./i.test(u.href)) return true;
    return (
      u.hostname.length > 0 &&
      !['npmjs.com', 'pypi.org', 'glama.ai'].some((h) => u.hostname.includes(h))
    );
  } catch {
    return false;
  }
}

export function parseArgsJson(raw: unknown): string[] | null {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    const parts = raw.trim().split(/\s+/).filter(Boolean);
    if (parts.length > 0) return parts;
  }
  return null;
}

export type CachedInstallFields = {
  installKind?: string | null;
  installCommand?: string | null;
  installArgs?: string | string[] | null;
  installPackage?: string | null;
  installConfidence?: string | null;
};

function fromCached(cached: CachedInstallFields | undefined | null): ResolvedInstall | null {
  if (!cached?.installKind) return null;
  const confidence =
    cached.installConfidence === 'high' ||
    cached.installConfidence === 'medium' ||
    cached.installConfidence === 'low'
      ? cached.installConfidence
      : 'medium';

  if (cached.installKind === 'remote' && cached.installPackage) {
    return {
      kind: 'remote',
      url: cached.installPackage,
      confidence,
      source: 'cached',
    };
  }

  if (cached.installKind === 'stdio' && cached.installCommand) {
    const args = parseArgsJson(cached.installArgs) || [];
    const packageName =
      cached.installPackage || args[args.length - 1] || cached.installCommand;
    return {
      kind: 'stdio',
      command: cached.installCommand,
      args: args.length ? args : ['-y', packageName],
      packageName,
      confidence,
      source: 'cached',
    };
  }

  return null;
}

/**
 * Persistable snapshot of a resolved install (for health cron → D1).
 */
export function toCachedInstallFields(install: ResolvedInstall): {
  installKind: string;
  installCommand: string | null;
  installArgs: string | null;
  installPackage: string;
  installConfidence: InstallConfidence;
} {
  if (install.kind === 'remote') {
    return {
      installKind: 'remote',
      installCommand: null,
      installArgs: null,
      installPackage: install.url,
      installConfidence: install.confidence,
    };
  }
  return {
    installKind: 'stdio',
    installCommand: install.command,
    installArgs: JSON.stringify(install.args),
    installPackage: install.packageName,
    installConfidence: install.confidence,
  };
}

/**
 * Parse install hints from free text (README body or description).
 * Prefer README-derived results for caching (high confidence when a runner is found).
 */
export function resolveInstallFromText(
  text: string,
  fallback: { id: string; name: string; url: string }
): ResolvedInstall | null {
  const hint = parseInstallHint(text || '');
  if (!hint) return null;

  if (isRemoteHint(hint)) {
    return {
      kind: 'remote',
      url: (hint as RemoteHint).url,
      confidence: 'high',
      source: 'description',
    };
  }

  const h = hint as InstallHint;
  const packageName = h.args[h.args.length - 1] || fallback.id;
  return {
    kind: 'stdio',
    command: h.command,
    args: h.args,
    packageName,
    confidence: 'high',
    source: 'description',
  };
}

export function resolveInstallConfig(input: {
  id: string;
  name: string;
  url: string;
  description?: string | null;
} & CachedInstallFields): ResolvedInstall {
  const cached = fromCached(input);
  if (cached) return cached;

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

  if (looksLikeMcpHttpEndpoint(input.url)) {
    return {
      kind: 'remote',
      url: input.url,
      confidence: 'medium',
      source: 'endpoint',
    };
  }

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

/**
 * Human/agent-readable caveat for a resolved install's confidence level. Shared by the
 * markdown export and the JSON search API so a "low"/"medium" install never ships
 * silently — every surface that hands out a command carries the same warning text.
 */
export function installConfidenceNote(install: ResolvedInstall): string {
  if (install.confidence === 'high') return 'Install path detected from listing signals.';
  if (install.confidence === 'medium')
    return 'Install path inferred — verify against the README before running it.';
  return 'Heuristic fallback — verify the package name and runner against the repository README before running it.';
}

/**
 * Claude Desktop / Cursor style mcpServers fragment for API responses.
 * `envVars` (from cached AI-extracted setup instructions, see lib/aiContent.ts) become
 * empty-value placeholders in an `env` block — the caller must still fill in real
 * secrets, but the config now at least documents that they're required instead of
 * silently omitting them.
 */
export function toClaudeConfigSnippet(
  install: ResolvedInstall,
  key: string,
  envVars?: string[]
): Record<string, unknown> {
  if (install.kind === 'remote') {
    return {
      mcpServers: {
        [key]: {
          url: install.url,
        },
      },
    };
  }
  const entry: Record<string, unknown> = {
    command: install.command,
    args: install.args,
  };
  if (envVars && envVars.length > 0) {
    entry.env = Object.fromEntries(envVars.map((v) => [v, '']));
  }
  return {
    mcpServers: {
      [key]: entry,
    },
  };
}
