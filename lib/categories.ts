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
