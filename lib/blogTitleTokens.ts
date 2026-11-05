/**
 * Title intent tokens for the blog's "Related articles" block (lib/blog.ts):
 * two posts whose titles share intent-bearing words are probably neighbours.
 */

/**
 * Words that carry no intent signal on this site: everything is about MCP
 * servers, so "mcp"/"server"/"model context protocol" appear in every title
 * and would make every pair look related.
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

/** Intent-bearing tokens of a title, stopwords removed and stemmed. */
export function keywordTokens(text: string): Set<string> {
  const out = new Set<string>();
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .replace(/[-\s]+/g, ' ')
    .trim();
  for (const raw of normalized.split(' ')) {
    if (!raw || KEYWORD_STOPWORDS.has(raw)) continue;
    out.add(stem(raw));
  }
  return out;
}
