import serversData from '../data/mcp-servers.json';

/**
 * Full directory category list (emoji labels as stored on listings).
 * Derived from the catalog so submit form options stay in sync with browse filters.
 */
export const DIRECTORY_CATEGORIES: string[] = Array.from(
  new Set((serversData as { category: string }[]).map((s) => s.category).filter(Boolean))
).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

export const DEFAULT_SUBMIT_CATEGORY =
  DIRECTORY_CATEGORIES.find((c) => c.includes('Developer Tools')) ||
  DIRECTORY_CATEGORIES[0] ||
  '🛠️ Other Tools and Integrations';

/**
 * Splits a stored category ("💻 Developer Tools") into its leading emoji and the
 * human-readable label. Handles multi-codepoint emoji (ZWJ sequences, variation
 * selectors, skin-tone modifiers) via Intl.Segmenter with a regex fallback.
 */
export function parseCategoryLabel(category: string): { emoji: string; label: string } {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    const first = segmenter.segment(category)[Symbol.iterator]().next().value;
    if (first) {
      const char = first.segment;
      if (/\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(char)) {
        return { emoji: char, label: category.slice(char.length).trimStart() };
      }
    }
  }
  const match = category.match(/^(\p{Extended_Pictographic}(?:‍\p{Extended_Pictographic}|️|\p{Emoji_Modifier})*)\s*/u);
  if (match) {
    return { emoji: match[1], label: category.slice(match[0].length) };
  }
  return { emoji: '', label: category };
}

/**
 * URL slug for a category landing page (/categories/[slug]). Derived from the label
 * only — emoji are dropped and "&" becomes "and" so the slug stays ASCII and stable.
 * Verified collision-free across the current catalog (see the build).
 */
export function categorySlug(category: string): string {
  return parseCategoryLabel(category)
    .label.toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** slug -> canonical stored category string, built once from the catalog. */
export const CATEGORY_BY_SLUG: Record<string, string> = Object.fromEntries(
  DIRECTORY_CATEGORIES.map((c) => [categorySlug(c), c])
);

/** Resolve a landing-page slug back to its stored category, or undefined if unknown. */
export function categoryFromSlug(slug: string): string | undefined {
  return CATEGORY_BY_SLUG[slug];
}
