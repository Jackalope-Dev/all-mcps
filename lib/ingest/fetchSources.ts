import { githubApiHeaders } from '../githubAuth';
import {
  type GithubSearchRepo,
  githubRepoToCandidate,
  type IngestCandidate,
  type NpmSearchObject,
  npmObjectToCandidate,
  parseServerList,
  README_SOURCES,
  type RegistryEntry,
  registryEntryToCandidate,
} from './sources';

/**
 * Network side of catalog ingest: one function per source, each returning
 * candidates for ./run.ts. All bounded so a tick fits a Worker invocation —
 * a source that fails or times out returns what it collected so far rather
 * than throwing, because the next run picks up anything missed.
 */

const UA = { 'User-Agent': 'AllMCPs-Ingest' };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  retries = 2,
): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { ...UA, ...(init.headers as Record<string, string>) },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) return (await res.json()) as T;
      // A 4xx other than rate limiting will not get better by retrying.
      if (res.status < 500 && res.status !== 429) return null;
    } catch {
      /* retry */
    }
    if (attempt < retries) await sleep(1000 * 2 ** attempt);
  }
  return null;
}

const REGISTRY_BASE = 'https://registry.modelcontextprotocol.io';
/** ~100 entries per page; a day's updates run ~1.3k, so this is generous headroom. */
const REGISTRY_MAX_PAGES = 60;

/**
 * Official registry entries updated since `since`, latest versions only.
 * `updated_since` makes this incremental: a run reads only what changed
 * (version bumps included — dedupe drops the ones already listed).
 */
export async function fetchRegistrySince(
  since: Date,
): Promise<IngestCandidate[]> {
  const out: IngestCandidate[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < REGISTRY_MAX_PAGES; page++) {
    const url = new URL(`${REGISTRY_BASE}/v0.1/servers`);
    url.searchParams.set('limit', '100');
    url.searchParams.set('version', 'latest');
    url.searchParams.set('updated_since', since.toISOString());
    if (cursor) url.searchParams.set('cursor', cursor);
    const body = await fetchJson<{
      servers?: RegistryEntry[];
      metadata?: { nextCursor?: string };
    }>(url.toString());
    if (!body) break;
    for (const entry of body.servers ?? []) {
      const c = registryEntryToCandidate(entry);
      if (c) out.push(c);
    }
    cursor = body.metadata?.nextCursor;
    if (!cursor) break;
  }
  return out;
}

/** Every server listed in the community awesome-list READMEs. */
export async function fetchAwesomeLists(): Promise<IngestCandidate[]> {
  const out: IngestCandidate[] = [];
  for (const source of README_SOURCES) {
    try {
      const res = await fetch(source.readmeUrl, {
        headers: UA,
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      for (const c of parseServerList(await res.text(), source)) out.push(c);
    } catch {
      // One unreachable list should not cost the other.
    }
  }
  return out;
}

const NPM_QUERIES = ['keywords:mcp-server', 'keywords:modelcontextprotocol'];
const NPM_PAGE = 250;
/** npm search refuses offsets past this. */
const NPM_MAX_OFFSET = 5000;

/**
 * One page of npm search per query, at an offset that rotates daily, so the
 * whole keyword set is walked every few weeks without a long run. There is
 * no "sort by newest" in npm's search API, hence the rotation.
 */
export async function fetchNpmCandidates(
  now: Date,
): Promise<IngestCandidate[]> {
  const day = Math.floor(now.getTime() / 86_400_000);
  const pages = NPM_MAX_OFFSET / NPM_PAGE;
  const from = (day % pages) * NPM_PAGE;
  const out: IngestCandidate[] = [];
  for (const q of NPM_QUERIES) {
    const url = new URL('https://registry.npmjs.org/-/v1/search');
    url.searchParams.set('text', q);
    url.searchParams.set('size', String(NPM_PAGE));
    url.searchParams.set('from', String(from));
    const body = await fetchJson<{ objects?: NpmSearchObject[] }>(
      url.toString(),
    );
    for (const obj of body?.objects ?? []) {
      const c = npmObjectToCandidate(obj);
      if (c) out.push(c);
    }
  }
  return out;
}

// Not bare `mcp`: it also tags Minecraft Coder Pack and other unrelated tools.
const GITHUB_TOPICS = [
  'mcp-server',
  'model-context-protocol',
  'modelcontextprotocol',
];
const GITHUB_PAGES_PER_TOPIC = 2;

/**
 * Repos tagged with an MCP topic, pushed in the last week, newest first —
 * this is where Python servers show up, since PyPI has no search API.
 * Authenticated search allows 30 requests a minute; this makes six.
 */
export async function fetchGithubTopicCandidates(
  now: Date,
  token: string | null,
): Promise<IngestCandidate[]> {
  const since = new Date(now.getTime() - 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const out: IngestCandidate[] = [];
  for (const topic of GITHUB_TOPICS) {
    for (let page = 1; page <= GITHUB_PAGES_PER_TOPIC; page++) {
      const url = new URL('https://api.github.com/search/repositories');
      url.searchParams.set(
        'q',
        `topic:${topic} pushed:>=${since} fork:false archived:false stars:>=5`,
      );
      url.searchParams.set('sort', 'updated');
      url.searchParams.set('order', 'desc');
      url.searchParams.set('per_page', '100');
      url.searchParams.set('page', String(page));
      const body = await fetchJson<{ items?: GithubSearchRepo[] }>(
        url.toString(),
        { headers: githubApiHeaders(token, undefined, UA['User-Agent']) },
        1,
      );
      const items = body?.items ?? [];
      for (const repo of items) {
        const c = githubRepoToCandidate(repo);
        if (c) out.push(c);
      }
      if (items.length < 100) break;
    }
  }
  return out;
}
