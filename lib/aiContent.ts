/**
 * LLM authorship of the per-listing content layer.
 *
 * A directory page that only mirrors a repo's README is thin, duplicate content in
 * Google's eyes — it ranks the upstream repo above us. This turns the raw scrape
 * (description + README + introspected tools) into original, human-useful copy:
 * a clean one-liner, a plain-language overview, concrete use cases, and key features.
 *
 * Everything here is fail-soft: `generateListingContent` returns null on any budget /
 * timeout / parse failure so the enrich cron simply tries again next tick and the page
 * keeps falling back to the raw description/README. See app/api/cron/ai-content.
 */

import { chatJson } from './openai';
import { cleanListingDescription } from './description';

export type AiFaqItem = { q: string; a: string };

export type AiListingContent = {
  /** One clean sentence, no trailing period stripping — used in cards, meta, digest. */
  summary: string;
  /** 2-4 sentences: what it does and when you'd reach for it. */
  overview: string;
  /** Concrete, specific use cases. */
  useCases: string[];
  /** Key capabilities / features. */
  features: string[];
  /** 3-5 grounded Q&A pairs for the /mcp/[id] FAQ section and its FAQPage schema. */
  faq: AiFaqItem[];
};

/**
 * Discriminated outcome so the caller can react to the spend cap:
 * - 'ok'     — usable content.
 * - 'budget' — spend cap / rate limit / auth / no key. The caller should STOP the run
 *              (every further call would fail the same way) and leave rows for a later retry.
 * - 'skip'   — transient error or unusable output for this one listing; retry it later.
 */
export type ListingContentOutcome =
  | { status: 'ok'; content: AiListingContent }
  | { status: 'budget'; reason: string }
  | { status: 'skip'; reason: string };

/** Parse a stored JSON string-array column tolerantly (bad data → []). */
export function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === 'string' && x.trim()).map((x) => String(x).trim());
  } catch {
    return [];
  }
}

/** Parse a stored JSON string-array-of-{q,a} column tolerantly (bad data → []). */
export function parseFaqArray(raw: unknown): AiFaqItem[] {
  const toItems = (arr: unknown[]): AiFaqItem[] =>
    arr
      .filter(
        (x): x is { q: string; a: string } =>
          !!x && typeof x === 'object' && typeof (x as any).q === 'string' && typeof (x as any).a === 'string'
      )
      .map((x) => ({ q: x.q.trim(), a: x.a.trim() }))
      .filter((x) => x.q && x.a);

  if (Array.isArray(raw)) return toItems(raw);
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return toItems(parsed);
  } catch {
    return [];
  }
}

function clampSentence(text: unknown, maxLen: number): string {
  if (typeof text !== 'string') return '';
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length > maxLen ? `${t.slice(0, maxLen - 1).trimEnd()}…` : t;
}

function clampList(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const s = clampSentence(item, maxLen);
    if (s && /[\p{L}\p{N}]/u.test(s)) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Cap FAQ item count and per-field length (mirrors clampList, but for {q,a} pairs). */
export function clampFaq(value: unknown, maxItems: number, maxQLen: number, maxALen: number): AiFaqItem[] {
  if (!Array.isArray(value)) return [];
  const out: AiFaqItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const q = clampSentence((item as any).q, maxQLen);
    const a = clampSentence((item as any).a, maxALen);
    if (q && a) out.push({ q, a });
    if (out.length >= maxItems) break;
  }
  return out;
}

export type ListingContentInput = {
  name: string;
  description: string;
  category: string;
  url: string;
  readme: string | null;
  tools?: { name: string; description?: string }[];
};

const README_BUDGET = 6000;
const SYSTEM_PROMPT =
  'You are a senior technical writer for AllMCPs, a directory of Model Context Protocol (MCP) servers ' +
  'that give AI agents new tools. Given a listing, write original, accurate, concise reference copy. ' +
  'Rules: (1) Only state what the provided material supports — never invent tools, integrations, or claims. ' +
  '(2) Plain, specific language; no marketing filler ("powerful", "seamless", "game-changer"), no emoji. ' +
  '(3) Write for a developer deciding whether this server fits their use case. ' +
  'Return ONLY JSON with keys: "summary" (one sentence, <=150 chars, no name-dropping the directory), ' +
  '"overview" (2-4 sentences on what it does and when to use it), ' +
  '"useCases" (3-5 short concrete strings, each starting with a verb), ' +
  '"features" (3-6 short capability strings), ' +
  '"faq" (3-5 objects with "q" and "a" keys — real questions a developer evaluating this server would ' +
  'search for or ask, e.g. what it requires, what it does NOT do, how it compares to doing the task ' +
  'manually, or a specific setup/auth detail if the material covers one; each "a" is 1-3 plain sentences ' +
  'grounded only in the provided material). ' +
  'If the material is too thin to support a field, return fewer items rather than guessing.';

/** Chat failure reasons that mean "stop spending" rather than "this one didn't work". */
const BUDGET_REASONS = new Set(['budget_or_rate_limit', 'auth', 'not_configured']);

/**
 * Generate the content layer for one listing. Never throws. Returns a discriminated
 * outcome so the caller can distinguish a spend-cap wall ('budget' → stop the run) from
 * a one-off failure ('skip' → retry this listing later) from success.
 */
export async function generateListingContent(
  input: ListingContentInput
): Promise<ListingContentOutcome> {
  const cleanedDesc = cleanListingDescription(input.description) || input.description || '';
  const toolLines = (input.tools || [])
    .slice(0, 30)
    .map((t) => `- ${t.name}${t.description ? `: ${t.description}` : ''}`)
    .join('\n');

  const userContent = [
    `Name: ${input.name}`,
    `Category: ${input.category}`,
    `Repository/Source: ${input.url}`,
    `Current description: ${cleanedDesc || '(none)'}`,
    toolLines ? `Tools it exposes over MCP:\n${toolLines}` : '',
    input.readme ? `README (excerpt):\n${input.readme.slice(0, README_BUDGET)}` : 'README: (unavailable)',
  ]
    .filter(Boolean)
    .join('\n\n');

  const result = await chatJson<{
    summary?: string;
    overview?: string;
    useCases?: unknown;
    features?: unknown;
    faq?: unknown;
  }>({
    model: 'gpt-4.1-mini',
    temperature: 0.3,
    maxTokens: 800,
    timeoutMs: 20_000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  });

  if (!result.ok) {
    return BUDGET_REASONS.has(result.reason)
      ? { status: 'budget', reason: result.reason }
      : { status: 'skip', reason: result.reason };
  }

  const summary = clampSentence(result.data.summary, 150);
  const overview = clampSentence(result.data.overview, 600);
  const useCases = clampList(result.data.useCases, 5, 120);
  const features = clampList(result.data.features, 6, 100);
  const faq = clampFaq(result.data.faq, 5, 150, 400);

  // A usable summary is the minimum bar — without it the page gains nothing over the raw scrape.
  if (!summary || summary.length < 12) return { status: 'skip', reason: 'empty' };

  return { status: 'ok', content: { summary, overview, useCases, features, faq } };
}
