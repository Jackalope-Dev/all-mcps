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

export type AiListingContent = {
  /** One clean sentence, no trailing period stripping — used in cards, meta, digest. */
  summary: string;
  /** 2-4 sentences: what it does and when you'd reach for it. */
  overview: string;
  /** Concrete, specific use cases. */
  useCases: string[];
  /** Key capabilities / features. */
  features: string[];
};

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
  '"features" (3-6 short capability strings). If the material is too thin to support a field, return fewer items rather than guessing.';

/**
 * Generate the content layer for one listing. Returns null on any soft failure or when
 * the model can't produce at least a usable summary.
 */
export async function generateListingContent(
  input: ListingContentInput
): Promise<AiListingContent | null> {
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

  if (!result.ok) return null;

  const summary = clampSentence(result.data.summary, 150);
  const overview = clampSentence(result.data.overview, 600);
  const useCases = clampList(result.data.useCases, 5, 120);
  const features = clampList(result.data.features, 6, 100);

  // A usable summary is the minimum bar — without it the page gains nothing over the raw scrape.
  if (!summary || summary.length < 12) return null;

  return { summary, overview, useCases, features };
}
