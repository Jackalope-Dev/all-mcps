export interface InstallHint {
  command: string;
  args: string[];
}

export interface RemoteHint {
  url: string;
}

export type ParsedInstallHint = InstallHint | RemoteHint | null;

const RUNNER_PATTERN = /\b(npx|uvx|bunx)\s+(-y\s+)?([@a-zA-Z0-9._/-]+)/;
// Many READMEs show the launch command as a JSON `mcpServers` config block (the format
// Claude Desktop / Cursor docs recommend) instead of a shell one-liner, e.g.
// `"command": "npx", "args": ["-y", "some-package"]`. RUNNER_PATTERN never matches that
// shape since "npx" is followed by a quote, not whitespace, so this pulls the runner and
// package out of the two JSON fields independently and requires them to appear near each
// other (loose proximity, not full JSON parsing — good enough for real-world READMEs).
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
const NON_ENDPOINT_HOSTS = ['glama.ai', 'github.com', 'npmjs.com', 'pypi.org', 'allmcps.com'];

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
 * "Development" or "Testing" section (e.g. `npx vitest`, `npx tsx watch`). RUNNER_PATTERN
 * matches the first npx/uvx/bunx invocation anywhere in the text with no section awareness,
 * so without this guard those dev-tooling commands get mistaken for "how to install this
 * MCP server" — confidently wrong, since none of these tools ever *are* the MCP server.
 */
const NON_MCP_TOOLING_PACKAGES = new Set([
  'vitest', 'jest', 'mocha', 'ava', 'tap', 'tape', 'playwright', 'cypress',
  'tsx', 'ts-node', 'ts-node-dev', 'nodemon', 'typescript', 'tsc',
  'eslint', 'prettier', 'standard', 'biome',
  'webpack', 'rollup', 'vite', 'esbuild', 'parcel', 'turbo', 'nx',
  'husky', 'lint-staged', 'commitizen', 'semantic-release', 'changeset',
  'concurrently', 'cross-env', 'rimraf', 'dotenv',
]);

/**
 * Extracts a runner + package from a JSON `mcpServers`-style config block, e.g.
 * `"command": "npx", "args": ["-y", "some-package"]`. The two fields are matched
 * independently and required to fall within JSON_FIELD_PROXIMITY of each other, so an
 * unrelated "args" array elsewhere in a long README (a different tool's example, say)
 * doesn't get paired with this one's "command".
 */
function parseJsonConfigHint(text: string): InstallHint | null {
  const cmdMatch = text.match(JSON_COMMAND_PATTERN);
  const argsMatch = text.match(JSON_ARGS_PATTERN);
  if (!cmdMatch || !argsMatch) return null;
  if (Math.abs((argsMatch.index ?? 0) - (cmdMatch.index ?? 0)) > JSON_FIELD_PROXIMITY) return null;

  const rawArgs = Array.from(argsMatch[1].matchAll(/"([^"]*)"/g)).map((m) => m[1]);
  if (rawArgs.length === 0) return null;

  const lastIdx = rawArgs.length - 1;
  const pkg = trimTrailingPunctuation(rawArgs[lastIdx]);
  if (!pkg || NON_MCP_TOOLING_PACKAGES.has(pkg.toLowerCase())) return null;

  const runner = cmdMatch[1];
  const args = rawArgs.slice(0, lastIdx).concat(pkg);
  return { command: runner, args };
}

/**
 * Best-effort extraction of an install command from a directory server's free-text
 * description. Returns null when nothing recognizable is found — callers must treat
 * that as "ask the user," never fall back to a guess.
 */
export function parseInstallHint(description: string): ParsedInstallHint {
  if (!description) return null;

  const runnerMatch = description.match(RUNNER_PATTERN);
  if (runnerMatch) {
    const [, runner, , rawPkg] = runnerMatch;
    const pkg = trimTrailingPunctuation(rawPkg);
    if (pkg && !NON_MCP_TOOLING_PACKAGES.has(pkg.toLowerCase())) {
      const args = runner === 'npx' ? ['-y', pkg] : [pkg];
      return { command: runner, args };
    }
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
    if (pkg) return { command: 'uvx', args: [pkg] };
  }

  const urlMatch = description.match(URL_PATTERN);
  if (urlMatch) {
    const candidate = trimTrailingPunctuation(urlMatch[0]);
    const isNonEndpoint = NON_ENDPOINT_HOSTS.some((host) => candidate.includes(host));
    if (!isNonEndpoint) {
      return { url: candidate };
    }
  }

  return null;
}

export function isRemoteHint(hint: ParsedInstallHint): hint is RemoteHint {
  return !!hint && 'url' in hint;
}
