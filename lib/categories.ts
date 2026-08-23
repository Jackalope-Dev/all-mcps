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
  lightColor: string;
  bgTint: string;
  borderTint: string;
  gradient: string;
  lightGradient: string;
  keywords: string[];
};

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: 'dev',
    label: 'Dev & Coding',
    emoji: '💻',
    color: '#00E5FF',
    lightColor: '#0284c7',
    bgTint: 'rgba(0, 229, 255, 0.1)',
    borderTint: 'rgba(0, 229, 255, 0.3)',
    gradient: 'linear-gradient(135deg, #00E5FF, #007BFF)',
    lightGradient: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%)',
    keywords: ['developer', 'coding', 'code', 'version', 'command', 'embedded', 'agents', 'development'],
  },
  {
    id: 'data',
    label: 'Databases & Data',
    emoji: '🗄️',
    color: '#A855F7',
    lightColor: '#7e22ce',
    bgTint: 'rgba(168, 85, 247, 0.1)',
    borderTint: 'rgba(168, 85, 247, 0.3)',
    gradient: 'linear-gradient(135deg, #A855F7, #6366F1)',
    lightGradient: 'linear-gradient(135deg, rgba(126, 34, 206, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%)',
    keywords: ['database', 'data', 'visualization', 'science'],
  },
  {
    id: 'ai',
    label: 'AI & Knowledge',
    emoji: '🧠',
    color: '#F59E0B',
    lightColor: '#b45309',
    bgTint: 'rgba(245, 158, 11, 0.1)',
    borderTint: 'rgba(245, 158, 11, 0.3)',
    gradient: 'linear-gradient(135deg, #F59E0B, #D97706)',
    lightGradient: 'linear-gradient(135deg, rgba(180, 83, 9, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%)',
    keywords: ['rag', 'search', 'conversational', 'knowledge', 'memory', 'research', 'ai'],
  },
  {
    id: 'cloud',
    label: 'Cloud & Systems',
    emoji: '☁️',
    color: '#0EA5E9',
    lightColor: '#0369a1',
    bgTint: 'rgba(14, 165, 233, 0.1)',
    borderTint: 'rgba(14, 165, 233, 0.3)',
    gradient: 'linear-gradient(135deg, #0EA5E9, #2563EB)',
    lightGradient: 'linear-gradient(135deg, rgba(3, 105, 161, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%)',
    keywords: ['cloud', 'architecture', 'industrial', 'iot', 'aerospace', 'environment'],
  },
  {
    id: 'productivity',
    label: 'Productivity & Work',
    emoji: '🏢',
    color: '#10B981',
    lightColor: '#047857',
    bgTint: 'rgba(16, 185, 129, 0.1)',
    borderTint: 'rgba(16, 185, 129, 0.3)',
    gradient: 'linear-gradient(135deg, #10B981, #059669)',
    lightGradient: 'linear-gradient(135deg, rgba(4, 120, 87, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%)',
    keywords: ['workplace', 'productivity', 'communication', 'product', 'support', 'agreements'],
  },
  {
    id: 'security',
    label: 'Security & Auth',
    emoji: '🔒',
    color: '#F43F5E',
    lightColor: '#be123c',
    bgTint: 'rgba(244, 63, 94, 0.1)',
    borderTint: 'rgba(244, 63, 94, 0.3)',
    gradient: 'linear-gradient(135deg, #F43F5E, #E11D48)',
    lightGradient: 'linear-gradient(135deg, rgba(190, 18, 60, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%)',
    keywords: ['security', 'cryptography', 'delivery', 'aggregators'],
  },
  {
    id: 'finance',
    label: 'Finance & Commerce',
    emoji: '💰',
    color: '#22C55E',
    lightColor: '#15803d',
    bgTint: 'rgba(34, 197, 94, 0.1)',
    borderTint: 'rgba(34, 197, 94, 0.3)',
    gradient: 'linear-gradient(135deg, #22C55E, #15803D)',
    lightGradient: 'linear-gradient(135deg, rgba(21, 128, 61, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%)',
    keywords: ['finance', 'fintech', 'e-commerce', 'legal', 'real estate', 'customer'],
  },
  {
    id: 'media',
    label: 'Media, Web & Bio',
    emoji: '🌐',
    color: '#EC4899',
    lightColor: '#be185d',
    bgTint: 'rgba(236, 72, 153, 0.1)',
    borderTint: 'rgba(236, 72, 153, 0.3)',
    gradient: 'linear-gradient(135deg, #EC4899, #8B5CF6)',
    lightGradient: 'linear-gradient(135deg, rgba(190, 24, 93, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%)',
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
    lightColor: matchedGroup.lightColor || matchedGroup.color,
    bgTint: matchedGroup.bgTint,
    borderTint: matchedGroup.borderTint,
    gradient: matchedGroup.gradient,
    lightGradient: matchedGroup.lightGradient,
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

/** Known legacy slug mappings -> canonical category name */
export const LEGACY_SLUG_MAP: Record<string, string> = {
  'end-to-end-rag-platforms': '🔎 Search & Data Extraction',
  'rag-platforms': '🔎 Search & Data Extraction',
  'development': '💻 Developer Tools',
  'development-and-coding': '💻 Developer Tools',
  'dev-tools': '💻 Developer Tools',
  'biology-medicine-and-bioinformatics': '🧬 Biology & Bioinformatics',
  'biology': '🧬 Biology & Bioinformatics',
  'other-tools-and-integrations': '🛠️ Other Tools and Integrations',
};

/** Resolve a landing-page slug back to its stored category, or undefined if unknown. */
export function categoryFromSlug(slug: string): string | undefined {
  if (!slug) return undefined;
  const normalizedSlug = slug.toLowerCase().trim();
  return CATEGORY_BY_SLUG[normalizedSlug] || LEGACY_SLUG_MAP[normalizedSlug];
}

/**
 * Known alias map for normalizing incoming submission categories, legacy entries,
 * or raw strings from AI agents into the exact canonical stored category.
 */
export const CATEGORY_ALIASES: Record<string, string> = {
  // Development variations -> 💻 Developer Tools
  'development': '💻 Developer Tools',
  'development & coding': '💻 Developer Tools',
  'dev tools': '💻 Developer Tools',
  'developer tool': '💻 Developer Tools',
  'devtools': '💻 Developer Tools',
  'coding': '💻 Developer Tools',
  'software development': '💻 Developer Tools',
  '🛠️ development & coding': '💻 Developer Tools',

  // Biology variations -> 🧬 Biology & Bioinformatics
  'biology, medicine and bioinformatics': '🧬 Biology & Bioinformatics',
  'biology': '🧬 Biology & Bioinformatics',
  'bioinformatics': '🧬 Biology & Bioinformatics',
  'medicine': '🧬 Biology & Bioinformatics',

  // RAG platforms -> 🧠 Knowledge & Memory or 🔎 Search & Data Extraction
  'end to end rag platforms': '🔎 Search & Data Extraction',
  '🔎 end to end rag platforms': '🔎 Search & Data Extraction',
  'rag': '🔎 Search & Data Extraction',

  // Database variations -> 🗄️ Databases
  'database': '🗄️ Databases',
  'db': '🗄️ Databases',
  'sql': '🗄️ Databases',

  // AI & ML -> 🗣️ Conversational AI or 🧠 Knowledge & Memory
  'ai': '🧠 Knowledge & Memory',
  'llm': '🧠 Knowledge & Memory',

  // API & Web -> 💻 Developer Tools
  'api': '💻 Developer Tools',
  'web': '📂 Browser Automation',

  // Security -> 🔒 Security
  'auth': '🔒 Security',
  'authentication': '🔒 Security',
};

/**
 * Normalizes any raw category string into an exact canonical category from DIRECTORY_CATEGORIES.
 * Ensures submitters, agents, and crons cannot introduce invalid or duplicate categories.
 */
/**
 * Hand-written intros for the highest-traffic categories; every other category gets a
 * templated-but-unique paragraph (label + count + named examples) so no page is thin
 * or duplicated. Shared by the category HTML page and the agent markdown renderer.
 */
const CURATED_CATEGORY_INTRO: Record<string, string> = {
  'developer-tools':
    'MCP servers that plug AI agents straight into the developer workflow — running code, managing repositories, querying build systems, and automating the everyday tasks engineers repeat all day.',
  'databases':
    'Connect Claude, Cursor, and other AI agents to your data. These MCP servers expose SQL and NoSQL databases, warehouses, and query engines so an agent can read, analyze, and (carefully) write real records.',
  'security':
    'Security-focused MCP servers for scanning, auditing, secrets management, and threat analysis — giving AI agents safe, scoped access to the tools security teams already rely on.',
  'search-and-data-extraction':
    'MCP servers that let agents search the web, scrape pages, and pull structured data out of unstructured sources — turning the open internet into a queryable tool.',
  'finance-and-fintech':
    'From market data to payments and on-chain activity, these MCP servers give AI agents access to financial APIs and fintech infrastructure with the guardrails that domain demands.',
  'knowledge-and-memory':
    'Persistent memory, note stores, and knowledge bases exposed over MCP, so agents can remember context across sessions and reason over your accumulated knowledge.',
  'browser-automation':
    'Drive a real browser from an AI agent: navigate, click, fill forms, and extract content. These MCP servers wrap headless browsers and automation frameworks behind the protocol.',
  'social-media':
    'MCP servers for posting, reading, and analyzing across social platforms — letting agents draft, schedule, and monitor content programmatically.',
  'data-platforms':
    'Analytics warehouses, data pipelines, and BI platforms exposed over MCP, so agents can pull metrics and run analysis against your production data stack.',
  'cloud-platforms':
    'Provision, inspect, and manage cloud infrastructure through MCP — giving agents scoped access to the APIs behind your deployments.',
  'aggregators':
    'MCP servers that sit in front of other MCP servers — routing, proxying, and merging multiple tool sets into a single connection so an agent can reach dozens of capabilities through one endpoint.',
  'communication':
    'MCP servers for email, chat, and messaging platforms — letting agents send, read, and triage conversations across the tools your team already uses.',
};

/** Builds the one-paragraph intro for a category landing page / markdown export. */
export function categoryIntroCopy(category: string, count: number, topNames: string[]): string {
  const slug = categorySlug(category);
  if (CURATED_CATEGORY_INTRO[slug]) return CURATED_CATEGORY_INTRO[slug];
  const { label } = parseCategoryLabel(category);
  const examples =
    topNames.length >= 2
      ? ` Popular picks include ${topNames.slice(0, 3).join(', ')}.`
      : '';
  return `Discover ${count.toLocaleString()} ${label} MCP server${count === 1 ? '' : 's'} for AI agents. Browse, compare, and install Model Context Protocol tools that connect Claude, Cursor, and other clients to ${label.toLowerCase()} capabilities.${examples}`;
}

export function normalizeCategory(input?: string | null): string {
  if (!input || !input.trim()) {
    return DEFAULT_SUBMIT_CATEGORY;
  }

  const raw = input.trim();
  const lower = raw.toLowerCase();

  // 1. Direct match with existing canonical category
  const exactMatch = DIRECTORY_CATEGORIES.find((c) => c === raw);
  if (exactMatch) return exactMatch;

  // 2. Direct case-insensitive match with canonical category
  const caseMatch = DIRECTORY_CATEGORIES.find((c) => c.toLowerCase() === lower);
  if (caseMatch) return caseMatch;

  // 3. Match without emoji (by label)
  const labelMatch = DIRECTORY_CATEGORIES.find((c) => parseCategoryLabel(c).label.toLowerCase() === lower);
  if (labelMatch) return labelMatch;

  // 4. Check explicit alias dictionary
  const aliasMatch = CATEGORY_ALIASES[lower];
  if (aliasMatch) {
    return aliasMatch;
  }

  // 5. Partial keyword search against canonical labels
  for (const canonical of DIRECTORY_CATEGORIES) {
    const { label } = parseCategoryLabel(canonical);
    const cleanLabel = label.toLowerCase();
    if (cleanLabel === lower || cleanLabel.includes(lower) || lower.includes(cleanLabel)) {
      return canonical;
    }
  }

  // Default fallback if completely unrecognized
  return DEFAULT_SUBMIT_CATEGORY;
}


