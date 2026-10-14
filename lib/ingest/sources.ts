/**
 * Pure parsing and quality rules for catalog ingest: turning a source's raw
 * payload (official registry JSON, an awesome-list README, npm search, GitHub
 * topic search) into candidate listings. No network or database here, so the
 * rules that decide what may enter the catalog are unit-tested.
 *
 * Ported from scripts/ingest-sources.mjs, which stays as a manual backup run.
 * Network fetchers live in ./fetchSources.ts; dedupe and insert in ./run.ts.
 */

/** listing_signals.discovered_via values. */
type DiscoveredVia =
  | 'official-registry'
  | 'awesome-list'
  | 'npm'
  | 'pypi'
  | 'github-topic'
  | 'submission';

export type IngestCandidate = {
  name: string;
  url: string;
  description: string;
  /** Raw category hint from the source (awesome-list heading), if any. */
  category?: string;
  websiteUrl?: string;
  source: DiscoveredVia;
  githubStars?: number;
  /** stdio package the publisher declared (registry packages, npm). */
  installCommand?: 'npx' | 'uvx';
  installPackage?: string;
  remoteEndpointUrl?: string;
  /** Known from the source (GitHub search) or filled in by the GitHub lookup in run.ts. */
  archived?: boolean;
  fork?: boolean;
};

function stripHtml(input: string): string {
  let s = input || '';
  let prev = '';
  while (s !== prev) {
    prev = s;
    s = s.replace(/<[^>]*>/g, '');
  }
  return s;
}

// --- awesome-list READMEs ---------------------------------------------------

export type ReadmeSource = {
  name: string;
  readmeUrl: string;
  /** Only the ## section whose heading matches lists servers. */
  sectionHeadingMatch: (heading: string) => boolean;
  /** Resolves repo-relative item links (reference servers). */
  baseTreeUrl?: string;
  skipCategory?: (category: string) => boolean;
};

export const README_SOURCES: ReadmeSource[] = [
  {
    name: 'awesome-mcp-servers',
    readmeUrl:
      'https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/HEAD/README.md',
    // The README also has Clients, Tutorials, Community… sections in the same
    // bullet-link format; only this one lists servers.
    sectionHeadingMatch: (text) => /server implementations/i.test(text),
  },
  {
    name: 'modelcontextprotocol/servers',
    readmeUrl:
      'https://raw.githubusercontent.com/modelcontextprotocol/servers/HEAD/README.md',
    baseTreeUrl: 'https://github.com/modelcontextprotocol/servers/tree/main/',
    sectionHeadingMatch: (text) => /reference servers/i.test(text),
    // Deprecated/unmaintained reference servers.
    skipCategory: (category) => /archived/i.test(category),
  },
];

const HEADING_RE = /^(#{2,4})\s+(.*)$/;
const ITEM_RE =
  /^[-*]\s*(?:\*\*)?\[([^\]]+)\]\(([^)]+)\)(?:\*\*)?\s*(?:[-–—:])?\s*(.*)$/;

export function parseServerList(
  markdown: string,
  source: ReadmeSource,
): IngestCandidate[] {
  const entries: IngestCandidate[] = [];
  let currentCategory = 'Other';
  let inSection = false;
  let skipCurrentCategory = false;

  for (const line of markdown.split('\n')) {
    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      const cleaned = stripHtml(heading[2]).replace(/[*_`]/g, '').trim();
      if (level === 2) {
        inSection = source.sectionHeadingMatch(cleaned);
        continue;
      }
      if (inSection && cleaned) {
        currentCategory = cleaned;
        skipCurrentCategory = source.skipCategory?.(cleaned) ?? false;
      }
      continue;
    }
    if (!inSection || skipCurrentCategory) continue;

    const match = line.match(ITEM_RE);
    if (!match) continue;
    const name = match[1].trim();
    let url = match[2].trim();
    if (!url || url.startsWith('#')) continue; // TOC anchor
    if (name.toLowerCase().includes('awesome')) continue; // self-referential
    if (!/^https?:\/\//i.test(url)) {
      if (!source.baseTreeUrl) continue;
      url = source.baseTreeUrl + url.replace(/^\.?\//, '');
    }
    const description = stripHtml(
      (match[3] || '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'),
    )
      .replace(/[*_~`]/g, '')
      .trim();
    entries.push({
      name,
      url,
      description,
      category: currentCategory,
      source: 'awesome-list',
    });
  }
  return entries;
}

// --- official MCP Registry ----------------------------------------------------

/**
 * Publishers often pick a generic leaf ("mcp", "mcp-server") inside their own
 * namespace; 149 pending rows from one run were named just that. Fall back to
 * the GitHub owner/repo.
 */
const GENERIC_REGISTRY_LEAF_NAMES = new Set(['mcp', 'mcp-server', 'server']);

type RegistryServer = {
  name?: string;
  title?: string;
  description?: string;
  websiteUrl?: string;
  repository?: { url?: string };
  packages?: Array<{
    registryType?: string;
    identifier?: string;
    transport?: { type?: string };
  }>;
  remotes?: Array<{ type?: string; url?: string }>;
};

export type RegistryEntry = {
  server?: RegistryServer;
  _meta?: Record<string, { status?: string; isLatest?: boolean } | undefined>;
};

function deriveRegistryName(server: RegistryServer, primaryUrl: string) {
  if (server.title) return server.title;
  const leaf = server.name?.split('/').pop();
  if (leaf && GENERIC_REGISTRY_LEAF_NAMES.has(leaf.toLowerCase())) {
    const m = primaryUrl.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
    if (m) return `${m[1]}/${m[2].replace(/\.git$/i, '')}`;
  }
  return leaf || server.name || '';
}

/** Hosted proxies of someone else's server, not the publisher's own endpoint. */
const PROXY_ENDPOINT_HOSTS = /(^|\.)smithery\.ai$/i;

/**
 * One registry entry → candidate, or null when the registry itself does not
 * consider it active (deprecated/deleted typically means spam, malware or a
 * policy violation) or it has no usable URL.
 */
export function registryEntryToCandidate(
  entry: RegistryEntry,
): IngestCandidate | null {
  const server = entry.server;
  if (!server) return null;
  const official = entry._meta?.['io.modelcontextprotocol.registry/official'];
  if (official?.isLatest === false) return null;
  if (official?.status && official.status !== 'active') return null;

  const primaryUrl = server.repository?.url || server.websiteUrl;
  if (!primaryUrl) return null;
  const name = deriveRegistryName(server, primaryUrl);
  if (!name) return null;

  const candidate: IngestCandidate = {
    name,
    url: primaryUrl,
    description: server.description || '',
    source: 'official-registry',
  };
  if (server.websiteUrl && server.websiteUrl !== primaryUrl) {
    candidate.websiteUrl = server.websiteUrl;
  }

  // The publisher's own package declaration is better evidence than any
  // README parse, and it feeds package-identity dedupe.
  const pkg = server.packages?.find(
    (p) =>
      p.identifier &&
      (p.transport?.type ?? 'stdio') === 'stdio' &&
      (p.registryType === 'npm' || p.registryType === 'pypi'),
  );
  if (pkg?.identifier) {
    candidate.installCommand = pkg.registryType === 'npm' ? 'npx' : 'uvx';
    candidate.installPackage = pkg.identifier;
  }

  const remote = server.remotes?.find(
    (r) => r.url && (r.type === 'streamable-http' || r.type === 'sse'),
  );
  if (remote?.url) {
    try {
      if (!PROXY_ENDPOINT_HOSTS.test(new URL(remote.url).hostname)) {
        candidate.remoteEndpointUrl = remote.url;
      }
    } catch {
      /* unparseable endpoint: ignore */
    }
  }
  return candidate;
}

// --- npm search ---------------------------------------------------------------

export type NpmSearchObject = {
  downloads?: { monthly?: number };
  package?: {
    name?: string;
    description?: string;
    links?: { repository?: string; homepage?: string };
  };
};

/** Monthly downloads an npm-only find needs before it is worth a review. */
const NPM_MIN_MONTHLY_DOWNLOADS = 50;

/** "git+https://github.com/a/b.git" → "https://github.com/a/b". Only GitHub repos count. */
export function githubRepoUrlFrom(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i);
  if (!m) return null;
  const repo = m[2].replace(/\.git$/i, '');
  if (!repo) return null;
  return `https://github.com/${m[1]}/${repo}`;
}

/**
 * npm search hit → candidate. Requires a GitHub repo (the listing's primary
 * URL, and where every later check looks) and a little real use, since the
 * `mcp` keywords are on thousands of SDK helpers and abandoned experiments.
 */
export function npmObjectToCandidate(
  obj: NpmSearchObject,
): IngestCandidate | null {
  const pkg = obj.package;
  if (!pkg?.name) return null;
  if ((obj.downloads?.monthly ?? 0) < NPM_MIN_MONTHLY_DOWNLOADS) return null;
  const url = githubRepoUrlFrom(pkg.links?.repository);
  if (!url) return null;
  const homepage = pkg.links?.homepage;
  return {
    name: pkg.name,
    url,
    description: pkg.description || '',
    websiteUrl:
      homepage && !/github\.com/i.test(homepage) ? homepage : undefined,
    source: 'npm',
    installCommand: 'npx',
    installPackage: pkg.name,
  };
}

// --- GitHub topic search ------------------------------------------------------

export type GithubSearchRepo = {
  name?: string;
  html_url?: string;
  description?: string | null;
  homepage?: string | null;
  stargazers_count?: number;
  archived?: boolean;
  disabled?: boolean;
  fork?: boolean;
};

/** Stars a topic-search find needs; a topic is self-applied and free. */
const GITHUB_TOPIC_MIN_STARS = 5;

export function githubRepoToCandidate(
  repo: GithubSearchRepo,
): IngestCandidate | null {
  if (!repo.html_url || !repo.name) return null;
  if ((repo.stargazers_count ?? 0) < GITHUB_TOPIC_MIN_STARS) return null;
  const homepage = repo.homepage?.trim();
  return {
    name: repo.name,
    url: repo.html_url,
    description: repo.description || '',
    websiteUrl:
      homepage &&
      /^https?:\/\//i.test(homepage) &&
      !/github\.com/i.test(homepage)
        ? homepage
        : undefined,
    source: 'github-topic',
    githubStars: repo.stargazers_count,
    archived: Boolean(repo.archived || repo.disabled),
    fork: Boolean(repo.fork),
  };
}

// --- quality floor --------------------------------------------------------------

/**
 * Names that mark a scaffold or experiment rather than a server, matched as a
 * whole word of the name or repo so "testrail-mcp" and "demographics" pass.
 */
const JUNK_NAME_RE =
  /(^|[^a-z0-9])(test|tests|testing|demo|example|examples|sample|template|boilerplate|starter|hello-?world|playground|tutorial|my-?first)([^a-z0-9]|$)/i;

/**
 * Why a candidate is not worth ingesting, or null when it clears the floor.
 * Applies to every source; the per-source traction floors (npm downloads,
 * topic stars) sit in the converters above.
 */
export function ingestRejectReason(c: IngestCandidate): string | null {
  if (!c.url) return 'no url';
  if (!c.description.trim()) return 'no description';
  if (c.archived) return 'archived repo';
  if (c.fork && (c.githubStars ?? 0) === 0) return 'fork with no stars';
  const repoName = c.url.match(/github\.com\/[^/]+\/([^/#?]+)/i)?.[1] ?? '';
  if (JUNK_NAME_RE.test(c.name) || JUNK_NAME_RE.test(repoName))
    return 'scaffold or demo name';
  return null;
}
