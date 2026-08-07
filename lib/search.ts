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
  /**
   * Optional AI-authored search text (summary + overview + use cases + FAQ + features).
   * Lets intent queries — "read my pdfs", "query a database" — match the use cases
   * and grounded FAQ answers even when the raw name/description don't contain those words.
   */
  extraText?: string | null;
};

/**
 * Build the AI search-text blob for a listing from its enriched fields. Pure and
 * loose-typed so it's safe to call server-side and to bundle. Bounded length keeps
 * the client feed small.
 *
 * Includes grounded FAQ Q&A so intent queries can match listing-specific answers
 * (e.g. "how do I authenticate") even when name/description lack those words.
 */
export function buildAiSearchText(
  parts: {
    aiSummary?: string | null;
    aiOverview?: string | null;
    aiUseCases?: string[] | null;
    aiFeatures?: string[] | null;
    /** Parsed `{q,a}` pairs from `ai_faq`; both sides feed search. */
    aiFaq?: Array<{ q?: string; a?: string }> | null;
  },
  maxLen = 600
): string | null {
  const faqBits = (parts.aiFaq || []).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const out: string[] = [];
    if (typeof item.q === 'string' && item.q.trim()) out.push(item.q.trim());
    if (typeof item.a === 'string' && item.a.trim()) out.push(item.a.trim());
    return out;
  });
  const text = [
    parts.aiSummary || '',
    parts.aiOverview || '',
    ...(parts.aiUseCases || []),
    // FAQ questions often mirror user search intent; place before features so they
    // survive the length cap when the blob is tight.
    ...faqBits,
    ...(parts.aiFeatures || []),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (!text) return null;
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

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
  playwright: ['browser', 'puppeteer'],
  puppeteer: ['browser', 'playwright', 'chrome'],
  scrape: ['scraping', 'crawler', 'browser'],
  crawl: ['scrape', 'scraping', 'spider'],
  search: ['web', 'google', 'brave'],
  // Databases & data
  mysql: ['mariadb', 'database', 'sql'],
  mariadb: ['mysql'],
  mongo: ['mongodb', 'nosql'],
  mongodb: ['mongo', 'nosql'],
  redis: ['cache', 'keyvalue'],
  sqlite: ['database', 'sql'],
  vector: ['embedding', 'embeddings', 'rag'],
  rag: ['retrieval', 'embeddings', 'vector'],
  embedding: ['embeddings', 'vector', 'rag'],
  // Documents & files
  pdf: ['document', 'documents'],
  doc: ['document', 'documents', 'word'],
  excel: ['spreadsheet', 'xlsx', 'sheets'],
  spreadsheet: ['excel', 'sheets', 'xlsx'],
  csv: ['spreadsheet', 'data'],
  // Integrations & platforms
  docker: ['container', 'containers'],
  container: ['docker'],
  gitlab: ['git'],
  youtube: ['video', 'transcript', 'captions'],
  transcript: ['captions', 'subtitles', 'youtube'],
  notion: ['docs', 'wiki', 'notes'],
  obsidian: ['notes', 'markdown', 'knowledge'],
  jira: ['issues', 'tickets', 'atlassian'],
  linear: ['issues', 'tickets'],
  stripe: ['payments', 'payment', 'billing'],
  shopify: ['ecommerce', 'store', 'commerce'],
  gmail: ['email', 'mail', 'google'],
  email: ['gmail', 'smtp', 'imap', 'mail'],
  calendar: ['events', 'scheduling', 'gcal'],
  sheets: ['spreadsheet', 'excel', 'google'],
  maps: ['location', 'geocode', 'geocoding'],
  weather: ['forecast', 'climate'],
  // Comms & social
  discord: ['chat', 'messaging'],
  telegram: ['chat', 'messaging', 'bot'],
  reddit: ['social'],
  // Media
  image: ['images', 'vision', 'photo', 'picture'],
  voice: ['speech', 'audio', 'tts', 'stt'],
  audio: ['voice', 'speech', 'sound'],
  // Infra & ops
  terminal: ['shell', 'command', 'cli', 'bash'],
  shell: ['terminal', 'bash', 'command', 'cli'],
  monitor: ['observability', 'metrics', 'logs'],
  logs: ['logging', 'observability'],
  // Finance / crypto
  finance: ['stock', 'crypto', 'trading', 'market'],
  crypto: ['blockchain', 'web3', 'ethereum', 'bitcoin', 'solana', 'btc', 'coingecko', 'coinbase'],
  btc: ['bitcoin', 'crypto', 'coingecko', 'coinbase', 'ticker', 'price', 'rates'],
  prices: ['rates', 'quotes', 'ticker', 'market', 'price', 'cost'],
  payments: ['stripe', 'payment', 'billing'],
  // Transit & travel
  transit: ['bus', 'train', 'subway', 'gtfs', 'commute', 'transportation', 'schedule', 'transit'],
  bus: ['transit', 'transportation', 'schedule', 'gtfs'],
  train: ['transit', 'subway', 'rail', 'gtfs'],
  times: ['schedules', 'arrivals', 'timetable', 'realtime', 'status'],
};

const STOPWORDS = new Set([
  'find', 'latest', 'check', 'show', 'me', 'how', 'to', 'where', 'can', 'i', 'get',
  'for', 'the', 'a', 'an', 'is', 'are', 'with', 'want', 'need', 'search', 'look', 'up'
]);

/** Lowercase alphanumeric terms; separators (-, /, @, ., spaces) split words. Filter common intent stopwords when multiple words exist. */
export function tokenizeQuery(query: string): string[] {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  if (tokens.length > 1) {
    const filtered = tokens.filter((t) => !STOPWORDS.has(t));
    if (filtered.length > 0) return filtered;
  }
  return tokens;
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

export type TrendingItem = Engagement & { createdAt?: string | Date | null };

/**
 * Velocity & momentum score for Trending sorting mode.
 * Applies time-decay (HackerNews / Reddit gravity algorithm) so newer servers with active
 * engagement (upvotes, copies, views, stars) rank higher than static old listings.
 */
export function trendingScore(s: TrendingItem): number {
  const upvotes = s.upvotes || 0;
  const copies = s.copies || 0;
  const views = s.views || 0;
  const stars = s.githubStars || 0;
  const downloads = s.npmDownloads || 0;

  const rawEngagement =
    upvotes * 10 +
    copies * 4 +
    views * 0.1 +
    Math.min(stars * 0.1, 40) +
    Math.min(downloads * 0.05, 25);

  const createdAtMs = s.createdAt ? new Date(s.createdAt).getTime() : Date.now();
  const ageInDays = Math.max(0.5, (Date.now() - createdAtMs) / (1000 * 60 * 60 * 24));

  // Time decay factor: newer listings with recent engagement get boosted to top of Trending
  return rawEngagement / Math.pow(ageInDays + 2, 1.25);
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
  fullQuery: string,
  requireAll = true
): number {
  if (terms.length === 0) return 0;

  const name = server.name.toLowerCase();
  const category = server.category.toLowerCase();
  const description = server.description.toLowerCase();
  const tools = (server.toolText || '').toLowerCase();
  const extra = (server.extraText || '').toLowerCase();
  const blob = `${name} ${category} ${description} ${tools} ${extra}`;

  let score = 0;
  let matched = 0;

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
    // AI-authored search text — between description and tools in weight.
    best = Math.max(
      best,
      fieldHitScore(extra, term, boundary, { exact: 34, word: 24, substr: 12 })
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

    if (best === 0) {
      // Strict AND: any unmatched term disqualifies the row. Relaxed (OR) fallback:
      // skip the missing term and let partial matches through, ranked below.
      if (requireAll) return 0;
      continue;
    }
    matched += 1;
    score += best;
  }

  if (matched === 0) return 0;
  // In relaxed mode, reward rows that matched more of the query so the closest
  // partial matches still rank first.
  if (!requireAll) score += matched * 8;
  return score;
}

export type RankOptions = {
  /** Cap the number of results returned. */
  limit?: number;
};

/**
 * Filter `servers` to those matching `query` and return them ranked by relevance,
 * tie-broken by engagement. An empty query returns the input unchanged (callers
 * decide the default order in that case). A non-empty query that tokenizes to nothing
 * (e.g. "!!!" — all punctuation, no alphanumeric terms) is a real search with no possible
 * matches, not "no filter" — it returns no results rather than the whole catalog.
 */
export function rankServers<T extends Searchable & Engagement>(
  servers: T[],
  query: string,
  opts: RankOptions = {}
): T[] {
  const terms = compileQuery(query);
  if (terms.length === 0) {
    if (!query.trim()) {
      return typeof opts.limit === 'number' ? servers.slice(0, opts.limit) : servers;
    }
    return [];
  }
  const fullQuery = terms.map((t) => t.term).join(' ');

  const rank = (requireAll: boolean): Array<{ server: T; score: number }> => {
    const out: Array<{ server: T; score: number }> = [];
    for (const server of servers) {
      const score = scoreServerMatch(server, terms, fullQuery, requireAll);
      if (score > 0) out.push({ server, score });
    }
    return out;
  };

  // Strict AND first (highest precision). If that dead-ends on a multi-word query,
  // fall back to a relaxed OR pass so the user gets close matches instead of nothing.
  let scored = rank(true);
  if (scored.length === 0 && terms.length >= 2) {
    scored = rank(false);
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return engagementScore(b.server) - engagementScore(a.server);
  });

  const ranked = scored.map((s) => s.server);
  return typeof opts.limit === 'number' ? ranked.slice(0, opts.limit) : ranked;
}

/**
 * Hybrid ranker combining keyword relevance matching with Cloudflare Vectorize similarity scores.
 */
export function hybridRankServers<T extends Searchable & Engagement & { id: string }>(
  servers: T[],
  query: string,
  vectorMatches: Array<{ id: string; score: number }> = [],
  opts: RankOptions = {}
): T[] {
  const terms = compileQuery(query);
  if (terms.length === 0) {
    if (!query.trim()) {
      return typeof opts.limit === 'number' ? servers.slice(0, opts.limit) : servers;
    }
    return [];
  }
  const fullQuery = terms.map((t) => t.term).join(' ');

  const vectorScoreMap = new Map<string, number>();
  for (const vm of vectorMatches) {
    vectorScoreMap.set(vm.id, vm.score);
  }

  const scoredMap = new Map<string, { server: T; score: number }>();

  // 1. Keyword search pass with vector score boosting
  for (const server of servers) {
    const kwScore = scoreServerMatch(server, terms, fullQuery, false);
    const vecScore = vectorScoreMap.get(server.id) || 0;

    let totalScore = kwScore;
    if (vecScore > 0) {
      totalScore += vecScore * 120;
    }

    if (totalScore > 0) {
      scoredMap.set(server.id, { server, score: totalScore });
    }
  }

  // 2. Vector-only recall pass for natural language intent matches (> 0.5 similarity)
  for (const vm of vectorMatches) {
    if (vm.score >= 0.5 && !scoredMap.has(vm.id)) {
      const server = servers.find((s) => s.id === vm.id);
      if (server) {
        scoredMap.set(server.id, { server, score: vm.score * 100 });
      }
    }
  }

  const scored = Array.from(scoredMap.values());
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return engagementScore(b.server) - engagementScore(a.server);
  });

  const ranked = scored.map((s) => s.server);
  return typeof opts.limit === 'number' ? ranked.slice(0, opts.limit) : ranked;
}
