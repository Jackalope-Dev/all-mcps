export interface InstallHint {
  command: string;
  args: string[];
}

export interface RemoteHint {
  url: string;
}

export type ParsedInstallHint = InstallHint | RemoteHint | null;

const RUNNER_PATTERN = /\b(npx|uvx|bunx)\s+(-y\s+)?([@a-zA-Z0-9._/-]+)/;
// Package name must start with an alphanumeric or `@` (scoped) so a bare "." or "-foo"
// (e.g. from a local "pip install ." dev-setup instruction) can never match.
const PIP_PATTERN = /\bpip install\s+([@a-zA-Z0-9][a-zA-Z0-9._-]*)/;
const URL_PATTERN = /https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/;

/** Hosts that show up in descriptions as badges/repo links, not as the server's own remote endpoint. */
const NON_ENDPOINT_HOSTS = ['glama.ai', 'github.com', 'npmjs.com', 'pypi.org'];

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
 * Best-effort extraction of an install command from a directory server's free-text
 * description. Returns null when nothing recognizable is found — callers must treat
 * that as "ask the user," never fall back to a guess.
 */
export function parseInstallHint(description: string): ParsedInstallHint {
  if (!description) return null;

  const runnerMatch = description.match(RUNNER_PATTERN);
  if (runnerMatch) {
    const [, runner, , pkg] = runnerMatch;
    if (!NON_MCP_TOOLING_PACKAGES.has(pkg.toLowerCase())) {
      const args = runner === 'npx' ? ['-y', pkg] : [pkg];
      return { command: runner, args };
    }
  }

  const pipMatch = description.match(PIP_PATTERN);
  if (pipMatch) {
    return { command: 'pip', args: ['install', pipMatch[1]] };
  }

  const urlMatch = description.match(URL_PATTERN);
  if (urlMatch) {
    const candidate = urlMatch[0].replace(/[).,]+$/, '');
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
