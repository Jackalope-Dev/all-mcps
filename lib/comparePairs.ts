/**
 * The only /mcp/[a]/vs/[b] pages allowed into the index.
 *
 * Every compare URL stays `noindex, follow` by default: with ~20k listings the
 * pair space is effectively unbounded, and a templated table of two random
 * servers is thin content. These pairs are the exceptions — two maintained,
 * directly competing servers for the same integration, where people really do
 * search "<a> vs <b>" — and they are still only indexed while both listings
 * are active and carry an AI writeup (see isIndexableCompare), so the page has
 * substance on both sides.
 *
 * Chosen from the highest-starred enriched listings per integration hub. Add a
 * pair only when both are real alternatives for the same job.
 */
export type ComparePair = {
  a: string;
  b: string;
  /** Card title on /compare. */
  label: string;
  /** Card subtitle on /compare. */
  blurb: string;
};

export const INDEXABLE_COMPARE_PAIRS: ComparePair[] = [
  {
    a: 'executeautomation-playwright-mcp-server',
    b: 'microsoft-playwright-mcp',
    label: 'Microsoft Playwright MCP vs. ExecuteAutomation Playwright',
    blurb: 'The two most-used browser automation servers',
  },
  {
    a: 'bitbonsai-mcp-obsidian',
    b: 'markuspfundstein-mcp-obsidian',
    label: 'Obsidian MCP servers compared',
    blurb: 'REST API plugin vs. direct vault access',
  },
  {
    a: 'benborla29-mcp-server-mysql',
    b: 'designcomputer-mysql-mcp-server',
    label: 'MySQL MCP servers compared',
    blurb: 'Two leading MySQL servers for AI agents',
  },
  {
    a: 'alexanderzuev-supabase-mcp-server',
    b: 'supabase-community-supabase-mcp',
    label: 'Official Supabase MCP vs. community server',
    blurb: 'Project management vs. SQL-first access',
  },
  {
    a: 'ckreiling-mcp-server-docker',
    b: 'quantgeekdev-docker-mcp',
    label: 'Docker MCP servers compared',
    blurb: 'Manage containers and images from an agent',
  },
  {
    a: 'aashari-mcp-server-atlassian-jira',
    b: 'nguyenvanduocit-jira-mcp',
    label: 'Jira MCP servers compared',
    blurb: 'Issue search, updates and JQL support',
  },
];

function pairKey(x: string, y: string): string {
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}

const PAIR_KEYS = new Set(
  INDEXABLE_COMPARE_PAIRS.map((p) => pairKey(p.a, p.b)),
);

type CompareSide = { status?: string | null; aiDoc?: string | null };

/** True when this pair is curated AND both sides currently have real content. */
export function isIndexableCompare(
  idA: string,
  idB: string,
  a: CompareSide,
  b: CompareSide,
): boolean {
  if (!PAIR_KEYS.has(pairKey(idA, idB))) return false;
  return [a, b].every(
    (s) => s.status === 'active' && !!s.aiDoc && s.aiDoc.trim().length > 0,
  );
}

/** Canonical (sorted) URL path for a pair — matches the vs page's canonicalPair. */
export function comparePath(p: ComparePair): string {
  const [x, y] = p.a < p.b ? [p.a, p.b] : [p.b, p.a];
  return `/mcp/${x}/vs/${y}`;
}
