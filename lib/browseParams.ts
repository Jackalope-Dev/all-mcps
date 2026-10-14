import { categoryFromSlug, DIRECTORY_CATEGORIES } from './categories';

/**
 * /browse parameters: parsing, defaults and the query string, shared by the
 * server (lib/browse.ts, app/api/browse) and the grid in the browser. Pure, so
 * it is safe in 'use client' code.
 */

const BROWSE_SORTS = [
  'relevance',
  'popular',
  'trending',
  'most_upvoted',
  'most_viewed',
  'newest',
  'alpha',
] as const;
type BrowseSort = (typeof BROWSE_SORTS)[number];

const CLIENTS = ['cursor', 'claude', 'windsurf', 'cline'] as const;
const STACKS = ['typescript', 'python', 'go', 'rust'] as const;
const TRANSPORTS = ['stdio', 'remote'] as const;
const PRICING = ['free', 'freemium', 'paid', 'byok'] as const;
const AUTH = ['none', 'api_key', 'oauth', 'other'] as const;

export type BrowseParams = {
  q: string;
  category: string | null;
  client: (typeof CLIENTS)[number] | null;
  stack: (typeof STACKS)[number] | null;
  transport: (typeof TRANSPORTS)[number] | null;
  pricing: (typeof PRICING)[number] | null;
  auth: (typeof AUTH)[number] | null;
  verified: boolean;
  sort: BrowseSort;
  offset: number;
  limit: number;
};

/** Fixed page size: one size keeps the result cache small and hit often. */
export const BROWSE_PAGE_SIZE = 30;
/**
 * Deepest page served. Nobody reads 70 pages of a directory; capping keeps
 * crawler-driven deep offsets from turning into full-table sorts.
 */
export const BROWSE_MAX_OFFSET = 2010;
function pick<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | null {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

function resolveCategoryParam(raw: string | null): string | null {
  if (!raw) return null;
  if ((DIRECTORY_CATEGORIES as readonly string[]).includes(raw)) return raw;
  return categoryFromSlug(raw) ?? null;
}

/** Validated params from a query string; anything unknown falls back to "no filter". */
export function parseBrowseParams(sp: URLSearchParams): BrowseParams {
  const q = (sp.get('q') ?? '').trim().slice(0, 200);
  const sort =
    pick(sp.get('sort'), BROWSE_SORTS) ?? (q ? 'relevance' : 'trending');
  // Offsets snap to page boundaries so every request maps to a cacheable page.
  const rawOffset = Number.parseInt(sp.get('offset') ?? '0', 10) || 0;
  const offset = Math.min(
    BROWSE_MAX_OFFSET,
    Math.max(0, Math.floor(rawOffset / BROWSE_PAGE_SIZE) * BROWSE_PAGE_SIZE),
  );
  const limit = BROWSE_PAGE_SIZE;
  return {
    q,
    category: resolveCategoryParam(sp.get('category')),
    client: pick(sp.get('client'), CLIENTS),
    stack: pick(sp.get('stack'), STACKS),
    transport: pick(sp.get('transport'), TRANSPORTS),
    pricing: pick(sp.get('pricing'), PRICING),
    auth: pick(sp.get('auth'), AUTH),
    verified: sp.get('verified') === '1',
    // Relevance only means something with a query.
    sort: sort === 'relevance' && !q ? 'trending' : sort,
    offset,
    limit,
  };
}

/** Query string for params, omitting defaults — shared by the grid and the route. */
export function browseQueryString(p: Partial<BrowseParams>): string {
  const sp = new URLSearchParams();
  if (p.q) sp.set('q', p.q);
  if (p.category) sp.set('category', p.category);
  if (p.client) sp.set('client', p.client);
  if (p.stack) sp.set('stack', p.stack);
  if (p.transport) sp.set('transport', p.transport);
  if (p.pricing) sp.set('pricing', p.pricing);
  if (p.auth) sp.set('auth', p.auth);
  if (p.verified) sp.set('verified', '1');
  if (p.sort) sp.set('sort', p.sort);
  if (p.offset) sp.set('offset', String(p.offset));
  return sp.toString();
}
