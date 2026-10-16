import type { SearchPrefilter } from './search';

/**
 * Query building and rollout state for the `servers_fts` trigram index
 * (drizzle/0065_search_fts.sql), which replaces the full-table LIKE scan in
 * lib/servers.ts prefilterSearchCandidates.
 *
 * Trigram MATCH is a case-insensitive substring match, the same as the old
 * `LIKE '%term%'`, but only for terms of 3+ characters: shorter strings have no
 * trigram to look up. So:
 *  - a group whose primary term is 3+ chars is matched through the index. Its
 *    1-2 char synonyms ("pg" for postgres, "ts" for typescript, "gh" for github)
 *    are dropped from recall: as bare substrings they hit thousands of unrelated
 *    listings ("upgrade", "lists", "high") and can't use the index.
 *  - a group whose primary term is 1-2 chars ("ai", "s3", "go") is a LIKE filter
 *    over the indexed text. In 'all' mode that only runs on rows another group
 *    already matched through the index; with no such group it scans the FTS
 *    content, which is still far smaller than the servers rows the old path read.
 */

/** job_cursors row the backfill script writes once every existing row is indexed. */
export const SEARCH_FTS_READY_CURSOR = 'search_fts_ready';

/** Trigram tokens are 3 characters; anything shorter can't be looked up in the index. */
const MIN_INDEXED_TERM = 3;

/** FTS5 string literal. Quoting makes operators, `*`, `-`, `:`, NEAR and column filters plain text. */
export function ftsPhrase(term: string): string {
  return `"${term.replace(/"/g, '""')}"`;
}

/** Alternatives one term group recalls on: the term, plus synonyms the index can look up. */
function recallAlternatives(alts: string[]): string[] {
  const [primary, ...synonyms] = alts.filter(Boolean);
  if (!primary) return [];
  if (primary.length < MIN_INDEXED_TERM) return [primary, ...synonyms];
  return [primary, ...synonyms.filter((s) => s.length >= MIN_INDEXED_TERM)];
}

const indexable = (alts: string[]) =>
  alts.length > 0 && alts.every((a) => a.length >= MIN_INDEXED_TERM);

/**
 * How one prefilter mode reads `servers_fts`:
 * - `match`: an FTS5 MATCH expression, plus `likeGroups` every row must also
 *   satisfy (each inner array is an OR of substrings, the outer list an AND).
 * - `scan`: no index lookup possible; `likeGroups` alone filter the FTS rows.
 */
export type FtsModePlan =
  | { kind: 'match'; match: string; likeGroups: string[][] }
  | { kind: 'scan'; likeGroups: string[][] };

/** FTS plan for the 'all' (strict AND) and 'any' (relaxed OR) prefilters, or null if nothing can match. */
export function ftsKeywordPlan(
  plan: SearchPrefilter,
  mode: 'all' | 'any',
): FtsModePlan | null {
  const groups = plan.terms.map(recallAlternatives).filter((g) => g.length);
  if (groups.length === 0) return null;
  const orOf = (alts: string[]) => `(${alts.map(ftsPhrase).join(' OR ')})`;
  if (mode === 'any') {
    const alts = Array.from(new Set(groups.flat()));
    return indexable(alts)
      ? { kind: 'match', match: orOf(alts), likeGroups: [] }
      : { kind: 'scan', likeGroups: [alts] };
  }
  const anchors = groups.filter(indexable);
  const rest = groups.filter((g) => !indexable(g));
  if (anchors.length === 0) return { kind: 'scan', likeGroups: rest };
  return {
    kind: 'match',
    match: anchors.map(orOf).join(' AND '),
    likeGroups: rest,
  };
}

/**
 * Typo fallback: rankServers only fuzzy-matches name, category and description,
 * and every fuzzy pattern is a 3-char prefix/suffix, i.e. exactly one trigram.
 */
export function ftsFuzzyMatch(plan: SearchPrefilter): string | null {
  const patterns = plan.fuzzy.filter((p) => p.length >= MIN_INDEXED_TERM);
  if (patterns.length === 0) return null;
  return `{name category description} : (${patterns.map(ftsPhrase).join(' OR ')})`;
}

/**
 * Per-isolate rollout state. The ready row is re-read at most every few minutes,
 * so a deploy that lands before the migration or backfill keeps the LIKE path and
 * picks the index up on its own once the backfill finishes. Never a per-request query.
 */
const READY_RECHECK_MS = 5 * 60 * 1000;
let readyState: { value: boolean; at: number } | null = null;
let readyCheck: Promise<boolean> | null = null;

export async function isSearchFtsReady(
  probe: () => Promise<boolean>,
  now = Date.now(),
): Promise<boolean> {
  if (readyState && now - readyState.at < READY_RECHECK_MS) {
    return readyState.value;
  }
  readyCheck ??= probe().then(
    (value) => {
      readyState = { value, at: now };
      readyCheck = null;
      return value;
    },
    () => {
      // A busy or reset D1 says nothing about the index: keep what we knew
      // and look again soon, instead of pinning the heavy LIKE scan for the
      // full recheck window (that fed the overload it came from).
      const value = readyState?.value ?? false;
      readyState = { value, at: now - READY_RECHECK_MS + PROBE_RETRY_MS };
      readyCheck = null;
      return value;
    },
  );
  return readyCheck;
}

const PROBE_RETRY_MS = 30 * 1000;

/** Message text of an error and its `cause` chain (Drizzle wraps the D1 error). */
export function errorText(e: unknown): string {
  const parts: string[] = [];
  let cur: unknown = e;
  for (let i = 0; cur && i < 5; i++) {
    const msg = (cur as { message?: unknown }).message;
    parts.push(typeof msg === 'string' ? msg : String(cur));
    cur = (cur as { cause?: unknown }).cause;
  }
  return parts.join(' <- ');
}

/**
 * The index itself is missing or unusable (table dropped, FTS5 or trigram
 * unavailable), as opposed to a busy, reset or unreachable D1. Only these
 * should switch an isolate to the LIKE scan.
 */
export function isFtsSchemaError(e: unknown): boolean {
  return /no such (table|module|function|column)|unknown tokenizer|fts5/i.test(
    errorText(e),
  );
}

/** The index is missing (see isFtsSchemaError): use LIKE until the next recheck. */
export function markSearchFtsUnavailable(now = Date.now()): void {
  readyState = { value: false, at: now };
}

/** Test hook: forget the memoized state. */
export function resetSearchFtsState(): void {
  readyState = null;
  readyCheck = null;
}

/**
 * The `body` column, computed from a servers row the same way the triggers in
 * drizzle/0065_search_fts.sql do. Used by the backfill; a test checks the two agree.
 */
const FTS_BODY_SQL = `coalesce(substr(ai_summary, 1, 600), '') || ' ' ||
  coalesce(substr(ai_overview, 1, 600), '') || ' ' ||
  coalesce(ai_use_cases, '') || ' ' ||
  coalesce(ai_features, '') || ' ' ||
  coalesce(tags, '') || ' ' ||
  coalesce(license, '') || ' ' ||
  coalesce(pricing_model, '') || ' ' ||
  coalesce(auth_type, '') || ' ' ||
  coalesce(compatible_clients, '') || ' ' ||
  coalesce(CASE WHEN json_valid(tools) THEN (
    SELECT group_concat(json_extract(je.value, '$.name'), ' ') FROM json_each(tools) AS je
  ) END, '')`;

/**
 * Idempotent backfill of servers rows with rowid in [from, to]: clears that
 * rowid range in the index, then re-inserts it. Integers only, so it is safe to
 * inline into a `wrangler d1 execute --command`.
 */
export function ftsBackfillSql(from: number, to: number): string {
  const a = Math.trunc(from);
  const b = Math.trunc(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error('rowid bounds must be finite integers');
  }
  return [
    `DELETE FROM servers_fts WHERE rowid BETWEEN ${a} AND ${b};`,
    `INSERT INTO servers_fts (rowid, id, name, category, description, body) SELECT rowid, id, name, category, description, ${FTS_BODY_SQL} FROM servers WHERE rowid BETWEEN ${a} AND ${b};`,
  ].join('\n');
}

/** Marks the index complete; search switches to it within READY_RECHECK_MS per isolate. */
export function ftsReadySql(nowSeconds: number): string {
  return `INSERT INTO job_cursors (name, value, updated_at) VALUES ('${SEARCH_FTS_READY_CURSOR}', '1', ${Math.trunc(nowSeconds)}) ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`;
}
