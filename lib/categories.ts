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
 * High-level category groups for clean, organized navigation (mcp.so style)
 */
export type CategoryGroup = {
  id: string;
  label: string;
  emoji: string;
  color: string;
  bgTint: string;
  borderTint: string;
  gradient: string;
  keywords: string[];
};

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: 'dev',
    label: 'Dev & Coding',
    emoji: '💻',
    color: '#00E5FF',
    bgTint: 'rgba(0, 229, 255, 0.1)',
    borderTint: 'rgba(0, 229, 255, 0.3)',
    gradient: 'linear-gradient(135deg, #00E5FF, #007BFF)',
    keywords: ['developer', 'coding', 'code', 'version', 'command', 'embedded', 'agents', 'development'],
  },
  {
    id: 'data',
    label: 'Databases & Data',
    emoji: '🗄️',
    color: '#A855F7',
    bgTint: 'rgba(168, 85, 247, 0.1)',
    borderTint: 'rgba(168, 85, 247, 0.3)',
    gradient: 'linear-gradient(135deg, #A855F7, #6366F1)',
    keywords: ['database', 'data', 'visualization', 'science'],
  },
  {
    id: 'ai',
    label: 'AI & Knowledge',
    emoji: '🧠',
    color: '#F59E0B',
    bgTint: 'rgba(245, 158, 11, 0.1)',
    borderTint: 'rgba(245, 158, 11, 0.3)',
    gradient: 'linear-gradient(135deg, #F59E0B, #D97706)',
    keywords: ['rag', 'search', 'conversational', 'knowledge', 'memory', 'research', 'ai'],
  },
  {
    id: 'cloud',
    label: 'Cloud & Systems',
    emoji: '☁️',
    color: '#0EA5E9',
    bgTint: 'rgba(14, 165, 233, 0.1)',
    borderTint: 'rgba(14, 165, 233, 0.3)',
    gradient: 'linear-gradient(135deg, #0EA5E9, #2563EB)',
    keywords: ['cloud', 'architecture', 'industrial', 'iot', 'aerospace', 'environment'],
  },
  {
    id: 'productivity',
    label: 'Productivity & Work',
    emoji: '🏢',
    color: '#10B981',
    bgTint: 'rgba(16, 185, 129, 0.1)',
    borderTint: 'rgba(16, 185, 129, 0.3)',
    gradient: 'linear-gradient(135deg, #10B981, #059669)',
    keywords: ['workplace', 'productivity', 'communication', 'product', 'support', 'agreements'],
  },
  {
    id: 'security',
    label: 'Security & Auth',
    emoji: '🔒',
    color: '#F43F5E',
    bgTint: 'rgba(244, 63, 94, 0.1)',
    borderTint: 'rgba(244, 63, 94, 0.3)',
    gradient: 'linear-gradient(135deg, #F43F5E, #E11D48)',
    keywords: ['security', 'cryptography', 'delivery', 'aggregators'],
  },
  {
    id: 'finance',
    label: 'Finance & Commerce',
    emoji: '💰',
    color: '#22C55E',
    bgTint: 'rgba(34, 197, 94, 0.1)',
    borderTint: 'rgba(34, 197, 94, 0.3)',
    gradient: 'linear-gradient(135deg, #22C55E, #15803D)',
    keywords: ['finance', 'fintech', 'e-commerce', 'legal', 'real estate', 'customer'],
  },
  {
    id: 'media',
    label: 'Media, Web & Bio',
    emoji: '🌐',
    color: '#EC4899',
    bgTint: 'rgba(236, 72, 153, 0.1)',
    borderTint: 'rgba(236, 72, 153, 0.3)',
    gradient: 'linear-gradient(135deg, #EC4899, #8B5CF6)',
    keywords: ['browser', 'multimedia', 'social', 'gaming', 'art', 'podcasts', 'speech', 'text', 'translation', 'education', 'sports', 'home', 'travel', 'spirituality', 'biology'],
  },
];

/**
 * Splits a stored category ("💻 Developer Tools") into its leading emoji and the
 * human-readable label. Handles multi-codepoint emoji (ZWJ sequences, variation
 * selectors, skin-tone modifiers) via Intl.Segmenter with a regex fallback.
 */
export function parseCategoryLabel(category: string): { emoji: string; label: string } {
  if (!category) return { emoji: '📂', label: 'General' };

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
  return { emoji: '📂', label: category };
}

/**
 * Returns comprehensive category metadata including emoji, label, group, theme color,
 * background tint, border color, and gradient.
 */
export function getCategoryMeta(category: string) {
  const { emoji, label } = parseCategoryLabel(category);
  const lower = (category || '').toLowerCase();

  // Find matching group based on keywords
  const matchedGroup = CATEGORY_GROUPS.find((g) =>
    g.keywords.some((kw) => lower.includes(kw))
  ) || CATEGORY_GROUPS[0];

  return {
    emoji: emoji || matchedGroup.emoji,
    label: label || category,
    color: matchedGroup.color,
    bgTint: matchedGroup.bgTint,
    borderTint: matchedGroup.borderTint,
    gradient: matchedGroup.gradient,
    group: matchedGroup,
  };
}

export function getCategoryColor(category: string): string {
  return getCategoryMeta(category).color;
}

export function getCategoryGradient(category: string): string {
  return getCategoryMeta(category).gradient;
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

