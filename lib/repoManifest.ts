/**
 * Install candidates from a repo's own package manifest (package.json /
 * pyproject.toml) rather than its README prose.
 *
 * The README parser only finds commands someone wrote out. Sampling listings
 * the install pass left empty, 28 of 98 published their own npm/PyPI package
 * that the README never spelled as an `npx`/`uvx` line. These candidates join
 * the README's for Jev to choose among (a package isn't always the MCP server
 * entry point), and the stdio verifier confirms or retires whatever wins.
 */

import { packageOwnedByListing } from './packageRegistry';
import { githubFolderPrefix } from './repoUrl';
import type { InstallHint } from './tools/parseInstallHint';

/** Several entry points are possible per package; Jev chooses among at most this many. */
const MAX_ENTRY_POINTS = 3;

type RepoRef = { owner: string; repo: string };

function githubRepo(url: string | null | undefined): RepoRef | null {
  const m = (url || '').match(
    /^https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:[/#?].*)?$/i,
  );
  return m ? { owner: m[1], repo: m[2] } : null;
}

async function fetchRepoFile(
  { owner, repo }: RepoRef,
  path: string,
): Promise<string | null> {
  try {
    // HEAD resolves to the default branch, whatever it is named.
    const res = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`,
      {
        headers: { 'User-Agent': 'AllMCPs-Enricher' },
        signal: AbortSignal.timeout(8000),
      },
    );
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

const unscoped = (name: string) => name.replace(/^@[^/]+\//, '');

/** `npx` invocations for a package.json, or none when it publishes nothing runnable. */
export function npmCandidates(packageJson: unknown): InstallHint[] {
  const pkg = packageJson as {
    name?: unknown;
    private?: unknown;
    bin?: unknown;
  };
  if (typeof pkg?.name !== 'string' || !pkg.name || pkg.private === true)
    return [];
  const name = pkg.name;
  const bins =
    typeof pkg.bin === 'string'
      ? [unscoped(name)]
      : pkg.bin && typeof pkg.bin === 'object'
        ? Object.keys(pkg.bin)
        : [];
  if (bins.length === 0) return [];
  // npx runs the package's bin directly when there is one, or one named after it.
  if (bins.length === 1 || bins.includes(unscoped(name))) {
    return [{ command: 'npx', args: ['-y', name], package: name }];
  }
  return bins.slice(0, MAX_ENTRY_POINTS).map((bin) => ({
    command: 'npx',
    args: ['-y', '-p', name, bin],
    package: name,
  }));
}

/** Keys of one `[section]` table in a TOML file (flat `key = ...` lines only). */
function tomlSection(toml: string, section: string): Map<string, string> {
  const out = new Map<string, string>();
  let inSection = false;
  for (const line of toml.split(/\r?\n/)) {
    const header = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (header) {
      inSection = header[1].trim() === section;
      continue;
    }
    if (!inSection) continue;
    const kv = line.match(
      /^\s*["']?([A-Za-z0-9_.-]+)["']?\s*=\s*["']([^"']*)["']/,
    );
    if (kv) out.set(kv[1], kv[2]);
  }
  return out;
}

const normalizePy = (name: string) =>
  name.toLowerCase().replace(/[-_.]+/g, '-');

/** `uvx` invocations for a pyproject.toml (PEP 621 or Poetry), or none without an entry point. */
export function pypiCandidates(pyproject: string): InstallHint[] {
  const name =
    tomlSection(pyproject, 'project').get('name') ||
    tomlSection(pyproject, 'tool.poetry').get('name');
  if (!name) return [];
  const scripts = [
    ...tomlSection(pyproject, 'project.scripts').keys(),
    ...tomlSection(pyproject, 'tool.poetry.scripts').keys(),
  ];
  if (scripts.length === 0) return [];
  // uvx runs the entry point named after the package; any other needs --from.
  if (scripts.some((s) => normalizePy(s) === normalizePy(name))) {
    return [{ command: 'uvx', args: [name], package: name }];
  }
  return [...new Set(scripts)].slice(0, MAX_ENTRY_POINTS).map((script) => ({
    command: 'uvx',
    args: ['--from', name, script],
    package: name,
  }));
}

/**
 * Candidates from the listing's manifests (its monorepo folder's, if any) whose package the
 * registry confirms is published from this repo (packageOwnedByListing) —
 * a manifest name alone could collide with a stranger's package.
 */
export async function manifestInstallCandidates(
  listingUrl: string | null | undefined,
): Promise<InstallHint[]> {
  const repo = githubRepo(listingUrl);
  if (!repo) return [];
  // A monorepo deep link's manifests are in its own folder; the root ones
  // describe the monorepo (often a private workspace), not this server.
  const folder = githubFolderPrefix(listingUrl);
  const [packageJson, pyproject] = await Promise.all([
    fetchRepoFile(repo, `${folder}package.json`),
    fetchRepoFile(repo, `${folder}pyproject.toml`),
  ]);
  const candidates: InstallHint[] = [];
  if (packageJson) {
    try {
      candidates.push(...npmCandidates(JSON.parse(packageJson)));
    } catch {
      /* not JSON */
    }
  }
  if (pyproject) candidates.push(...pypiCandidates(pyproject));
  if (candidates.length === 0) return [];

  // Every candidate of one manifest shares a package; ask the registry once each.
  const owned = new Map<string, Promise<boolean>>();
  const ownedFor = (hint: InstallHint) => {
    const key = `${hint.command}:${hint.package}`;
    if (!owned.has(key)) {
      owned.set(
        key,
        packageOwnedByListing(hint.command, hint.package, listingUrl),
      );
    }
    return owned.get(key) as Promise<boolean>;
  };
  const keep = await Promise.all(candidates.map(ownedFor));
  return candidates.filter((_, i) => keep[i]);
}
