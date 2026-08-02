/**
 * Shared relevance ranking for directory search — used by the browse grid
 * (client), the command palette, and the /api/v1/search + /api/mcp endpoints so
 * ordering is consistent everywhere.
 *
 * Pure and dependency-free (no catalog import), so it is safe to bundle into
 * 'use client' components.
 *
 * Model: the query is tokenized into alphanumeric terms and ALL terms must match
 * somewhere (name, category, description, or tool names) for a server to be a hit.
 * Optional synonym expansion helps "postgres" find PostgreSQL listings without
 * full embedding search.
 */

export type Searchable = {
  name: string;
  description: string;
  category: string;
  /** Optional space-joined tool names / install package for extra recall. */
  toolText?: string | null;
};

export type Engagement = {
  upvotes?: number | null;
  copies?: number | null;
  views?: number | null;
  githubStars?: number | null;
  npmDownloads?: number | null;
};

export type QueryTerm = { term: string; boundary: RegExp };

/**
 * Lightweight synonym map — expands queries without LLM cost.
 * Keys and values are lowercase alphanumeric tokens after tokenizeQuery.
 */
const SYNONYMS: Record<string, string[]> = {
  postgres: ['postgresql', 'pg', 'psql'],
  postgresql: ['postgres', 'pg'],
  gh: ['github'],
  github: ['gh'],
  js: ['javascript', 'typescript', 'node', 'nodejs'],
  ts: ['typescript', 'javascript'],
  typescript: ['ts', 'javascript'],
  javascript: ['js', 'node', 'nodejs'],
  py: ['python'],
  python: ['py'],
  k8s: ['kubernetes'],
  kubernetes: ['k8s'],
  s3: ['aws', 'storage', 'bucket'],
  slack: ['chat', 'messaging'],
  llm: ['ai', 'openai', 'claude', 'gpt'],
  ai: ['llm', 'openai', 'claude'],
  db: ['database', 'sql'],
  database: ['db', 'sql'],
  sql: ['database', 'db', 'postgres', 'mysql', 'sqlite'],
  auth: ['oauth', 'authentication', 'login', 'sso'],
  oauth: ['auth', 'authentication'],
  fs: ['filesystem', 'files', 'file'],
  filesystem: ['fs', 'files'],
  browser: ['playwright', 'puppeteer', 'chrome', 'selenium'],
  scrape: ['scraping', 'crawler', 'browser'],
  search: ['web', 'google', 'brave'],
};

/** Lowercase alphanumeric terms; separators (-, /, @, ., spaces) split words. */
export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Precompile a query once (word-boundary regexes) so scoring stays cheap per row. */
export function compileQuery(query: string): QueryTerm[] {
  return tokenizeQuery(query).map((term) => ({
    term,
    // term is [a-z0-9]+ so it needs no regex escaping.
    boundary: new RegExp(`\\b${term}\\b`),
  }));
}

/** Engagement tie-breaker, combining directory interactions (upvotes, installs, views) with external adoption signals (GitHub stars, npm downloads). */
export function engagementScore(s: Engagement): number {
  return (
    (s.upvotes || 0) * 5 +
    (s.copies || 0) +
    (s.views || 0) * 0.05 +
    Math.min(Math.log10(1 + (s.githubStars || 0)) * 3, 15) +
    Math.min(Math.log10(1 + (s.npmDownloads || 0)) * 2, 12)
  );
}

function fieldHitScore(
  field: string,
  term: string,
  boundary: RegExp,
  weights: { exact: number; word: number; substr: number }
): number {
  if (!field) return 0;
  if (field === term) return weights.exact;
  if (boundary.test(field)) return weights.word;
  if (field.includes(term)) return weights.substr;
  return 0;
}

/**
 * Relevance score for a server against a precompiled query.
 * Returns 0 when any term fails to match (AND semantics) — not a hit.
 * Synonyms can satisfy a term if the primary form is absent.
 */
export function scoreServerMatch(
  server: Searchable,
  terms: QueryTerm[],
  fullQuery: string
): number {
  if (terms.length === 0) return 0;

  const name = server.name.toLowerCase();
  const category = server.category.toLowerCase();
  const description = server.description.toLowerCase();
  const tools = (server.toolText || '').toLowerCase();
  const blob = `${name} ${category} ${description} ${tools}`;

  let score = 0;

  // Whole-query phrase bonus on the name.
  if (name === fullQuery) score += 1000;
  else if (name.startsWith(fullQuery)) score += 400;
  else if (fullQuery.includes(' ') && name.includes(fullQuery)) score += 200;

  for (const { term, boundary } of terms) {
    let best = 0;

    best = Math.max(
      best,
      fieldHitScore(name, term, boundary, { exact: 130, word: 90, substr: 60 })
    );
    best = Math.max(
      best,
      fieldHitScore(category, term, boundary, { exact: 50, word: 40, substr: 28 })
    );
    best = Math.max(
      best,
      fieldHitScore(description, term, boundary, { exact: 30, word: 22, substr: 10 })
    );
    best = Math.max(
      best,
      fieldHitScore(tools, term, boundary, { exact: 45, word: 32, substr: 16 })
    );

    // Synonym expansion — slightly weaker than direct hits
    if (best === 0) {
      const alts = SYNONYMS[term] || [];
      for (const alt of alts) {
        if (blob.includes(alt)) {
          best = Math.max(best, 14);
          break;
        }
      }
    }

    if (best === 0) return 0; // this term matched nothing -> not a result
    score += best;
  }

  return score;
}

export type RankOptions = {
  /** Cap the number of results returned. */
  limit?: number;
};

/**
 * Filter `servers` to those matching `query` and return them ranked by relevance,
 * tie-broken by engagement. An empty query returns the input unchanged (callers
 * decide the default order in that case).
 */
export function rankServers<T extends Searchable & Engagement>(
  servers: T[],
  query: string,
  opts: RankOptions = {}
): T[] {
  const terms = compileQuery(query);
  if (terms.length === 0) {
    return typeof opts.limit === 'number' ? servers.slice(0, opts.limit) : servers;
  }
  const fullQuery = terms.map((t) => t.term).join(' ');

  const scored: Array<{ server: T; score: number }> = [];
  for (const server of servers) {
    const score = scoreServerMatch(server, terms, fullQuery);
    if (score > 0) scored.push({ server, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return engagementScore(b.server) - engagementScore(a.server);
  });

  const ranked = scored.map((s) => s.server);
  return typeof opts.limit === 'number' ? ranked.slice(0, opts.limit) : ranked;
}
