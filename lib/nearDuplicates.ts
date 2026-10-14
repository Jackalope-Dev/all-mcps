import { normalizeNameSiteKey, normalizeUrlKey } from './urlDedup';

/**
 * Duplicate clustering for the weekly near-duplicate sweep
 * (app/api/cron/dedupe). The rules are scripts/dedupe-listings.mjs's,
 * reproduced exactly so the scheduled pass and a manual run agree:
 *
 *   - rows sharing a normalized primary URL or (name + website) cluster
 *     together (union-find);
 *   - the keeper is the strongest row (active > official > premium >
 *     enriched > traction > oldest);
 *   - AUTO when every other member points at the same repo as the keeper
 *     (identical owner/repo, a monorepo subpath, or the same non-generic
 *     repo name under another owner); otherwise REVIEW.
 *
 * One deliberate addition on top of the script: a cluster whose losers
 * include a claimed, premium or featured listing is never AUTO. A person
 * answers for that row, so a human decides.
 */

export type DedupeRow = {
  id: string;
  name: string;
  url: string;
  websiteUrl: string | null;
  status: string;
  views: number | null;
  copies: number | null;
  upvotes: number | null;
  githubStars: number | null;
  npmDownloads: number | null;
  isOfficial: boolean | null;
  isPremium: boolean | null;
  createdAt: Date | number | null;
  aiEnrichedAt: Date | number | null;
  ownerUserId: string | null;
  featuredUntil: Date | number | null;
};

/** Sorted, comma-joined member ids of clusters known not to be duplicates. */
const NOT_DUPLICATES = new Set([
  'agent-memory,mcp-57', // agishub: memory server vs x402 payments server
]);

/** Repo basenames too generic to treat a cross-owner match as "same repo". */
const GENERIC_REPO_NAMES = new Set([
  'mcp',
  'server',
  'servers',
  'mcp-server',
  'mcp-servers',
  'skills',
  'agent-skills',
  'agent',
  'agents',
  'tools',
  'sdk',
  'api',
  'app',
  'core',
  'main',
  'python-sdk',
  'typescript',
]);

function parseRepo(rawUrl: string) {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const segs = u.pathname
      .replace(/\.git$/i, '')
      .replace(/\/+$/, '')
      .split('/')
      .filter(Boolean)
      .map((s) => s.toLowerCase());
    if (segs.length < 2)
      return { host, owner: '', repo: '', path: segs, ok: false };
    const cut = segs.findIndex(
      (s) => s === 'tree' || s === 'blob' || s === '-',
    );
    const trimmed = cut > 1 ? segs.slice(0, cut) : segs;
    return {
      host,
      owner: trimmed[0] ?? '',
      repo: trimmed[1] ?? '',
      path: segs,
      ok: true,
    };
  } catch {
    return { host: '', owner: '', repo: '', path: [] as string[], ok: false };
  }
}

/** Do two listing URLs point at the same underlying repo? */
export function sameRepo(a: string, b: string): boolean {
  const ra = parseRepo(a);
  const rb = parseRepo(b);
  if (!ra.ok || !rb.ok) return false;
  if (ra.host !== rb.host) return false;
  if (ra.owner === rb.owner && ra.repo === rb.repo) return true;
  const [short, long] =
    ra.path.length <= rb.path.length ? [ra.path, rb.path] : [rb.path, ra.path];
  if (short.length >= 2 && short.every((s, i) => s === long[i])) return true;
  if (ra.repo && ra.repo === rb.repo && !GENERIC_REPO_NAMES.has(ra.repo)) {
    return true;
  }
  return false;
}

function ms(value: Date | number | null): number {
  if (value == null) return 0;
  return value instanceof Date ? value.getTime() : Number(value) || 0;
}

/** Higher = stronger claim to be the canonical row. */
function keeperScore(r: DedupeRow): number {
  return (
    (r.status === 'active' ? 5_000_000_000 : 0) +
    (r.isOfficial ? 1_000_000_000 : 0) +
    (r.isPremium ? 100_000_000 : 0) +
    (r.aiEnrichedAt ? 5_000_000 : 0) +
    (r.upvotes || 0) * 200_000 +
    (r.copies || 0) * 50_000 +
    (r.views || 0) * 1_000 +
    (r.githubStars || 0) * 500 +
    Math.min(r.npmDownloads || 0, 5_000_000) * 0.05
  );
}

function pickKeeper<T extends DedupeRow>(rows: T[]): T {
  return [...rows].sort((a, b) => {
    const d = keeperScore(b) - keeperScore(a);
    if (d !== 0) return d;
    const ca = ms(a.createdAt);
    const cb = ms(b.createdAt);
    if (ca !== cb) return ca - cb; // older wins
    return a.id.localeCompare(b.id);
  })[0];
}

export type DuplicateCluster<T extends DedupeRow = DedupeRow> = {
  tier: 'auto' | 'review';
  keeper: T;
  /** Members other than the keeper that are not already removed. */
  losers: T[];
};

/** Cluster rows by URL key and name+site key; only clusters with work to do. */
export function findDuplicateClusters<T extends DedupeRow>(
  rows: T[],
  now: Date,
): DuplicateCluster<T>[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r) as string;
    let cur = x;
    while (parent.get(cur) !== r) {
      const next = parent.get(cur) as string;
      parent.set(cur, r);
      cur = next;
    }
    return r;
  };
  for (const r of rows) parent.set(r.id, r.id);

  const keyFns = [
    (r: T) => (r.url ? `url:${normalizeUrlKey(r.url)}` : ''),
    (r: T) => {
      const k = normalizeNameSiteKey(r.name, r.websiteUrl);
      return k ? `ns:${k}` : '';
    },
  ];
  for (const keyFn of keyFns) {
    const first = new Map<string, string>();
    for (const r of rows) {
      const k = keyFn(r);
      if (!k) continue;
      const seen = first.get(k);
      if (seen === undefined) first.set(k, r.id);
      else {
        const a = find(seen);
        const b = find(r.id);
        if (a !== b) parent.set(a, b);
      }
    }
  }

  const clusters = new Map<string, T[]>();
  for (const r of rows) {
    const root = find(r.id);
    const list = clusters.get(root);
    if (list) list.push(r);
    else clusters.set(root, [r]);
  }

  const out: DuplicateCluster<T>[] = [];
  for (const members of clusters.values()) {
    if (members.length < 2) continue;
    const sig = members
      .map((m) => m.id)
      .sort()
      .join(',');
    if (NOT_DUPLICATES.has(sig)) continue;
    const keeper = pickKeeper(members);
    const losers = members.filter(
      (m) => m.id !== keeper.id && m.status !== 'removed',
    );
    if (losers.length === 0) continue;
    const allSameRepo = members
      .filter((m) => m.id !== keeper.id)
      .every((m) => sameRepo(m.url, keeper.url));
    const someoneAnswersForLoser = losers.some(
      (m) =>
        m.isPremium ||
        m.ownerUserId ||
        (m.featuredUntil != null && ms(m.featuredUntil) > now.getTime()),
    );
    out.push({
      tier: allSameRepo && !someoneAnswersForLoser ? 'auto' : 'review',
      keeper,
      losers,
    });
  }
  return out;
}
