/**
 * Registry status of a listing's install package — the stale sweep's two hard
 * signals: deprecated, or gone. Only a definite answer counts: a timeout, rate
 * limit or 5xx returns `unknown` and changes nothing (same rule as the
 * auto-promote liveness check, where only 404/410 mean gone).
 */

export type RegistryStatus =
  | { kind: 'ok' }
  | { kind: 'deprecated'; message: string }
  | { kind: 'missing' }
  | { kind: 'unknown' };

export function registryFor(
  installCommand: string | null | undefined,
): 'npm' | 'pypi' | null {
  const cmd = (installCommand || '').toLowerCase();
  if (cmd === 'npx' || cmd === 'bunx' || cmd === 'npm') return 'npm';
  if (cmd === 'uvx' || cmd === 'pip' || cmd === 'pipx' || cmd === 'pip3')
    return 'pypi';
  return null;
}

/** Strip a trailing @version / ==version, keeping a leading @scope. */
export function bareName(pkg: string): string {
  return pkg
    .trim()
    .replace(/(?<=.)@[^/@\s]*$/, '')
    .replace(/==.*$/, '');
}

/** npm packument → status. Deprecation is per version; the dist-tag `latest` is what users get. */
export function npmStatusFromDoc(doc: unknown): RegistryStatus {
  const d = doc as {
    'dist-tags'?: { latest?: string };
    versions?: Record<string, { deprecated?: unknown }>;
    time?: { unpublished?: unknown };
  };
  if (d?.time?.unpublished) return { kind: 'missing' };
  const latest = d?.['dist-tags']?.latest;
  const dep = latest ? d.versions?.[latest]?.deprecated : undefined;
  if (typeof dep === 'string' && dep.trim())
    return { kind: 'deprecated', message: dep.trim().slice(0, 300) };
  return { kind: 'ok' };
}

/** PyPI JSON → status. A yanked latest release is PyPI's deprecation. */
export function pypiStatusFromDoc(doc: unknown): RegistryStatus {
  const d = doc as {
    info?: { yanked?: boolean; yanked_reason?: string | null };
  };
  if (d?.info?.yanked) {
    return {
      kind: 'deprecated',
      message: (d.info.yanked_reason || 'Latest release yanked').slice(0, 300),
    };
  }
  return { kind: 'ok' };
}

type GithubRepoRef = { owner: string; repo: string };

function githubRepoRef(raw: unknown): GithubRepoRef | null {
  if (typeof raw !== 'string') return null;
  const m = raw.match(/github\.com[/:]([^/\s#?]+)\/([^/\s#?]+)/i);
  if (!m) return null;
  return {
    owner: m[1].toLowerCase(),
    repo: m[2].toLowerCase().replace(/\.git$/, ''),
  };
}

/** GitHub repos a registry document names as the package's source (npm `/latest` doc or PyPI JSON). */
export function sourceReposFromDoc(
  registry: 'npm' | 'pypi',
  doc: unknown,
): GithubRepoRef[] {
  const d = doc as {
    repository?: string | { url?: string };
    homepage?: string;
    bugs?: { url?: string };
    info?: { home_page?: string; project_urls?: Record<string, string> };
  };
  const links =
    registry === 'npm'
      ? [
          typeof d?.repository === 'string' ? d.repository : d?.repository?.url,
          d?.homepage,
          d?.bugs?.url,
        ]
      : [d?.info?.home_page, ...Object.values(d?.info?.project_urls ?? {})];
  return links.map(githubRepoRef).filter((r): r is GithubRepoRef => !!r);
}

/**
 * True only when the registry proves a stdio package is not this listing's:
 * it doesn't exist, or every source repo it names differs from the listing's
 * repo in both owner and name (one of the two matching covers renamed orgs
 * and moved repos). No source metadata, a non-GitHub listing, or a registry
 * hiccup all return false — absence of evidence keeps the candidate.
 *
 * READMEs routinely show other servers' install commands (an example config,
 * a dependency, a catalog entry), and a sole candidate is taken without the
 * LLM ever seeing it — this is what kept @modelcontextprotocol/server-filesystem
 * on audit tools and BotHire's package on the AON listing.
 */
export async function packageBelongsElsewhere(
  installCommand: string | null | undefined,
  installPackage: string | null | undefined,
  listingUrl: string | null | undefined,
): Promise<boolean> {
  const facts = await registryFacts(installCommand, installPackage, listingUrl);
  if (!facts) return false;
  if (facts.missing) return true;
  // A package named exactly like the listing's repo is its own, whatever
  // account published it (geolabel/geolabel-mcp ships `geolabel-mcp`).
  if (facts.nameMatch) return false;
  return facts.hasSource && !facts.sourceMatch;
}

/**
 * Stricter than !packageBelongsElsewhere, for packages we propose rather than
 * ones a README already shows: published, and its source repo is the
 * listing's — or, when it names no source at all, it carries the repo's name.
 * A same-named package whose metadata points elsewhere is a stranger's.
 */
export async function packageOwnedByListing(
  installCommand: string | null | undefined,
  installPackage: string | null | undefined,
  listingUrl: string | null | undefined,
): Promise<boolean> {
  const facts = await registryFacts(installCommand, installPackage, listingUrl);
  if (!facts || facts.missing) return false;
  return facts.sourceMatch || (facts.nameMatch && !facts.hasSource);
}

type RegistryFacts = {
  missing: boolean;
  hasSource: boolean;
  /** A named source repo shares the listing's owner or repo name. */
  sourceMatch: boolean;
  /** The package (scope dropped) is named exactly like the listing's repo. */
  nameMatch: boolean;
};

/** Null when the question doesn't apply (no registry, non-GitHub listing) or the registry didn't answer. */
async function registryFacts(
  installCommand: string | null | undefined,
  installPackage: string | null | undefined,
  listingUrl: string | null | undefined,
): Promise<RegistryFacts | null> {
  const registry = registryFor(installCommand);
  const listing = githubRepoRef(listingUrl);
  const raw = (installPackage || '').trim();
  if (!registry || !listing || !raw || raw.includes('://') || /\s/.test(raw))
    return null;
  const name = bareName(raw).replace(/\[.*\]$/, '');
  const url =
    registry === 'npm'
      ? `https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`
      : `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;
  const nameMatch =
    name.replace(/^@[^/]+\//, '').toLowerCase() === listing.repo;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AllMCPs-Install-Check' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404 || res.status === 410) {
      return { missing: true, hasSource: false, sourceMatch: false, nameMatch };
    }
    if (!res.ok) return null;
    const repos = sourceReposFromDoc(registry, await res.json());
    return {
      missing: false,
      hasSource: repos.length > 0,
      sourceMatch: repos.some(
        (r) => r.owner === listing.owner || r.repo === listing.repo,
      ),
      nameMatch,
    };
  } catch {
    return null;
  }
}

export async function checkRegistry(
  installCommand: string | null | undefined,
  installPackage: string | null | undefined,
): Promise<RegistryStatus> {
  const registry = registryFor(installCommand);
  const raw = (installPackage || '').trim();
  if (!registry || !raw || raw.includes('://') || /\s/.test(raw))
    return { kind: 'unknown' };
  const name = bareName(raw);
  const url =
    registry === 'npm'
      ? `https://registry.npmjs.org/${name.replace('/', '%2F')}`
      : `https://pypi.org/pypi/${encodeURIComponent(name)}/json`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AllMCPs-Stale-Sweep' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404 || res.status === 410) return { kind: 'missing' };
    if (!res.ok) return { kind: 'unknown' };
    const doc = await res.json();
    return registry === 'npm' ? npmStatusFromDoc(doc) : pypiStatusFromDoc(doc);
  } catch {
    return { kind: 'unknown' };
  }
}
