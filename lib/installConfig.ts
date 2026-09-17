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
  type InstallHint,
  isPlausibleInstallPackage,
  isRemoteHint,
  looksLikeMcpEndpointUrl,
  type ParsedInstallHint,
  parseInstallHint,
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
      source: 'description' | 'heuristic' | 'cached' | 'submitted';
    }
  | {
      kind: 'remote';
      url: string;
      confidence: InstallConfidence;
      source: 'description' | 'endpoint' | 'cached' | 'submitted';
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

/**
 * Positive signals ONLY. This used to return true for any http(s) URL that
 * wasn't GitHub/npm/PyPI/Glama — which meant a plain product homepage was
 * resolved as `{kind:'remote'}` at medium confidence, and the listing rendered
 * one-click buttons that pointed people's MCP clients at a marketing page.
 * A URL has to actually look like an endpoint to be treated as one; when it
 * doesn't, we fall through to the stdio heuristic, which at least labels
 * itself low-confidence instead of confidently sending clients somewhere real
 * and wrong. That bar now lives in the README/description parser as
 * `looksLikeMcpEndpointUrl`, so every path that can produce a `{kind:'remote'}`
 * — cached row, parsed hint, or primary URL — applies the same one.
 */

/**
 * Install details nobody has actually confirmed: a runner + package guessed from
 * the listing's name, or anything explicitly cached as low confidence. These are
 * fine as a starting point next to a "verify this" warning, but no surface may
 * present them as a ready-to-run instruction — a one-click deep link, or a config
 * block stated as fact — because a guessed package name is either nonexistent or,
 * worse, somebody else's package.
 */
export function isUnverifiedInstall(install: ResolvedInstall): boolean {
  return install.source === 'heuristic' || install.confidence === 'low';
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
  /** Explicit remote endpoint from the listing row. Owner-editable and
   * admin-reviewed, so it outranks every parsed or guessed source. */
  remoteEndpointUrl?: string | null;
  /** Submitter/owner hint — only used when cached confidence is low/absent. */
  suggestedInstallCommand?: string | null;
  suggestedInstallArgs?: string | string[] | null;
};

function fromCached(
  cached: CachedInstallFields | undefined | null,
): ResolvedInstall | null {
  if (!cached?.installKind) return null;
  const confidence =
    cached.installConfidence === 'high' ||
    cached.installConfidence === 'medium' ||
    cached.installConfidence === 'low'
      ? cached.installConfidence
      : 'medium';

  if (cached.installKind === 'remote' && cached.installPackage) {
    // Re-check the cached URL against today's endpoint bar instead of trusting the
    // row. These columns are a cache of whatever the resolver believed when the
    // health cron last swept the listing, so rows written by the old any-non-GitHub-
    // URL-is-an-endpoint heuristic still hold product homepages — and cache beats
    // every other source below, so a stale row kept re-rendering the exact install
    // buttons that heuristic fix was meant to stop. Dropping to the other sources is
    // the right failure: they either find a real hint or land on a guess that
    // labels itself as one.
    if (!looksLikeMcpEndpointUrl(cached.installPackage)) return null;
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
    // Same self-healing re-check the remote branch above does, for the other half of
    // the cache. The old README parser took the first runner invocation it saw and the
    // first token after it, so rows hold debugging CLIs (@modelcontextprotocol/inspector),
    // installer CLIs (@smithery/cli), deploy tooling (wrangler), bare flags (--from, -p)
    // and prose ('to', 'or') as the package — all cached at high confidence, all
    // outranking every other source here. Falling through is the right failure: the
    // sources below either find a real hint or land on a guess that labels itself one.
    if (!isPlausibleInstallPackage(packageName)) return null;
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
 *
 * Returns null when the install must not be written to the cache columns at all —
 * currently a remote install whose URL isn't endpoint-shaped. This is the single
 * choke point every writer passes through (health cron, enrichment, backfills), and
 * it exists because the read side alone wasn't enough: a bad value written here is
 * cached at whatever confidence the parser claimed, outranks every other source in
 * resolveInstallConfig, and is also read directly by consumers that never go through
 * it (the remote-endpoint liveness probe, the vuln scanner). Nine thousand rows held
 * shields.io badges and localhost URLs as endpoints because nothing checked on the
 * way in. A caller that gets null should clear the columns, not persist something else.
 */
export function toCachedInstallFields(install: ResolvedInstall): {
  installKind: string;
  installCommand: string | null;
  installArgs: string | null;
  installPackage: string;
  installConfidence: InstallConfidence;
} | null {
  if (install.kind === 'remote') {
    if (!looksLikeMcpEndpointUrl(install.url)) return null;
    return {
      installKind: 'remote',
      installCommand: null,
      installArgs: null,
      installPackage: install.url,
      installConfidence: install.confidence,
    };
  }
  // A stdio install whose package is a dev tool, a flag or a placeholder must not reach
  // the columns either — the write side is the choke point that keeps the next sweep from
  // re-caching what the read side just rejected.
  if (!isPlausibleInstallPackage(install.packageName)) return null;
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
  fallback: { id: string; name: string; url: string },
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
  // h.package is set when the args don't end in the installable name — 'uvx --from pkg cmd'.
  const packageName = h.package || h.args[h.args.length - 1] || fallback.id;
  return {
    kind: 'stdio',
    command: h.command,
    args: h.args,
    packageName,
    confidence: 'high',
    source: 'description',
  };
}

export function resolveInstallConfig(
  input: {
    id: string;
    name: string;
    url: string;
    description?: string | null;
  } & CachedInstallFields,
): ResolvedInstall {
  // An explicit endpoint on the row beats anything parsed out of a README or
  // guessed from a URL: it's the one install field a verified owner controls,
  // and it only lands after admin review. Clearing it falls back to the rest.
  const explicitEndpoint = (input.remoteEndpointUrl || '').trim();
  if (explicitEndpoint) {
    return {
      kind: 'remote',
      url: explicitEndpoint,
      confidence: 'high',
      source: 'submitted',
    };
  }

  const cached = fromCached(input);
  // High/medium cached wins. Low-confidence cache falls through so submitter
  // suggestions (and description/endpoint hints) can still improve the result.
  if (cached && cached.confidence !== 'low') return cached;

  const suggestedCmd =
    typeof input.suggestedInstallCommand === 'string'
      ? input.suggestedInstallCommand.trim()
      : '';
  if (suggestedCmd) {
    const args = parseArgsJson(input.suggestedInstallArgs) || [];
    const packageName = args[args.length - 1] || input.id;
    return {
      kind: 'stdio',
      command: suggestedCmd,
      args: args.length ? args : ['-y', packageName],
      packageName,
      confidence: 'medium',
      source: 'submitted',
    };
  }

  // Prefer a low-confidence cache over pure heuristics when no submitter hint.
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
    const packageName =
      hint.package || hint.args[hint.args.length - 1] || input.id;
    return {
      kind: 'stdio',
      command: hint.command,
      args: hint.args,
      packageName,
      confidence: 'high',
      source: 'description',
    };
  }

  if (looksLikeMcpEndpointUrl(input.url)) {
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
  if (install.confidence === 'high')
    return 'Install path detected from listing signals.';
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
  envVars?: string[],
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

/**
 * Runtime label for display, or null when nothing confirmed one.
 *
 * The detail page used to derive this inline with a chain that ended in an
 * unconditional `return 'Node.js'` — so a hosted service with no local runner
 * at all was labelled "Runtime Node.js", and a listing whose *description*
 * merely mentioned Python was labelled Python. Neither is a signal: the only
 * thing that tells us what runs the server is a command someone actually
 * confirmed. When we don't have one, the row is omitted, for the same reason
 * we don't publish a guessed config block — see `isUnverifiedInstall`.
 */
export function runtimeLabel(install: ResolvedInstall): string | null {
  if (isUnverifiedInstall(install)) return null;
  // Hosted server: whatever runs it is the operator's business, not a local
  // runtime the reader has to install.
  if (install.kind === 'remote') return null;
  const cmd = install.command.toLowerCase();
  if (/^(uvx|uv|pipx|pip|pip3|python|python3)$/.test(cmd)) return 'Python';
  if (cmd === 'docker') return 'Docker';
  if (cmd === 'go') return 'Go';
  if (/^(npx|bunx|bun|node|deno|pnpm|yarn)$/.test(cmd)) return 'Node.js';
  return null;
}

/**
 * Transport label for display, or null when the install details behind it were
 * only guessed. "SSE (Remote)" used to be asserted for any listing whose
 * primary URL merely wasn't a repository URL, which labelled ordinary product
 * homepages as MCP endpoints.
 */
export function transportLabel(install: ResolvedInstall): string | null {
  if (isUnverifiedInstall(install)) return null;
  return install.kind === 'remote' ? 'SSE (Remote)' : 'STDIO';
}
