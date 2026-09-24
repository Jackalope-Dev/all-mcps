/**
 * Pure text/vector similarity helpers for the blog pipeline's duplicate-content
 * and keyword-cannibalization guardrails. No I/O — see lib/blogPipeline/corpus.ts
 * for where these are applied against the content_index table.
 *
 * Two independent signals, because each misses what the other catches:
 * - Lexical keyword overlap catches "postgres mcp server" vs "best postgres mcp
 *   servers" (same query intent, different wording the embedding may score
 *   only moderately).
 * - Embedding cosine catches "fixing MCP connection errors" vs "MCP server not
 *   connecting" (same intent, no shared keywords).
 */

/**
 * Words that carry no query-intent signal on this site: everything is about MCP
 * servers, so "mcp"/"server"/"model context protocol" appear in every keyword and
 * would make every pair look related.
 */
const KEYWORD_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'for',
  'to',
  'in',
  'on',
  'of',
  'with',
  'how',
  'what',
  'why',
  'is',
  'are',
  'do',
  'does',
  'your',
  'you',
  'vs',
  'versus',
  'mcp',
  'mcps',
  'model',
  'context',
  'protocol',
  'server',
  'servers',
  'guide',
  'tutorial',
  'best',
  'top',
  'complete',
  'explained',
  '2025',
  '2026',
  '2027',
]);

/** Light plural folding so "servers"/"server" and "agents"/"agent" compare equal. */
function stem(token: string): string {
  if (token.length > 4 && token.endsWith('ies'))
    return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss'))
    return token.slice(0, -1);
  return token;
}

/** Lowercase, strip punctuation, collapse whitespace. Used as the topic queue's unique key. */
export function normalizeKeyword(keyword: string): string {
  return keyword
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .replace(/[-\s]+/g, ' ')
    .trim();
}

/** Intent-bearing tokens of a keyword or title, stopwords removed and stemmed. */
export function keywordTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of normalizeKeyword(text).split(' ')) {
    if (!raw || KEYWORD_STOPWORDS.has(raw)) continue;
    out.add(stem(raw));
  }
  return out;
}

/** Jaccard similarity of two keywords' intent tokens (0..1). Empty sets never match. */
export function keywordOverlap(a: string, b: string): number {
  const ta = keywordTokens(a);
  const tb = keywordTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Word n-gram shingles of markdown prose (code fences, links and headings stripped). */
export function shingles(markdown: string, n = 8): Set<string> {
  const prose = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s.*$/gm, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ');
  const words = prose.split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) {
    out.add(words.slice(i, i + n).join(' '));
  }
  return out;
}

/**
 * Fraction of `candidate`'s shingles that also appear in `existing` — containment,
 * not Jaccard, so a short copied section inside a long new post still registers.
 */
export function shingleContainment(
  candidate: Set<string>,
  existing: Set<string>,
): number {
  if (candidate.size === 0) return 0;
  let shared = 0;
  for (const s of candidate) if (existing.has(s)) shared++;
  return shared / candidate.size;
}

/** URL-safe slug, capped at a word boundary. */
export function slugify(text: string, maxLen = 70): string {
  const slug = text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= maxLen) return slug;
  const cut = slug.lastIndexOf('-', maxLen);
  return slug.slice(0, cut > 20 ? cut : maxLen);
}

/** Stable non-cryptographic hash (FNV-1a) for change detection of embedded text. */
export function textHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
