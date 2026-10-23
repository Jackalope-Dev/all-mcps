import { isSafeSubmissionUrl } from '../urlSafety';
import { looksLikeMcpEndpointUrl } from './parseInstallHint';
import {
  classifyProbeResponse,
  looksLikeInitializeResult,
  type ProbeResponseFacts,
  postInitialize,
} from './verifyRemoteEndpoint';

/**
 * Find a listing's hosted MCP endpoint and its auth scheme by asking, instead of
 * waiting for an owner to type them in.
 *
 * Most hosted servers are submitted by their homepage URL, and the endpoint sits one
 * guess away (`/mcp`, `/api/mcp`, `mcp.<site>`, `api.<site>/mcp`) or is linked from
 * that page. Without it the install box says "no confirmed command" for a server that
 * any client could connect to.
 *
 * Two bars, because a guessed URL is weaker evidence than one the listing names:
 *  - stated (in the description, or linked from the listing's own site): the same
 *    'alive' verdict the health cron trusts, which counts any 401 + WWW-Authenticate.
 *  - guessed: a real JSON-RPC answer, or an RFC 9728 `resource_metadata` challenge.
 *    A plain Bearer 401 on a guessed /api/mcp is just as likely a product API that
 *    walls every path, and would attach a non-MCP URL to the listing.
 *
 * Only ever guesses on the listing's own site. A directory or registry host answering
 * /mcp is *that* directory's server, and a community wrapper whose website is the
 * vendor's would pick up the vendor's official endpoint.
 */

export type DiscoveredAuth = 'none' | 'oauth' | 'api_key';

export type DiscoveredEndpoint = {
  url: string;
  /** Null when the response doesn't say (e.g. a bare SSE stream). */
  authType: DiscoveredAuth | null;
  source: 'stated' | 'guessed';
};

type Candidate = { url: string; source: 'stated' | 'guessed' };

const MAX_CANDIDATES = 8;
const PAGE_TIMEOUT_MS = 8000;
const PAGE_MAX_CHARS = 300_000;

const CODE_HOSTS = [
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'codeberg.org',
];

/** Hosts whose /mcp (or links) belong to the host, never to a listing on it. */
const NO_GUESS_HOSTS = [
  ...CODE_HOSTS,
  'npmjs.com',
  'pypi.org',
  'allmcps.com',
  'modelcontextprotocol.io',
  'smithery.ai',
  'glama.ai',
  'mcp.so',
  'pulsemcp.com',
  'mcpservers.org',
  'mcpmarket.com',
  'lobehub.com',
  'cursor.directory',
  'huggingface.co',
  'docker.com',
  'medium.com',
  'dev.to',
  'substack.com',
  'notion.site',
  'gitbook.io',
  'readthedocs.io',
];

/** Shared hosting: each tenant label is its own site, so `mcp.<tenant>.<suffix>` is meaningless. */
const SHARED_HOST_SUFFIXES = [
  'vercel.app',
  'netlify.app',
  'pages.dev',
  'workers.dev',
  'github.io',
  'onrender.com',
  'herokuapp.com',
  'fly.dev',
  'railway.app',
  'hf.space',
  'replit.app',
  'web.app',
  'firebaseapp.com',
  'azurewebsites.net',
];

const SECOND_LEVEL_LABELS = new Set([
  'co',
  'com',
  'org',
  'net',
  'ac',
  'gov',
  'edu',
]);

function hostMatches(host: string, list: string[]): boolean {
  return list.some((h) => host === h || host.endsWith(`.${h}`));
}

function hostOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** The registrable site a host belongs to: `api.foo.co.uk` → `foo.co.uk`. */
export function siteOf(host: string): string {
  const bare = host.replace(/^www\./, '');
  const shared = SHARED_HOST_SUFFIXES.find((s) => bare.endsWith(`.${s}`));
  const labels = bare.split('.');
  if (shared) return labels.slice(-(shared.split('.').length + 1)).join('.');
  const keep =
    labels.length >= 3 &&
    labels[labels.length - 1].length === 2 &&
    SECOND_LEVEL_LABELS.has(labels[labels.length - 2])
      ? 3
      : 2;
  return labels.slice(-keep).join('.');
}

const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * A code-host listing's website is its own only when the repo owner is named for it
 * (`hubfluence-io` ↔ hubfluence.io). A wrapper by someone else that sets the vendor's
 * site as its website must not inherit the vendor's endpoint.
 */
export function repoOwnerMatchesSite(
  repoUrl: string,
  siteUrl: string,
): boolean {
  const siteHost = hostOf(siteUrl);
  if (!siteHost) return false;
  let owner = '';
  try {
    owner = alnum(
      new URL(repoUrl).pathname.split('/').filter(Boolean)[0] || '',
    );
  } catch {
    return false;
  }
  const label = alnum(siteOf(siteHost).split('.')[0] || '');
  if (owner.length < 3 || label.length < 3) return false;
  return owner === label || owner.startsWith(label) || label.startsWith(owner);
}

/** The listing's own site origins, in priority order. */
function ownSites(url: string, websiteUrl?: string | null): string[] {
  const urlHost = hostOf(url);
  const siteHost = hostOf(websiteUrl);
  const out: string[] = [];
  if (urlHost && !hostMatches(urlHost, NO_GUESS_HOSTS)) out.push(url);
  if (websiteUrl && siteHost && !hostMatches(siteHost, NO_GUESS_HOSTS)) {
    const isOwn =
      urlHost && hostMatches(urlHost, CODE_HOSTS)
        ? repoOwnerMatchesSite(url, websiteUrl)
        : urlHost !== null && siteOf(urlHost) === siteOf(siteHost);
    if (isOwn) out.push(websiteUrl);
  }
  return out;
}

const URL_IN_TEXT = /https?:\/\/[^\s"'<>()`\\]+/g;

function urlsIn(text: string): string[] {
  return (text.match(URL_IN_TEXT) || []).map((u) =>
    u.replace(/[).,;:'"\]]+$/, ''),
  );
}

function normalize(raw: string): string | null {
  try {
    const u = new URL(raw);
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Every URL worth asking, best first: what the listing states, then guesses on its
 * own site. Pure, so the ordering and the host rules are testable without a network.
 */
export function endpointCandidates(input: {
  url: string;
  websiteUrl?: string | null;
  description?: string | null;
  pages?: { url: string; html: string }[];
}): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  const add = (raw: string, source: Candidate['source']) => {
    const url = normalize(raw);
    if (!url || seen.has(url) || !isSafeSubmissionUrl(url)) return;
    seen.add(url);
    out.push({ url, source });
  };
  // A page that links `/mcp` usually links its sub-resources too
  // (`/mcp/catalog`); the endpoint is the shallowest one.
  const byDepth = (list: string[]) =>
    [...list].sort(
      (a, b) =>
        new URL(a).pathname.split('/').filter(Boolean).length -
        new URL(b).pathname.split('/').filter(Boolean).length,
    );

  for (const u of byDepth(
    urlsIn(input.description || '').filter(looksLikeMcpEndpointUrl),
  )) {
    add(u, 'stated');
  }

  const sites = ownSites(input.url, input.websiteUrl);
  const ownSiteKeys = new Set(sites.map((s) => siteOf(hostOf(s) as string)));
  for (const page of input.pages || []) {
    const linked = urlsIn(page.html).filter((u) => {
      const host = hostOf(u);
      return (
        host !== null &&
        ownSiteKeys.has(siteOf(host)) &&
        looksLikeMcpEndpointUrl(u)
      );
    });
    for (const u of byDepth(linked)) add(u, 'stated');
  }

  for (const site of sites) {
    const host = hostOf(site) as string;
    const origin = new URL(site).origin;
    add(`${origin}/mcp`, 'guessed');
    add(`${origin}/api/mcp`, 'guessed');
    const root = siteOf(host);
    // Subdomain guesses only from the site itself — `mcp.prices.example.dev` and
    // `mcp.tenant.vercel.app` are never where a server lives.
    const isShared = hostMatches(root, SHARED_HOST_SUFFIXES);
    if (!isShared && host.replace(/^www\./, '') === root) {
      add(`https://mcp.${root}/mcp`, 'guessed');
      add(`https://mcp.${root}/`, 'guessed');
      add(`https://api.${root}/mcp`, 'guessed');
    }
  }

  return out.slice(0, MAX_CANDIDATES);
}

/**
 * Servers a hosting platform runs on every tenant's site, whatever the tenant
 * sells: Shopify serves its storefront MCP at /api/mcp on every store. Right
 * for a store's own listing, wrong for a dev tool whose marketing site happens
 * to be a Shopify store, so these only count when the listing names the URL.
 */
const PLATFORM_SERVER_NAMES = new Set(['storefront-renderer']);

function serverName(body: string): string | null {
  const m = body.match(/"serverInfo"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"]+)"/);
  return m ? m[1] : null;
}

/** Does this response clear the bar for its candidate, and what auth does it ask for? */
export function judgeCandidate(
  facts: ProbeResponseFacts,
  source: Candidate['source'],
): { match: boolean; authType: DiscoveredAuth | null } {
  const challenge = facts.status === 401 ? facts.wwwAuthenticate || '' : '';
  const handshake = looksLikeInitializeResult(facts.body);
  const rfc9728 = /resource_metadata\s*=/i.test(challenge);
  const platformServer = PLATFORM_SERVER_NAMES.has(
    serverName(facts.body) || '',
  );
  const match =
    source === 'guessed'
      ? (handshake && !platformServer) || rfc9728
      : classifyProbeResponse(facts).verdict === 'alive';
  if (!match) return { match, authType: null };
  if (challenge) return { match, authType: rfc9728 ? 'oauth' : 'api_key' };
  if (handshake && facts.status >= 200 && facts.status < 300) {
    return { match, authType: 'none' };
  }
  return { match, authType: null };
}

async function fetchPage(url: string): Promise<string | null> {
  if (!isSafeSubmissionUrl(url)) return null;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'text/html' },
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) {
      await res.body?.cancel().catch(() => {});
      return null;
    }
    return (await res.text()).slice(0, PAGE_MAX_CHARS);
  } catch {
    return null;
  }
}

/**
 * Probe every candidate at once and keep the best-ranked one that answers. Never
 * throws; null means nothing cleared the bar, not that the listing has no endpoint.
 */
export async function discoverRemoteEndpoint(input: {
  url: string;
  websiteUrl?: string | null;
  description?: string | null;
}): Promise<DiscoveredEndpoint | null> {
  const sites = ownSites(input.url, input.websiteUrl);
  const pages = (
    await Promise.all(
      sites.map(async (url) => ({ url, html: await fetchPage(url) })),
    )
  ).filter((p): p is { url: string; html: string } => p.html !== null);

  const candidates = endpointCandidates({ ...input, pages });
  const verdicts = await Promise.all(
    candidates.map(async (c) => {
      try {
        return judgeCandidate(await postInitialize(c.url), c.source);
      } catch {
        return { match: false, authType: null };
      }
    }),
  );
  const best = candidates.findIndex((_, i) => verdicts[i].match);
  if (best === -1) return null;
  return {
    url: candidates[best].url,
    authType: verdicts[best].authType,
    source: candidates[best].source,
  };
}
