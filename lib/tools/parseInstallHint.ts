export interface InstallHint {
  command: string;
  args: string[];
  /**
   * Installable package identity when it isn't simply the last arg — e.g.
   * `uvx --from magic-hour-mcp magic-hour` installs `magic-hour-mcp` but runs the
   * `magic-hour` entry point. Consumers that resolve a package (vuln scanning,
   * npm/PyPI liveness) want the former; the args array stays the literal invocation.
   */
  package?: string;
}

export interface RemoteHint {
  url: string;
}

export type ParsedInstallHint = InstallHint | RemoteHint | null;

/**
 * Every `npx`/`uvx`/`bunx` invocation in the text, with the rest of its line captured
 * for tokenising. This used to be a single non-global match that took the first runner
 * anywhere in the README and the first path-ish token after it. Both halves were wrong:
 * a README's first npx line is very often a debugging or installer command (see
 * NON_MCP_TOOLING_PACKAGES), and the first token after the runner is very often a flag
 * (`uvx --from pkg cmd` cached "--from" as the package name for 235 listings).
 */
const RUNNER_INVOCATION_PATTERN = /\b(npx|uvx|bunx)[ \t]+([^\n\r]*)/g;
// Many READMEs show the launch command as a JSON `mcpServers` config block (the format
// Claude Desktop / Cursor docs recommend) instead of a shell one-liner, e.g.
// `"command": "npx", "args": ["-y", "some-package"]`. The runner pattern never matches
// that shape since "npx" is followed by a quote, not whitespace, so this pulls the runner
// and package out of the two JSON fields independently and requires them to appear near
// each other (loose proximity, not full JSON parsing — good enough for real READMEs).
const JSON_COMMAND_PATTERN = /"command"\s*:\s*"(npx|uvx|bunx)"/;
const JSON_ARGS_PATTERN = /"args"\s*:\s*\[([^\]]*)\]/;
const JSON_FIELD_PROXIMITY = 300;
// Package name must start with an alphanumeric or `@` (scoped) so a bare "." or "-foo"
// (e.g. from a local "pip install ." dev-setup instruction) can never match.
const PIP_PATTERN = /\bpip install\s+([@a-zA-Z0-9][a-zA-Z0-9._-]*)/;
const URL_PATTERN = /https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/;

/**
 * Hosts that show up in descriptions/READMEs as badges, repo links, or our own listing/verify
 * links — never the server's own remote MCP endpoint. Without `allmcps.com` here, a listing
 * that has added the AllMCPs "Verified" badge to its README (badge markdown links back to
 * `allmcps.com/mcp/<id>?verify=...`) gets that badge link mistaken for its install endpoint —
 * confidently wrong, and it would only get more common as badge adoption grows.
 */
const NON_ENDPOINT_HOSTS = [
  'glama.ai',
  'github.com',
  'npmjs.com',
  'pypi.org',
  'allmcps.com',
  // The spec/docs site. Thousands of READMEs link it ("built on the Model Context
  // Protocol"), and it was the single most common URL cached as a listing's own endpoint.
  'modelcontextprotocol.io',
];

function isNonEndpointHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return NON_ENDPOINT_HOSTS.some(
    (h) => host === h || host.endsWith(`.${h}`) || host === `www.${h}`,
  );
}

/**
 * Does this URL actually look like an MCP endpoint, as opposed to a page a human reads?
 *
 * A URL appearing in a README or description is almost never the server's endpoint — it's
 * a homepage, a signup page, a docs link. Treating any such URL as an endpoint is how a
 * marketing page ends up encoded into a one-click "Add to Cursor" button, pointing a
 * client at a host that speaks HTML, not MCP. So a URL has to carry a positive endpoint
 * signal (an /mcp, /sse or /message path segment, or an api./mcp./sse. host) before any
 * caller may present it as somewhere to connect.
 */
export function looksLikeMcpEndpointUrl(raw: string): boolean {
  if (!raw) return false;
  // Markdown/link punctuation means this is a fragment of a README link, not something
  // a client can connect to. Worth rejecting up front because such a fragment often ends
  // in a real-looking path — "https://img.shields.io/badge/x)](https://y.dev/api/mcp"
  // parses as a URL whose pathname ends in /api/mcp, and would otherwise pass below.
  if (/[\s<>"'`*[\]()]/.test(raw)) return false;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (isNonEndpointHost(u.hostname)) return false;
    // A .well-known document *describes* a server (e.g. /.well-known/mcp/server-card.json);
    // it is not a transport a client can speak MCP over. It sits under an /mcp/ path on an
    // mcp.* host, so it clears every other bar here while being the one URL on the page
    // guaranteed to be the wrong thing to hand a client.
    if (/(^|\/)\.well-known(\/|$)/i.test(u.pathname)) return false;
    return (
      /(^|\/)(mcp|sse|message|messages)(\/|$)/i.test(u.pathname) ||
      /^(api|mcp|sse)\./i.test(u.hostname)
    );
  } catch {
    return false;
  }
}

/**
 * Package/URL captures come from prose, so a match routinely swallows the sentence's
 * trailing punctuation (e.g. "...run npx -y foo-mcp." → pkg "foo-mcp."). No real
 * package name or URL ends in these characters, so trimming is always safe.
 */
function trimTrailingPunctuation(candidate: string): string {
  return candidate.replace(/[).,;:'"\]]+$/, '');
}

/**
 * Common test-runner/build-tool/linter package names that regularly appear in a README's
 * "Development" or "Testing" section (e.g. `npx vitest`, `npx tsx watch`), plus the MCP
 * ecosystem's own debugging and installer CLIs. The parser has no section awareness, so
 * without this guard those commands get mistaken for "how to install this MCP server" —
 * confidently wrong, since none of these tools ever *are* the MCP server.
 *
 * The MCP entries are the expensive ones. `@modelcontextprotocol/inspector` is the
 * debugging UI every server author is told to test against, and the standard snippet
 * (`npx @modelcontextprotocol/inspector`) appeared in enough READMEs to be cached as the
 * install command for 246 listings — including hosted servers with no npm package at all,
 * whose owners then wrote in to say the setup block on their listing points clients at a
 * dev tool instead of at them. `@smithery/cli`, `add-mcp` and `mcp-get` are installer CLIs
 * that take the real package as an argument; that argument is what we want, never the
 * installer.
 */
const NON_MCP_TOOLING_PACKAGES = new Set([
  // MCP debugging / installer / scaffolding CLIs
  '@modelcontextprotocol/inspector',
  // Third-party rebuilds of the same debugging UI, and the bare word a README heading
  // leaves behind ("Inspector"). A server whose own name contains "inspector" is
  // unaffected — @gridinsoft/mcp-inspector and ghost-inspector-mcp are real listings.
  '@mcpjam/inspector',
  '@mark3labs/mcp-inspector',
  'mcp-inspector',
  'inspector',
  '@modelcontextprotocol/create-server',
  '@modelcontextprotocol/sdk',
  '@smithery/cli',
  'smithery',
  '@anthropic-ai/mcpb',
  'mcpb',
  '@anthropic-ai/claude-code',
  'add-mcp',
  'mcp-get',
  '@michaellatman/mcp-get',
  'mcp-installer',
  'mcp-cli',
  '@wong2/mcp-cli',
  'fastmcp',
  'skills',
  // JS test runners / build tools / linters
  'vitest',
  'jest',
  'mocha',
  'ava',
  'tap',
  'tape',
  'playwright',
  'cypress',
  'tsx',
  'ts-node',
  'ts-node-dev',
  'nodemon',
  'typescript',
  'tsc',
  'eslint',
  'prettier',
  'standard',
  'biome',
  'webpack',
  'rollup',
  'vite',
  'esbuild',
  'parcel',
  'turbo',
  'nx',
  'husky',
  'lint-staged',
  'commitizen',
  'semantic-release',
  'changeset',
  'concurrently',
  'cross-env',
  'rimraf',
  'dotenv',
  'serve',
  'http-server',
  'pm2',
  'depcheck',
  'npm-check-updates',
  // Cloud / platform CLIs a README shows for deploying the server
  'wrangler',
  'vercel',
  'netlify',
  'netlify-cli',
  'firebase',
  'firebase-tools',
  'supabase',
  'prisma',
  '@prisma/client',
  'aws-cdk',
  'sst',
  // Python tooling and libraries
  'uv',
  'pip',
  'pipx',
  'poetry',
  'hatch',
  'twine',
  'setuptools',
  'wheel',
  'ruff',
  'black',
  'mypy',
  'flake8',
  'isort',
  'pytest',
  'tox',
  'coverage',
  'httpx',
  'requests',
  'aiohttp',
  'uvicorn',
  'gunicorn',
  'fastapi',
  'pydantic',
]);

/**
 * Words shaped like a package name that carry no identity: prose swallowed from a sentence
 * ("run npx to install foo" → "to"), placeholders the reader is meant to replace, and names
 * so generic they can only have come from a config *example* rather than from this listing
 * ("mcp", "server", "your-package"). `npx github:owner/repo` also lands here as a bare
 * "github" once tokenised, which is why the github: form is matched explicitly in
 * isPlausibleInstallPackage instead of being lost.
 */
const GENERIC_PACKAGE_NAMES = new Set([
  'mcp',
  'mcp-server',
  'mcpserver',
  'mcp-servers',
  'server',
  'servers',
  'client',
  'package',
  'package-name',
  'your-package',
  'your-server',
  'your-mcp-server',
  'my-mcp-server',
  'example',
  'examples',
  'demo',
  'test',
  'tests',
  'wrapper',
  'args',
  'build',
  'github',
  'gitlab',
  'git',
  'docker',
  'npm',
  'npx',
  'uvx',
  'bunx',
  'pnpm',
  'yarn',
  'bun',
  'node',
  'deno',
  'python',
  'python3',
  'sh',
  'bash',
  'make',
  'path',
  'main',
  'index',
  'dist',
  'src',
  'app',
  'start',
  'run',
  'install',
  'init',
  'add',
  'help',
  'version',
  'latest',
  'name',
  'command',
  // Prose that follows a bare runner mention in a sentence
  'to',
  'the',
  'and',
  'or',
  'with',
  'from',
  'into',
  'in',
  'on',
  'for',
  'your',
  'this',
  'that',
  'it',
  'is',
  'a',
  'an',
  'then',
  'will',
  'can',
  'use',
  'using',
]);

/**
 * Wrapper runners that don't implement a server themselves — they bridge a client to a
 * *remote* one named in the next argument. Caching the wrapper as the package (124
 * listings held a bare "mcp-remote") drops the only part that identifies the server, so
 * these resolve to the endpoint they point at, or to nothing.
 */
const REMOTE_WRAPPER_PACKAGES = new Set([
  'mcp-remote',
  'supergateway',
  '@supercorp-ai/supergateway',
  'mcp-proxy',
  'mcp-superassistant-proxy',
]);

/**
 * Runner flags that consume the following token as their value, so neither token is the
 * package. `uvx --from <pkg> <entry-point>` is the common one; `npx -p <pkg> <bin>` and
 * `uvx --with <extra-dep> <pkg>` follow the same shape.
 */
const VALUE_TAKING_FLAGS = new Set([
  '--from',
  '--with',
  '--with-editable',
  '--python',
  '-p',
  '--package',
  '--index',
  '--index-url',
  '--extra-index-url',
  '--constraint',
  '-c',
  '--refresh-package',
  '--prerelease',
]);

/**
 * The subset of VALUE_TAKING_FLAGS whose value names the distribution being installed,
 * even though the entry point to run comes later: `uvx --from mcp-server-git mcp-server-git`,
 * `npx -p @scope/tool some-bin`.
 */
const IDENTITY_FLAGS = new Set(['--from', '-p', '--package']);

const PACKAGE_SPEC_PATTERN =
  /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(@[a-z0-9][a-z0-9.^~*+-]*)?$/i;
/**
 * Placeholder prefixes a reader is meant to replace ("your-package-name",
 * "my-mcp-server", "example-server"). Enumerating every spelling in
 * GENERIC_PACKAGE_NAMES is a losing game, and no real MCP server package starts this
 * way — whereas a README example that does is guaranteed to be uninstallable.
 */
const PLACEHOLDER_PACKAGE_PATTERN =
  /^(your|my|some|any|replace|change|insert|example|sample|foo|bar|placeholder)[-_.]/i;

const REPO_SPEC_PATTERN = /^(github|gitlab|bitbucket):[\w.-]+\/[\w.-]+$/i;

/** `@scope/name@1.2.3` → `@scope/name`; `pkg@latest` → `pkg`. */
function stripVersionSpec(spec: string): string {
  const at = spec.lastIndexOf('@');
  return at > 0 ? spec.slice(0, at) : spec;
}

/**
 * Is this string a package a client could actually be told to run as this listing's MCP
 * server? Exported because the same bar has to apply on the way *out* of the cache as on
 * the way in: thousands of rows were written by the older parser, and a cached value
 * outranks every other source in resolveInstallConfig, so a read-side re-check is what
 * stops them rendering install blocks before any backfill runs — the same self-healing
 * pattern looksLikeMcpEndpointUrl already provides for cached remote URLs.
 */
export function isPlausibleInstallPackage(raw: string): boolean {
  const candidate = trimTrailingPunctuation((raw || '').trim());
  if (!candidate) return false;
  if (REPO_SPEC_PATTERN.test(candidate)) return true;
  if (!PACKAGE_SPEC_PATTERN.test(candidate)) return false;
  const bare = stripVersionSpec(candidate).toLowerCase();
  if (NON_MCP_TOOLING_PACKAGES.has(bare)) return false;
  if (GENERIC_PACKAGE_NAMES.has(bare)) return false;
  if (PLACEHOLDER_PACKAGE_PATTERN.test(bare.replace(/^@[^/]+\//, ''))) {
    return false;
  }
  return true;
}

type TokenSelection =
  | { kind: 'package'; index: number; package: string; installable: string }
  | { kind: 'remote'; url: string }
  | null;

/**
 * Walk a runner's argument tokens and pick out what it actually installs: skip flags (and
 * the values of flags that take one), stop at the first real package spec, and follow a
 * remote-wrapper package to the endpoint it bridges to. Returns null when the tokens hold
 * nothing usable — which callers must treat as "no hint here", never as a reason to guess.
 */
function selectFromTokens(tokens: string[]): TokenSelection {
  let installable: string | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    if (token.startsWith('-')) {
      if (VALUE_TAKING_FLAGS.has(token.toLowerCase())) {
        const value = trimTrailingPunctuation(tokens[i + 1] || '');
        // These flags name the distribution being installed even though the entry point
        // comes later, so remember the value as the installable identity.
        if (
          IDENTITY_FLAGS.has(token.toLowerCase()) &&
          isPlausibleInstallPackage(value)
        ) {
          installable = value;
        }
        i++;
      }
      continue;
    }

    const candidate = trimTrailingPunctuation(token);
    if (!candidate) continue;

    const bare = stripVersionSpec(candidate).toLowerCase();
    if (REMOTE_WRAPPER_PACKAGES.has(bare)) {
      for (const rest of tokens.slice(i + 1)) {
        const url = trimTrailingPunctuation(rest);
        if (looksLikeMcpEndpointUrl(url)) return { kind: 'remote', url };
      }
      // A bridge with no endpoint behind it identifies nothing.
      return null;
    }

    if (!isPlausibleInstallPackage(candidate)) return null;
    return {
      kind: 'package',
      index: i,
      package: candidate,
      installable: installable || candidate,
    };
  }

  return null;
}

/** Split a shell fragment into argument tokens, dropping quoting and markdown fencing. */
function tokenizeArgs(rest: string): string[] {
  return rest.match(/[^\s`'"\\]+/g) || [];
}

/**
 * Extracts a runner + package from a JSON `mcpServers`-style config block, e.g.
 * `"command": "npx", "args": ["-y", "some-package"]`. The two fields are matched
 * independently and required to fall within JSON_FIELD_PROXIMITY of each other, so an
 * unrelated "args" array elsewhere in a long README (a different tool's example, say)
 * doesn't get paired with this one's "command".
 */
function parseJsonConfigHint(text: string): ParsedInstallHint {
  const cmdMatch = text.match(JSON_COMMAND_PATTERN);
  const argsMatch = text.match(JSON_ARGS_PATTERN);
  if (!cmdMatch || !argsMatch) return null;
  if (
    Math.abs((argsMatch.index ?? 0) - (cmdMatch.index ?? 0)) >
    JSON_FIELD_PROXIMITY
  )
    return null;

  const rawArgs = Array.from(argsMatch[1].matchAll(/"([^"]*)"/g)).map(
    (m) => m[1],
  );
  if (rawArgs.length === 0) return null;

  const selection = selectFromTokens(rawArgs);
  if (!selection) return null;
  if (selection.kind === 'remote') return { url: selection.url };

  return {
    command: cmdMatch[1],
    args: rawArgs.slice(0, selection.index).concat(selection.package),
    package: selection.installable,
  };
}

/**
 * Best-effort extraction of an install command from a directory server's free-text
 * description. Returns null when nothing recognizable is found — callers must treat
 * that as "ask the user," never fall back to a guess.
 */
export function parseInstallHint(description: string): ParsedInstallHint {
  if (!description) return null;

  // Every runner invocation, not just the first: a README that opens with
  // `npx @modelcontextprotocol/inspector` under "Testing" and gives the real command
  // further down used to resolve to the Inspector and stop looking.
  for (const match of description.matchAll(RUNNER_INVOCATION_PATTERN)) {
    const tokens = tokenizeArgs(match[2] || '');
    const selection = selectFromTokens(tokens);
    if (!selection) continue;
    if (selection.kind === 'remote') return { url: selection.url };

    const args = tokens.slice(0, selection.index).concat(selection.package);
    // npx needs -y to run non-interactively; a README that omits it (or writes the
    // command mid-sentence) still means the same install.
    if (match[1] === 'npx' && !args.some((a) => a === '-y' || a === '--yes')) {
      args.unshift('-y');
    }
    return { command: match[1], args, package: selection.installable };
  }

  const jsonHint = parseJsonConfigHint(description);
  if (jsonHint) return jsonHint;

  // "pip install X" describes how to *obtain* the package, not how to *run* it as an
  // MCP stdio server — using "pip"/"install" verbatim as the launch command spawns a
  // process that installs the package and exits immediately, never a running server.
  // `uvx <package>` is the standard way to run a Python package's console-script entry
  // point without a separate install step, so treat this the same as an explicit uvx hint.
  const pipMatch = description.match(PIP_PATTERN);
  if (pipMatch) {
    const pkg = trimTrailingPunctuation(pipMatch[1]);
    if (isPlausibleInstallPackage(pkg)) return { command: 'uvx', args: [pkg] };
  }

  // Every URL in the text, not just the first one: a description commonly leads with a
  // homepage or signup link and mentions the actual endpoint later, and the first match
  // winning meant the homepage was cached as the endpoint. An endpoint-shaped URL
  // anywhere in the text beats a non-endpoint one at the front.
  for (const match of description.matchAll(new RegExp(URL_PATTERN, 'g'))) {
    const candidate = trimTrailingPunctuation(match[0]);
    if (looksLikeMcpEndpointUrl(candidate)) {
      return { url: candidate };
    }
  }

  return null;
}

export function isRemoteHint(hint: ParsedInstallHint): hint is RemoteHint {
  return !!hint && 'url' in hint;
}
