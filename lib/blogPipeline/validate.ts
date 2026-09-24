/**
 * Deterministic quality gate for generated blog drafts — the half of the
 * self-review loop that doesn't depend on an LLM's judgment. Mirrors the
 * AGENTS.md "Blog Posts" rules (plain `##` headings, 2-5 tags, 800+ words) and
 * adds link hygiene: every internal link must resolve to a page we know exists,
 * so a hallucinated /mcp/<id> never ships as a 404.
 */

import { keywordTokens } from './similarity';

export type DraftFields = {
  title: string;
  slug: string;
  excerpt: string;
  primaryKeyword: string;
  tags: string[];
  faq: { q: string; a: string }[];
  content: string;
};

export type ValidationResult = {
  /** Blocking problems the reviser must fix. */
  issues: string[];
  wordCount: number;
  internalLinks: string[];
};

export const MIN_WORDS = 1100;
export const MAX_WORDS = 3200;
const MIN_H2 = 4;
const MIN_INTERNAL_LINKS = 4;

/** Filler that reads as generic AI copy — the same spirit as aiContent's banned openers. */
const BANNED_PHRASES = [
  "in today's fast-paced",
  'in the ever-evolving',
  'ever-changing landscape',
  'delve into',
  "let's dive in",
  'game-changer',
  'game changer',
  'revolutionize',
  'unlock the power',
  'unleash',
  'seamlessly',
  'in conclusion',
  'it is important to note',
  "it's important to note",
  'as an ai',
  'lorem ipsum',
  '[todo',
  'tbd',
];

const INTERNAL_LINK_RE =
  /\]\((?:https?:\/\/(?:www\.)?allmcps\.com)?(\/[^)\s#?]*)[^)]*\)/g;
const EXTERNAL_LINK_RE = /\]\((https?:\/\/[^)\s]+)\)/g;

function stripCode(md: string): string {
  return md.replace(/```[\s\S]*?```/g, ' ');
}

export function countWords(md: string): number {
  return stripCode(md).split(/\s+/).filter(Boolean).length;
}

/** Internal link paths in the body (normalized, trailing slash removed). */
export function extractInternalLinks(md: string): string[] {
  const out: string[] = [];
  for (const m of stripCode(md).matchAll(INTERNAL_LINK_RE)) {
    const path = m[1].replace(/\/+$/, '') || '/';
    out.push(path);
  }
  return out;
}

/**
 * Remove links to unknown internal paths, keeping the anchor text. Applied
 * before validation so one hallucinated URL costs a link, not the whole draft.
 */
export function stripUnknownInternalLinks(
  md: string,
  isKnown: (path: string) => boolean,
): { content: string; removed: string[] } {
  const removed: string[] = [];
  const content = md.replace(
    /\[([^\]]+)\]\((?:https?:\/\/(?:www\.)?allmcps\.com)?(\/[^)\s]*)\)/g,
    (full, text: string, href: string) => {
      const path = href.split(/[#?]/)[0].replace(/\/+$/, '') || '/';
      if (isKnown(path)) return full;
      removed.push(path);
      return text;
    },
  );
  return { content, removed };
}

export function validateDraft(
  draft: DraftFields,
  isKnownPath: (path: string) => boolean,
): ValidationResult {
  const issues: string[] = [];
  const body = draft.content;
  const wordCount = countWords(body);

  if (draft.title.length < 20 || draft.title.length > 75)
    issues.push(
      `Title must be 20-75 characters (is ${draft.title.length}); put the primary keyword near the start.`,
    );
  if (draft.excerpt.length < 90 || draft.excerpt.length > 200)
    issues.push(
      `Excerpt must be 90-200 characters (is ${draft.excerpt.length}); it is the meta description.`,
    );
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug))
    issues.push('Slug must be lowercase words joined by hyphens.');
  if (draft.tags.length < 2 || draft.tags.length > 5)
    issues.push(`Use 2-5 tags (has ${draft.tags.length}).`);
  if (draft.faq.length < 3 || draft.faq.length > 6)
    issues.push(`FAQ must have 3-6 items (has ${draft.faq.length}).`);

  if (wordCount < MIN_WORDS)
    issues.push(
      `Body is ${wordCount} words; it needs at least ${MIN_WORDS}. Add depth (examples, config, trade-offs), not filler.`,
    );
  if (wordCount > MAX_WORDS)
    issues.push(`Body is ${wordCount} words; cut it below ${MAX_WORDS}.`);

  if (/^#\s/m.test(body))
    issues.push(
      'Do not use a level-1 "# " heading; the page renders the title.',
    );
  const h2s = body.match(/^##\s+.+$/gm) || [];
  if (h2s.length < MIN_H2)
    issues.push(`Use at least ${MIN_H2} "## " sections (has ${h2s.length}).`);
  const styledHeadings = h2s.filter((h) => /[*_`[\]]/.test(h.slice(3)));
  if (styledHeadings.length > 0)
    issues.push(
      `Headings must be plain text (no bold, italics, code or links): ${styledHeadings.slice(0, 3).join(' | ')}`,
    );
  if (/^##\s+(faq|frequently asked questions)/im.test(body))
    issues.push(
      'Remove the FAQ section from the body; FAQs go in the "faq" field only (the page renders them).',
    );

  // The primary keyword's intent tokens must appear in the title and early in the body.
  const kwTokens = [...keywordTokens(draft.primaryKeyword)];
  const titleTokens = keywordTokens(draft.title);
  const missingInTitle = kwTokens.filter((t) => !titleTokens.has(t));
  if (kwTokens.length > 0 && missingInTitle.length > kwTokens.length / 2)
    issues.push(
      `Title should target the primary keyword "${draft.primaryKeyword}".`,
    );
  const intro = keywordTokens(
    stripCode(body).split(/\s+/).slice(0, 150).join(' '),
  );
  const missingInIntro = kwTokens.filter((t) => !intro.has(t));
  if (kwTokens.length > 0 && missingInIntro.length > kwTokens.length / 2)
    issues.push(
      `Mention the primary keyword "${draft.primaryKeyword}" in the first paragraph, which should answer the query directly.`,
    );

  const lower = body.toLowerCase();
  const banned = BANNED_PHRASES.filter((p) => lower.includes(p));
  if (banned.length > 0)
    issues.push(`Remove filler phrases: ${banned.join(', ')}.`);

  const internalLinks = extractInternalLinks(body);
  const unknown = internalLinks.filter((p) => !isKnownPath(p));
  if (unknown.length > 0)
    issues.push(
      `These internal links do not exist; use only URLs from the provided link list: ${[...new Set(unknown)].join(', ')}`,
    );
  const distinctKnown = new Set(internalLinks.filter(isKnownPath));
  if (distinctKnown.size < MIN_INTERNAL_LINKS)
    issues.push(
      `Link to at least ${MIN_INTERNAL_LINKS} distinct pages from the provided internal link list (has ${distinctKnown.size}).`,
    );

  for (const m of body.matchAll(EXTERNAL_LINK_RE)) {
    if (m[1].startsWith('http://'))
      issues.push(`Use https for external links: ${m[1]}`);
  }

  for (const item of draft.faq) {
    if (item.a.length < 60) issues.push(`FAQ answer too thin for "${item.q}".`);
  }

  return { issues, wordCount, internalLinks };
}
