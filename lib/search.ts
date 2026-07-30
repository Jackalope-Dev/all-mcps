/**
 * Shared relevance ranking for directory search — used by the browse grid
 * (client), the command palette, and the /api/v1/search + /api/mcp endpoints so
 * ordering is consistent everywhere.
 *
 * Pure and dependency-free (no catalog import), so it is safe to bundle into
 * 'use client' components.
 *
 * Model: the query is tokenized into alphanumeric terms and ALL terms must match
 * somewhere (name, category, or description) for a server to be a hit. Each term
 * scores by the best field it lands in — a name hit beats a category hit beats a
 * description hit, and a whole-word hit beats a mid-word substring — plus a bonus
 * when the full query matches the name as a phrase. Higher score = more relevant.
 */

export type Searchable = {
  name: string;
  description: string;
  category: string;
};

export type Engagement = {
  upvotes?: number | null;
  copies?: number | null;
  views?: number | null;
};

export type QueryTerm = { term: string; boundary: RegExp };

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

/** Engagement tie-breaker, matching the grid's "trending" weighting. */
export function engagementScore(s: Engagement): number {
  return (s.upvotes || 0) * 5 + (s.copies || 0) + (s.views || 0) * 0.05;
}

/**
 * Relevance score for a server against a precompiled query.
 * Returns 0 when any term fails to match (AND semantics) — i.e. not a hit.
 */
export function scoreServerMatch(server: Searchable, terms: QueryTerm[], fullQuery: string): number {
  if (terms.length === 0) return 0;

  const name = server.name.toLowerCase();
  const category = server.category.toLowerCase();
  const description = server.description.toLowerCase();

  let score = 0;

  // Whole-query phrase bonus on the name.
  if (name === fullQuery) score += 1000;
  else if (name.startsWith(fullQuery)) score += 400;
  else if (fullQuery.includes(' ') && name.includes(fullQuery)) score += 200;

  for (const { term, boundary } of terms) {
    let best = 0;
    if (name === term) best = 130;
    else if (boundary.test(name)) best = 90;
    else if (name.includes(term)) best = 60;

    if (category.includes(term)) best = Math.max(best, 40);

    if (boundary.test(description)) best = Math.max(best, 22);
    else if (description.includes(term)) best = Math.max(best, 10);

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
