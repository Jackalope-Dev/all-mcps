import { githubRepoSlug } from './repoUrl';

/**
 * Registry status of a listing's install package — the stale sweep's two hard
 * signals: deprecated, or gone. Only a definite answer counts: a timeout, rate
 * limit or 5xx returns `unknown` and changes nothing (same rule as the
 * auto-promote liveness check, where only 404/410 mean gone).
 */

/**
 * `repo` is the GitHub `owner/repo` the package's own metadata points at, or
 * null when it names none — compared against the listing's repo to catch a
 * listing that installs someone else's package.
 */
export type RegistryStatus =
  | { kind: 'ok'; repo?: string | null }
  | { kind: 'deprecated'; message: string; repo?: string | null }
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

/**
 * The npm package a listing actually installs, or null when it isn't an npm
 * install. Never falls back to the listing name: a PyPI server or a generic
 * name ("github", "memory") would pick up an unrelated npm package's download
 * count, which then feeds indexability and the stale sweep's traction check.
 */
export function npmPackageFor(listing: {
  installCommand?: string | null;
  installPackage?: string | null;
}): string | null {
  if (registryFor(listing.installCommand) !== 'npm') return null;
  const pkg = listing.installPackage?.trim();
  return pkg ? bareName(pkg) : null;
}

/**
 * Whether an install's args run the package and nothing else (`npx -y pkg`).
 * Anything more (`--actors acme/scanner`, a URL, `--from pkg[mcp]`) is a
 * launcher configured for this listing, which is legitimate even when the
 * launcher package belongs to another project.
 */
export function runsBarePackage(
  args: readonly string[] | null | undefined,
  pkg: string,
): boolean {
  const name = bareName(pkg).toLowerCase();
  return (args ?? []).every(
    (a) => a === '-y' || a === '--yes' || bareName(a).toLowerCase() === name,
  );
}

/** Strip a trailing @version / ==version, keeping a leading @scope. */
export function bareName(pkg: string): string {
  return pkg
    .trim()
    .replace(/(?<=.)@[^/@\s]*$/, '')
    .replace(/==.*$/, '');
}

type NpmRepo = string | { url?: unknown } | undefined;
type NpmVersion = { deprecated?: unknown; repository?: NpmRepo };

/** npm packument → status. Deprecation is per version; the dist-tag `latest` is what users get. */
export function npmStatusFromDoc(doc: unknown): RegistryStatus {
  const d = doc as {
    'dist-tags'?: { latest?: string };
    versions?: Record<string, NpmVersion>;
    repository?: NpmRepo;
    time?: { unpublished?: unknown };
  };
  if (d?.time?.unpublished) return { kind: 'missing' };
  const latest = d?.['dist-tags']?.latest;
  return npmVersionStatus(
    latest ? d.versions?.[latest] : undefined,
    d?.repository,
  );
}

/**
 * One version's manifest (what `/<name>/latest` returns) → status. The
 * packument's top-level repository stands in when the version names none.
 */
function npmVersionStatus(
  version: NpmVersion | undefined,
  fallbackRepo?: NpmRepo,
): RegistryStatus {
  const repoField = version?.repository ?? fallbackRepo;
  const repo = githubRepoSlug(
    typeof repoField === 'string'
      ? repoField
      : typeof repoField?.url === 'string'
        ? repoField.url
        : null,
  );
  const dep = version?.deprecated;
  if (typeof dep === 'string' && dep.trim())
    return { kind: 'deprecated', message: dep.trim().slice(0, 300), repo };
  return { kind: 'ok', repo };
}

/** PyPI JSON → status. A yanked latest release is PyPI's deprecation. */
export function pypiStatusFromDoc(doc: unknown): RegistryStatus {
  const d = doc as {
    info?: {
      yanked?: boolean;
      yanked_reason?: string | null;
      home_page?: string | null;
      project_urls?: Record<string, string> | null;
    };
  };
  // PyPI has no single repository field; the first GitHub link wins, with
  // the conventional source keys checked before Homepage.
  // Keys are free-form, so match them case-insensitively, and only the ones
  // that conventionally mean "source": a Funding or Docs link is not it.
  const urls = new Map(
    Object.entries(d?.info?.project_urls ?? {}).map(([k, v]) => [
      k.toLowerCase(),
      v,
    ]),
  );
  const ordered = [
    urls.get('source'),
    urls.get('repository'),
    urls.get('source code'),
    urls.get('code'),
    urls.get('github'),
    urls.get('homepage'),
    d?.info?.home_page,
  ];
  let repo: string | null = null;
  for (const u of ordered) {
    repo = githubRepoSlug(u);
    if (repo) break;
  }
  if (d?.info?.yanked) {
    return {
      kind: 'deprecated',
      message: (d.info.yanked_reason || 'Latest release yanked').slice(0, 300),
      repo,
    };
  }
  return { kind: 'ok', repo };
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
  return (
    (await packageOwnership(installCommand, installPackage, listingUrl)) ===
    true
  );
}

/**
 * packageOwnedByListing's rule, but null when the registry couldn't be asked
 * (no registry, non-GitHub listing, or a registry hiccup) instead of false —
 * for callers that should keep what they have rather than treat a timeout as
 * "not theirs".
 */
export async function packageOwnership(
  installCommand: string | null | undefined,
  installPackage: string | null | undefined,
  listingUrl: string | null | undefined,
): Promise<boolean | null> {
  const facts = await registryFacts(installCommand, installPackage, listingUrl);
  if (!facts) return null;
  if (facts.missing) return false;
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
      ? `https://registry.npmjs.org/${name.replaceAll('/', '%2F')}/latest`
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
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return null;
    }
    const doc = await readJsonCapped(res);
    if (doc === undefined) return null;
    const repos = sourceReposFromDoc(registry, doc);
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

/**
 * Largest registry document we parse. A full npm packument carries every
 * version's manifest (and often every README): tens of MB for a long-lived
 * package, several times that once parsed. The stale sweep reads eight at a
 * time, which pushed the jobs Worker over its memory limit. The documents we
 * actually need (npm `/latest`, a PyPI project) are far under this.
 */
const MAX_REGISTRY_DOC_BYTES = 1_000_000;

/**
 * The response body parsed as JSON, or undefined when it is larger than
 * `maxBytes` (the download is cancelled there, never buffered whole) or isn't
 * JSON.
 */
async function readJsonCapped(
  res: Response,
  maxBytes: number = MAX_REGISTRY_DOC_BYTES,
): Promise<unknown> {
  const declared = Number(res.headers.get('content-length'));
  if (!res.body || (Number.isFinite(declared) && declared > maxBytes)) {
    await res.body?.cancel().catch(() => {});
    return undefined;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return undefined;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

async function fetchRegistry(url: string): Promise<Response> {
  return fetch(url, {
    headers: { 'User-Agent': 'AllMCPs-Stale-Sweep' },
    signal: AbortSignal.timeout(8000),
  });
}

/**
 * npm: the `latest` version's manifest (a few KB) rather than the packument.
 * Only when that 404s is the packument read, to tell an unpublished package
 * (gone) from one without a `latest` tag.
 */
async function checkNpm(name: string): Promise<RegistryStatus> {
  const base = `https://registry.npmjs.org/${name.replaceAll('/', '%2F')}`;
  const res = await fetchRegistry(`${base}/latest`);
  if (res.ok) {
    const doc = await readJsonCapped(res);
    return doc === undefined
      ? { kind: 'unknown' }
      : npmVersionStatus(doc as NpmVersion);
  }
  await res.body?.cancel().catch(() => {});
  if (res.status !== 404 && res.status !== 410) return { kind: 'unknown' };
  const full = await fetchRegistry(base);
  if (full.status === 404 || full.status === 410) {
    await full.body?.cancel().catch(() => {});
    return { kind: 'missing' };
  }
  if (!full.ok) {
    await full.body?.cancel().catch(() => {});
    return { kind: 'unknown' };
  }
  const doc = await readJsonCapped(full);
  return doc === undefined ? { kind: 'unknown' } : npmStatusFromDoc(doc);
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
  try {
    if (registry === 'npm') return await checkNpm(name);
    const res = await fetchRegistry(
      `https://pypi.org/pypi/${encodeURIComponent(name)}/json`,
    );
    if (res.status === 404 || res.status === 410) {
      await res.body?.cancel().catch(() => {});
      return { kind: 'missing' };
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return { kind: 'unknown' };
    }
    // A project with a long release history can outgrow the cap; that
    // answer is unknown, which changes nothing.
    const doc = await readJsonCapped(res);
    return doc === undefined ? { kind: 'unknown' } : pypiStatusFromDoc(doc);
  } catch {
    return { kind: 'unknown' };
  }
}
