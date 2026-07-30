import categoryManifest from './category-manifest.json';

/**
 * Full directory category list (emoji labels as stored on listings).
 *
 * Sourced from lib/category-manifest.json — a tiny build-time snapshot of the
 * catalog's categories (see scripts/build-category-manifest.mjs). This module is
 * imported by 'use client' components (DirectoryGrid, SubmitForm), so it must NOT
 * import the ~1.5 MB data/mcp-servers.json, which would ship the whole catalog in
 * the client bundle. The manifest keeps this in sync with the data at build time.
 */
export const DIRECTORY_CATEGORIES: string[] = categoryManifest as string[];

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
