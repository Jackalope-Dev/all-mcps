'use client';

import {
  BadgeCheck,
  ChevronRight,
  Clock,
  Download,
  Heart,
  LayoutGrid,
  List,
  Loader2,
  Search,
  Star,
  Wrench,
  X,
} from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  categorySlug,
  DIRECTORY_CATEGORIES,
  getCategoryMeta,
  normalizeCategory,
  parseCategoryLabel,
} from '../lib/categories';
import { parseServerName } from '../lib/displayName';
import {
  isFeaturedListing as isFeaturedListingShared,
  isVerifiedListing as isVerifiedListingShared,
} from '../lib/featuredStatus';
import {
  formatCommitAge,
  formatCompactNumber,
  formatFullDate,
} from '../lib/format';
import { trackSearch } from '../lib/gtag';
import {
  compileQuery,
  engagementScore,
  scoreServerMatch,
  trendingScore,
} from '../lib/search';
import { SponsorAdUnit } from './ads/SponsorAdUnit';
import { EmptyState } from './EmptyState';
import { ImpressionBeacon } from './ImpressionTracker';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { IconTooltip } from './ui/IconTooltip';
import { SafeMarkdown } from './ui/SafeMarkdown';
import { ServerAvatar } from './ui/ServerAvatar';

type Server = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  isOfficial: boolean;
  logoUrl?: string | null;
  /** Paid listing — counts as verified for browse filters. */
  isPremium?: boolean;
  featuredUntil?: string | Date | null;
  views?: number;
  copies?: number;
  upvotes?: number;
  githubStars?: number | null;
  npmDownloads?: number | null;
  /** Repo `pushed_at` from GitHub, refreshed by the health cron. */
  lastCommitAt?: string | Date | null;
  /** high | medium | low — from health cron / install resolver. */
  installConfidence?: string | null;
  installKind?: string | null;
  installCommand?: string | null;
  /** Space-joined tool names for search recall (from directory feed). */
  toolText?: string | null;
  /** Tool count only — full schemas stay server-side. */
  toolCount?: number;
  /** 'introspected' (live MCP handshake) | 'readme' (best-effort static parse) | null. */
  toolsSource?: string | null;
  pricingModel?: string | null;
  authType?: string | null;
  tags?: string[] | null;
  compatibleClients?: string[] | null;
  /** Bounded AI search text (summary + use cases + features) for intent-query recall. */
  aiText?: string | null;
  createdAt?: string | Date;
};

/** Claimed (badge/DNS) or premium/paid — shown as "Verified" in the directory. */
function isVerifiedListing(server: Server): boolean {
  return isVerifiedListingShared(server);
}

/** Premium subscription or active timed featured boost. */
function isFeaturedListing(server: Server): boolean {
  return isFeaturedListingShared(server);
}

type ViewMode = 'grid' | 'list';
type SortMode =
  | 'relevance'
  | 'trending'
  | 'most_upvoted'
  | 'most_viewed'
  | 'newest'
  | 'alpha';
type TechStack = 'all' | 'typescript' | 'python' | 'go' | 'rust';
type TransportKind = 'all' | 'stdio' | 'remote';

/** Deterministic slot so SSR HTML and client hydration produce the same tree.
 *  `Math.random()` here remounted the entire grid on every load. */
function stableAdSlot(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h, 31) + seed.charCodeAt(i)) | 0;
  }
  return 3 + (Math.abs(h) % 8);
}

export default function DirectoryGrid({
  initialServers,
  initialCategory = null,
  initialQuery = '',
  variant = 'landing',
  totalCount,
  lazyFeedUrl,
}: {
  initialServers: Server[];
  initialCategory?: string | null;
  initialQuery?: string;
  /** `landing` = homepage catalog slice; `browse` = dedicated list/filter page */
  variant?: 'landing' | 'browse';
  /** Full catalog size, when `initialServers` is a truncated subset (landing page only). Drives the "browse all" callout. */
  totalCount?: number;
  /**
   * When set, the grid renders `initialServers` for the first paint (kept small
   * for SEO + fast HTML) and fetches the full catalog from this URL on mount so
   * search/sort/filter cover everything without shipping the whole catalog in HTML.
   */
  lazyFeedUrl?: string;
}) {
  const isBrowse = variant === 'browse';
  const browseBase = '/browse';
  // Working dataset: seeded from the server-rendered slice, then replaced by the
  // full feed once `lazyFeedUrl` resolves (browse only).
  const [servers, setServers] = useState<Server[]>(initialServers);
  const [feedStatus, setFeedStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >(lazyFeedUrl ? 'loading' : 'idle');
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    initialCategory,
  );
  const [selectedClient, setSelectedClient] = useState<
    'all' | 'cursor' | 'claude' | 'windsurf' | 'cline'
  >('all');
  const [selectedStack, setSelectedStack] = useState<TechStack>('all');
  const [selectedTransport, setSelectedTransport] =
    useState<TransportKind>('all');
  const [selectedPricing, setSelectedPricing] = useState<
    'all' | 'free' | 'freemium' | 'paid' | 'byok'
  >('all');
  const [selectedAuth, setSelectedAuth] = useState<
    'all' | 'none' | 'api_key' | 'oauth' | 'other'
  >('all');
  // Default to relevance ordering whenever there's a query (incl. deep links).
  const [sortMode, setSortMode] = useState<SortMode>(
    initialQuery.trim() ? 'relevance' : 'trending',
  );
  // Landing favors visual discovery (grid); /browse defaults to power-user list.
  // localStorage may override after mount.
  const [viewMode, setViewMode] = useState<ViewMode>(
    isBrowse ? 'list' : 'grid',
  );
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(isBrowse ? 30 : 12);

  const SEARCH_PLACEHOLDERS = useMemo(
    () => [
      `Search ${typeof totalCount === 'number' && totalCount > 0 ? totalCount.toLocaleString('en-US') : 'thousands of'} MCP tools (e.g. GitHub, Postgres, Slack)...`,
      'Try searching: "find latest btc prices"...',
      'Try searching: "check transit times & train schedules"...',
      'Try searching: "query postgres database"...',
      'Try searching: "convert pdf documents to markdown"...',
      'Try searching: "send slack notifications with AI"...',
      'Try searching: "fetch github pull requests & issues"...',
    ],
    [totalCount],
  );

  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Rotating placeholders are decorative; pause when reduced motion is preferred
  // so the input isn't constantly changing under the cursor for sensitive users.
  useEffect(() => {
    if (searchQuery.trim()) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const timer = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % SEARCH_PLACEHOLDERS.length);
    }, 3200);
    return () => clearInterval(timer);
  }, [searchQuery, SEARCH_PLACEHOLDERS]);

  // Keep client state in sync when the server re-renders with new searchParams (e.g. category links)
  useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    setSearchQuery(initialQuery);
  }, [initialQuery]);

  // Auto-toggle relevance sorting as the query appears/clears, without overriding
  // a sort the user explicitly picked. Entering a query switches to relevance;
  // clearing it drops relevance back to trending (any other pick is preserved).
  const prevQueryEmptyRef = useRef(!initialQuery.trim());
  const adSlot = useMemo(
    () => stableAdSlot(initialServers[0]?.id ?? 'directory'),
    [initialServers],
  );
  useEffect(() => {
    const empty = !searchQuery.trim();
    if (!empty && prevQueryEmptyRef.current) {
      setSortMode('relevance');
    } else if (empty && !prevQueryEmptyRef.current) {
      setSortMode((prev) => (prev === 'relevance' ? 'trending' : prev));
    }
    prevQueryEmptyRef.current = empty;
  }, [searchQuery]);

  // Track whether the full feed has arrived so a server re-render (e.g. category
  // navigation swapping in a new SSR slice) doesn't shrink the working set back.
  const loadedFullRef = useRef(false);
  useEffect(() => {
    if (!loadedFullRef.current) setServers(initialServers);
  }, [initialServers]);

  // Lazy-load the full catalog on mount, replacing the SSR slice, so client-side
  // search/sort/filter cover everything (browse only). The feed is paged so no
  // single request has to carry the whole catalog (which could hang/time out).
  // The first page tells us `total`/`limit`, so the remaining pages are known
  // upfront and fetched concurrently (Promise.all) rather than one-by-one —
  // at ~10k+ servers / 1000 per page that's the difference between ~1 round
  // trip and ~11 serialized ones before search/filter/sort cover everything.
  // Partial results are kept — only a completely empty load surfaces the error state.
  useEffect(() => {
    if (!lazyFeedUrl) return;
    let cancelled = false;
    setFeedStatus('loading');

    (async () => {
      const sep = lazyFeedUrl.includes('?') ? '&' : '?';
      type FeedPage = {
        servers?: Server[];
        total?: number;
        limit?: number;
        nextOffset?: number | null;
      };
      const fetchPage = async (offset: number): Promise<FeedPage | null> => {
        try {
          const res = await fetch(`${lazyFeedUrl}${sep}offset=${offset}`);
          if (!res.ok) throw new Error(`directory feed ${res.status}`);
          return (await res.json()) as FeedPage;
        } catch {
          return null; // Network/HTTP error — caller keeps whatever it already has.
        }
      };

      const accumulated: Server[] = [];
      const first = await fetchPage(0);
      if (cancelled) return;

      if (first?.servers?.length) {
        accumulated.push(...first.servers);

        if (first.total && first.limit && first.servers.length < first.total) {
          const offsets: number[] = [];
          for (
            let offset = first.servers.length;
            offset < first.total;
            offset += first.limit
          ) {
            offsets.push(offset);
          }
          const rest = await Promise.all(offsets.map(fetchPage));
          if (cancelled) return;
          for (const page of rest) {
            if (page?.servers?.length) accumulated.push(...page.servers);
          }
        } else {
          // Server didn't report total/limit — fall back to walking nextOffset.
          let next = first.nextOffset;
          while (next != null) {
            const page = await fetchPage(next);
            if (cancelled) return;
            if (!page?.servers?.length) break;
            accumulated.push(...page.servers);
            next = page.nextOffset ?? null;
          }
        }
      }

      if (cancelled) return;
      if (accumulated.length) {
        loadedFullRef.current = true;
        // Merge with initialServers/prev once after full feed arrives to prevent stuttering/re-sorting on every chunk
        setServers((prev) => {
          const map = new Map<string, Server>();
          for (const s of prev) map.set(s.id, s);
          for (const s of accumulated) map.set(s.id, s);
          return Array.from(map.values());
        });
      }
      setFeedStatus(accumulated.length ? 'ready' : 'error');
    })();

    return () => {
      cancelled = true;
    };
  }, [lazyFeedUrl]);

  // Extract unique categories for the filter pill list
  const categories = useMemo(() => {
    const cats = new Set(servers.map((s) => s.category));
    return Array.from(cats).sort();
  }, [servers]);

  // Precompile the query once per keystroke; scoring stays cheap per row.
  const queryTerms = useMemo(() => compileQuery(searchQuery), [searchQuery]);
  const fullQuery = useMemo(
    () => queryTerms.map((t) => t.term).join(' '),
    [queryTerms],
  );

  const filteredServers = useMemo(() => {
    const hasQuery = queryTerms.length > 0;

    const stackMatch = (server: Server): boolean => {
      if (selectedStack === 'all') return true;
      const name = server.name.toLowerCase();
      const desc = (server.description || '').toLowerCase();
      const cmd = (server.installCommand || '').toLowerCase();
      if (selectedStack === 'typescript') {
        return (
          name.includes('ts') ||
          name.includes('typescript') ||
          desc.includes('typescript') ||
          desc.includes('npm') ||
          desc.includes('npx') ||
          cmd.includes('npx') ||
          cmd.includes('node')
        );
      }
      if (selectedStack === 'python') {
        return (
          name.includes('py') ||
          name.includes('python') ||
          desc.includes('python') ||
          desc.includes('uvx') ||
          desc.includes('pip') ||
          cmd.includes('uvx') ||
          cmd.includes('python') ||
          cmd.includes('pip')
        );
      }
      if (selectedStack === 'go') {
        return (
          name.includes('go-') ||
          name.includes('-go') ||
          desc.includes('golang') ||
          desc.includes(' go ') ||
          cmd.includes('go ')
        );
      }
      if (selectedStack === 'rust') {
        return (
          name.includes('rust') ||
          desc.includes('rust') ||
          desc.includes('cargo') ||
          cmd.includes('cargo')
        );
      }
      return true;
    };

    const transportMatch = (server: Server): boolean => {
      if (selectedTransport === 'all') return true;
      const kind = (
        server.installConfidence ||
        server.installKind ||
        ''
      ).toLowerCase();
      if (selectedTransport === 'stdio') {
        return (
          kind.includes('stdio') ||
          kind.includes('high') ||
          kind.includes('medium') ||
          !kind
        );
      }
      if (selectedTransport === 'remote') {
        return (
          kind.includes('sse') ||
          kind.includes('remote') ||
          kind.includes('http')
        );
      }
      return true;
    };

    const pricingMatch = (server: Server): boolean => {
      if (selectedPricing === 'all') return true;
      return (server.pricingModel || '').toLowerCase() === selectedPricing;
    };

    const authMatch = (server: Server): boolean => {
      if (selectedAuth === 'all') return true;
      return (server.authType || '').toLowerCase() === selectedAuth;
    };

    // Score once, filter on non-search facets, and drop query non-matches.
    const scored: Array<{ server: Server; relevance: number }> = [];
    const baseFiltered = servers.filter((server) => {
      if (selectedCategory) {
        if (
          server.category !== selectedCategory &&
          normalizeCategory(server.category) !==
            normalizeCategory(selectedCategory)
        ) {
          return false;
        }
      }
      if (verifiedOnly && !isVerifiedListing(server)) return false;
      if (!stackMatch(server)) return false;
      if (!transportMatch(server)) return false;
      if (!pricingMatch(server)) return false;
      if (!authMatch(server)) return false;

      if (selectedClient !== 'all') {
        const clients = Array.isArray(server.compatibleClients)
          ? server.compatibleClients.map((c) => String(c).toLowerCase())
          : [];
        const text =
          `${server.name} ${server.description} ${server.category}`.toLowerCase();
        const clientMatch =
          clients.some((c) => c.includes(selectedClient)) ||
          text.includes(selectedClient);
        if (!clientMatch) return false;
      }
      return true;
    });

    if (!hasQuery) {
      for (const server of baseFiltered) {
        scored.push({ server, relevance: 0 });
      }
    } else {
      // 1. Strict AND matching first (highest precision)
      for (const server of baseFiltered) {
        const relevance = scoreServerMatch(
          {
            name: server.name,
            description: server.description,
            category: server.category,
            toolText: server.toolText,
            extraText: server.aiText,
          },
          queryTerms,
          fullQuery,
          true,
        );
        if (relevance > 0) {
          scored.push({ server, relevance });
        }
      }

      // 2. If strict AND produced no matches and query has 2+ terms, fall back to relaxed OR pass
      if (scored.length === 0 && queryTerms.length >= 2) {
        for (const server of baseFiltered) {
          const relevance = scoreServerMatch(
            {
              name: server.name,
              description: server.description,
              category: server.category,
              toolText: server.toolText,
              extraText: server.aiText,
            },
            queryTerms,
            fullQuery,
            false,
          );
          if (relevance > 0) {
            scored.push({ server, relevance });
          }
        }
      }
    }

    // With a query, relevance is meaningful; fall back to trending when the user
    // has cleared the query but the sort state briefly still reads 'relevance'.
    const effectiveSort: SortMode =
      sortMode === 'relevance' && !hasQuery ? 'trending' : sortMode;

    scored.sort((x, y) => {
      const a = x.server;
      const b = y.server;
      // Featured/premium listings get the "higher ranking weight" the pricing page
      // promises — but only as a tiebreak ahead of the mode's own score, and only on
      // the two discovery-oriented modes. Objective modes (alpha, most viewed/upvoted)
      // stay literal, since buyers of a badge shouldn't distort a metric users trust.
      if (effectiveSort === 'relevance' || effectiveSort === 'trending') {
        const featuredBoost =
          (isFeaturedListing(b) ? 1 : 0) - (isFeaturedListing(a) ? 1 : 0);
        if (featuredBoost !== 0) return featuredBoost;
      }
      if (effectiveSort === 'relevance') {
        if (y.relevance !== x.relevance) return y.relevance - x.relevance;
        const ea = engagementScore(a);
        const eb = engagementScore(b);
        if (eb !== ea) return eb - ea;
      } else if (effectiveSort === 'trending') {
        const scoreA = trendingScore(a);
        const scoreB = trendingScore(b);
        if (scoreB !== scoreA) return scoreB - scoreA;
      } else if (effectiveSort === 'most_upvoted') {
        const upvotesA = a.upvotes || 0;
        const upvotesB = b.upvotes || 0;
        if (upvotesB !== upvotesA) return upvotesB - upvotesA;
        const starsA = a.githubStars || 0;
        const starsB = b.githubStars || 0;
        if (starsB !== starsA) return starsB - starsA;
      } else if (effectiveSort === 'most_viewed') {
        const viewsA = a.views || 0;
        const viewsB = b.views || 0;
        if (viewsB !== viewsA) return viewsB - viewsA;
      } else if (effectiveSort === 'alpha') {
        return a.name.localeCompare(b.name);
      }

      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    return scored.map((s) => s.server);
  }, [
    servers,
    queryTerms,
    fullQuery,
    selectedCategory,
    selectedStack,
    selectedTransport,
    selectedPricing,
    selectedAuth,
    sortMode,
    verifiedOnly,
  ]);

  const filteredCount = filteredServers.length;

  useEffect(() => {
    if (!searchQuery && !selectedCategory) return;
    const timer = setTimeout(() => {
      trackSearch({
        searchTerm: searchQuery,
        category: selectedCategory,
        resultCount: filteredCount,
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, filteredCount]);

  // Restore preferred view mode once on mount (overrides landing/browse defaults).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedView = window.localStorage.getItem('allmcps-view-mode');
    if (savedView === 'grid' || savedView === 'list') {
      setViewMode(savedView);
    }
  }, []);

  const updateUrl = (cat: string | null, q: string) => {
    if (typeof window === 'undefined') return;

    const base = isBrowse ? browseBase : '/';
    const url = new URL(base, window.location.origin);
    if (cat) {
      url.searchParams.set('category', categorySlug(cat));
    }
    if (q.trim()) {
      url.searchParams.set('q', q.trim());
    }
    // Client-side URL sync without hard reload
    window.history.replaceState({}, '', url.pathname + url.search);
  };

  const handleCategorySelect = (cat: string | null) => {
    if (!isBrowse && cat) {
      const url = new URL(browseBase, window.location.origin);
      url.searchParams.set('category', categorySlug(cat));
      if (searchQuery) url.searchParams.set('q', searchQuery.trim());
      window.location.assign(url.pathname + url.search);
      return;
    }
    setSelectedCategory(cat);
    updateUrl(cat, searchQuery);
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    updateUrl(selectedCategory, q);
  };

  /** Landing only has a truncated slice — Enter / explicit submit sends users to full browse search. */
  const goToFullDirectorySearch = (q: string = searchQuery) => {
    const term = q.trim();
    const url = new URL(browseBase, window.location.origin);
    if (term) url.searchParams.set('q', term);
    if (selectedCategory)
      url.searchParams.set('category', categorySlug(selectedCategory));
    window.location.assign(url.pathname + url.search);
  };

  const clearAllFilters = () => {
    setSelectedCategory(null);
    setSearchQuery('');
    setVerifiedOnly(false);
    setSelectedStack('all');
    setSelectedTransport('all');
    setSelectedPricing('all');
    setSelectedAuth('all');
    if (isBrowse) {
      updateUrl(null, '');
    }
  };

  const handleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('allmcps-view-mode', mode);
    }
  };

  // Reset pagination when searching, filtering, or sorting
  useEffect(() => {
    setVisibleCount(30);
  }, [
    searchQuery,
    selectedCategory,
    selectedStack,
    selectedTransport,
    sortMode,
    verifiedOnly,
  ]);

  const visibleServers = filteredServers.slice(0, visibleCount);
  const hasMore = visibleCount < filteredServers.length;

  const isFiltered =
    searchQuery.length > 0 ||
    selectedCategory !== null ||
    verifiedOnly ||
    selectedStack !== 'all' ||
    selectedTransport !== 'all' ||
    selectedPricing !== 'all' ||
    selectedAuth !== 'all';
  const categoryMeta = selectedCategory
    ? parseCategoryLabel(selectedCategory)
    : null;

  // Width for the category select so long names are never clipped
  const selectLabel = selectedCategory || 'All Categories';
  const selectMinCh = Math.min(Math.max(selectLabel.length + 4, 16), 48);

  const Stats = ({ server }: { server: Server }) => {
    const commitAge = formatCommitAge(server.lastCommitAt);
    return (
      <div className="directory-stats">
        <IconTooltip
          label={`${(server.upvotes || 0).toLocaleString('en-US')} upvotes`}
          asSpan
          trigger={
            <div
              style={{
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <Heart size={12} aria-hidden="true" />{' '}
              {formatCompactNumber(server.upvotes || 0)}
            </div>
          }
        >
          <span className="mcp-icon-tooltip-title">
            <Heart size={13} style={{ color: '#f43f5e' }} /> Upvotes
          </span>
          <span className="mcp-icon-tooltip-body">
            Community upvotes on AllMCPs.
          </span>
        </IconTooltip>

        {typeof server.githubStars === 'number' && (
          <IconTooltip
            label={`${server.githubStars.toLocaleString('en-US')} GitHub stars`}
            asSpan
            trigger={
              <div
                style={{
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <Star size={12} aria-hidden="true" />{' '}
                {formatCompactNumber(server.githubStars)}
              </div>
            }
          >
            <span className="mcp-icon-tooltip-title">
              <Star size={13} style={{ color: '#f5c518' }} /> GitHub Stars
            </span>
            <span className="mcp-icon-tooltip-body">
              Stargazers on the official GitHub repository.
            </span>
          </IconTooltip>
        )}

        <IconTooltip
          label={`${(server.copies || 0).toLocaleString('en-US')} installs`}
          asSpan
          trigger={
            <div
              style={{
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <Download size={12} aria-hidden="true" />{' '}
              {formatCompactNumber(server.copies || 0)}
            </div>
          }
        >
          <span className="mcp-icon-tooltip-title">
            <Download size={13} style={{ color: 'var(--accent-color)' }} />{' '}
            Installs &amp; Copy Actions
          </span>
          <span className="mcp-icon-tooltip-body">
            Total times users copied install commands or configuration snippets.
          </span>
        </IconTooltip>

        {typeof server.toolCount === 'number' && server.toolCount > 0 && (
          <IconTooltip
            label={`${server.toolCount} tools`}
            asSpan
            trigger={
              <div
                style={{
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <Wrench size={12} aria-hidden="true" />{' '}
                {formatCompactNumber(server.toolCount)}
              </div>
            }
          >
            <span className="mcp-icon-tooltip-title">
              <Wrench size={13} style={{ color: 'var(--accent-color)' }} /> Tool
              Schemas ({server.toolCount})
            </span>
            <span className="mcp-icon-tooltip-body">
              {server.toolsSource === 'introspected'
                ? 'Tools verified live via MCP tools/list protocol handshake.'
                : 'Tool count parsed from repository documentation.'}
            </span>
          </IconTooltip>
        )}

        {commitAge && (
          <IconTooltip
            label={`Last commit: ${commitAge}`}
            asSpan
            trigger={
              <div
                style={{
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <Clock size={12} aria-hidden="true" />{' '}
                <span suppressHydrationWarning>{commitAge}</span>
              </div>
            }
          >
            <span className="mcp-icon-tooltip-title">
              <Clock size={13} style={{ color: 'var(--accent-color)' }} />{' '}
              Repository Activity
            </span>
            <span className="mcp-icon-tooltip-body">
              {formatFullDate(server.lastCommitAt)
                ? `Last commit on ${formatFullDate(server.lastCommitAt)}`
                : `Last commit ${commitAge}`}
            </span>
          </IconTooltip>
        )}
      </div>
    );
  };

  const TransportBadge = ({ server }: { server: Server }) => {
    const isRemote =
      server.installKind === 'remote' ||
      (server.url &&
        !server.url.includes('github.com') &&
        !server.url.includes('gitlab.com'));
    return (
      <Badge
        variant="category"
        style={{
          background: isRemote
            ? 'rgba(0, 229, 255, 0.1)'
            : 'rgba(255, 255, 255, 0.04)',
          color: isRemote ? '#00E5FF' : 'var(--text-secondary)',
          borderColor: isRemote
            ? 'rgba(0, 229, 255, 0.3)'
            : 'var(--border-color)',
          fontSize: '0.68rem',
        }}
      >
        {isRemote ? 'SSE' : 'STDIO'}
      </Badge>
    );
  };

  const RuntimeBadge = ({ server }: { server: Server }) => {
    const cmd = (server.installCommand || '').toLowerCase();
    const desc = (server.description || '').toLowerCase();
    const name = (server.name || '').toLowerCase();

    let label = 'Node';
    if (
      cmd.includes('uvx') ||
      cmd.includes('python') ||
      cmd.includes('pip') ||
      desc.includes('python') ||
      name.includes('py')
    ) {
      label = 'Python';
    } else if (cmd.includes('docker') || desc.includes('docker')) {
      label = 'Docker';
    } else if (cmd.includes('go') || desc.includes('golang')) {
      label = 'Go';
    }

    return (
      <Badge
        variant="category"
        style={{
          background: 'var(--bg-muted)',
          color: 'var(--text-secondary)',
          fontSize: '0.68rem',
        }}
      >
        {label}
      </Badge>
    );
  };

  const resultSubtitle = (
    <>
      Showing{' '}
      <strong style={{ color: 'var(--text-primary)' }}>
        {filteredServers.length.toLocaleString('en-US')}
      </strong>{' '}
      {filteredServers.length === 1 ? 'server' : 'servers'}
      {selectedCategory ? ' in this category' : ''}
      {verifiedOnly ? ' (verified only)' : ''}
      {searchQuery ? <> matching &ldquo;{searchQuery}&rdquo;</> : null}
    </>
  );

  return (
    <>
      {/* Browse page title — the marketing hero (with its own <h1>) only renders on the
          unfiltered homepage landing, so the dedicated /browse route needs its own
          single, page-specific <h1> here instead of relying on the "Results" <h2> below. */}
      {isBrowse && (
        <section
          className="container animate-fade-in delay-1"
          style={{
            paddingTop: '2.5rem',
            paddingBottom: '1.25rem',
            textAlign: 'center',
          }}
        >
          <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>
            {categoryMeta
              ? `${categoryMeta.label} MCP Servers`
              : 'Browse MCP Servers'}
          </h1>
          <p
            className="text-lead"
            style={{ margin: '0 auto', maxWidth: '640px' }}
          >
            {categoryMeta
              ? `Model Context Protocol servers in the ${categoryMeta.label} category.`
              : 'Discover, filter, and connect verified Model Context Protocol tools to your AI agents.'}
          </p>
        </section>
      )}

      {/* Search Bar & Filters — browse only. The homepage playground owns discovery. */}
      {isBrowse && (
        <section
          id="directory-search"
          className="container animate-fade-in delay-2 directory-search-section"
        >
          <div className="directory-filters directory-filters-sticky">
            <form
              className="directory-search-bar"
              role="search"
              aria-label="Search MCP servers"
              onSubmit={(e) => {
                e.preventDefault();
                if (!isBrowse) {
                  goToFullDirectorySearch(searchQuery);
                }
              }}
            >
              <div className="directory-search-input-wrap">
                <Search
                  size={22}
                  className="directory-search-icon"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  name="q"
                  className="directory-search-input"
                  placeholder={SEARCH_PLACEHOLDERS[placeholderIndex]}
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isBrowse) {
                      e.preventDefault();
                      goToFullDirectorySearch(searchQuery);
                    }
                  }}
                  aria-label="Search MCP servers"
                  autoComplete="off"
                  enterKeyHint="search"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className="directory-search-clear"
                    onClick={() => handleSearchChange('')}
                    aria-label="Clear search"
                    title="Clear search"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              <div className="directory-search-divider" aria-hidden="true" />

              <div className="directory-search-category-wrap">
                <select
                  className="directory-search-category-select"
                  value={selectedCategory || ''}
                  onChange={(e) =>
                    handleCategorySelect(
                      e.target.value === '' ? null : e.target.value,
                    )
                  }
                  aria-label="Filter by category"
                >
                  <option value="">All Categories</option>
                  {(DIRECTORY_CATEGORIES.length > 0
                    ? DIRECTORY_CATEGORIES
                    : categories
                  ).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="directory-search-submit-btn"
                aria-label="Search"
              >
                <Search size={18} aria-hidden="true" />
                <span>Search</span>
              </button>
            </form>

            {/* Intent chips — popular situational queries */}
            {!searchQuery.trim() && (
              <div
                className="directory-intent-chips"
                role="group"
                aria-label="Popular searches"
              >
                <span className="directory-intent-label">Try searching:</span>
                {[
                  { q: 'postgres mysql sqlite', label: '🗄️ Databases & SQL' },
                  {
                    q: 'browser playwright puppeteer scrape',
                    label: '🌐 Web Scraping',
                  },
                  {
                    q: 'github git gitlab repository',
                    label: '💻 GitHub & Git',
                  },
                  {
                    q: 'memory vector embeddings rag',
                    label: '🧠 Agent Memory',
                  },
                  {
                    q: 'aws kubernetes docker cloudflare',
                    label: '☁️ Cloud & DevOps',
                  },
                  { q: 'pdf document markdown excel', label: '📄 PDF & Docs' },
                ].map((chip) => (
                  <button
                    key={chip.q}
                    type="button"
                    className="directory-intent-chip"
                    onClick={() => {
                      if (isBrowse) {
                        handleSearchChange(chip.q);
                      } else {
                        goToFullDirectorySearch(chip.q);
                      }
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}

            {/* Active filter pills (only shown when active filters exist) */}
            {isFiltered && (
              <div
                className="directory-tags-row"
                role="group"
                aria-label="Active filters"
              >
                {verifiedOnly && (
                  <button
                    type="button"
                    className="directory-tag directory-tag-active"
                    onClick={() => setVerifiedOnly(false)}
                    aria-label="Remove verified filter"
                  >
                    <BadgeCheck size={14} aria-hidden="true" />
                    Verified
                    <X size={12} aria-hidden="true" />
                  </button>
                )}

                {selectedCategory && (
                  <button
                    type="button"
                    className="directory-tag directory-tag-active"
                    onClick={() => handleCategorySelect(null)}
                    aria-label={`Remove category filter: ${selectedCategory}`}
                  >
                    {selectedCategory}
                    <X size={12} aria-hidden="true" />
                  </button>
                )}

                {selectedStack !== 'all' && (
                  <button
                    type="button"
                    className="directory-tag directory-tag-active"
                    onClick={() => setSelectedStack('all')}
                    aria-label={`Remove stack filter: ${selectedStack}`}
                  >
                    Stack: {selectedStack}
                    <X size={12} aria-hidden="true" />
                  </button>
                )}

                {selectedTransport !== 'all' && (
                  <button
                    type="button"
                    className="directory-tag directory-tag-active"
                    onClick={() => setSelectedTransport('all')}
                    aria-label={`Remove transport filter: ${selectedTransport}`}
                  >
                    Transport: {selectedTransport}
                    <X size={12} aria-hidden="true" />
                  </button>
                )}

                <button
                  type="button"
                  className="directory-tag"
                  onClick={clearAllFilters}
                  style={{ opacity: 0.8 }}
                  aria-label="Clear all filters"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Directory */}
      <section
        className="container animate-fade-in delay-3"
        style={{ marginBottom: '6rem' }}
      >
        {lazyFeedUrl && feedStatus === 'loading' && (
          <div
            className="directory-feed-status"
            role="status"
            aria-live="polite"
          >
            <Loader2
              size={16}
              aria-hidden="true"
              className="directory-feed-spinner"
            />
            Loading full directory so search and filters cover every listing…
          </div>
        )}
        {lazyFeedUrl && feedStatus === 'error' && (
          <div
            className="directory-feed-status directory-feed-status--warn"
            role="status"
          >
            Showing the initial page of results. Full-catalog search is
            temporarily unavailable — try refreshing.
          </div>
        )}

        {lazyFeedUrl && feedStatus === 'loading' && (
          <div className="directory-skeleton-grid" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="directory-skeleton-card surface" />
            ))}
          </div>
        )}

        <div className="directory-toolbar">
          <div>
            <h2
              style={{
                marginBottom: 0,
                fontSize: isBrowse || selectedCategory ? '1.5rem' : undefined,
              }}
              className={
                !isBrowse && !isFiltered ? 'landing-section-title' : undefined
              }
            >
              {isBrowse || selectedCategory || isFiltered
                ? 'Results'
                : 'New MCP servers'}{' '}
              <span
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '1.125rem',
                  fontWeight: 500,
                }}
              >
                ({filteredServers.length.toLocaleString('en-US')}{' '}
                {filteredServers.length === 1 ? 'tool' : 'tools'})
                {lazyFeedUrl && feedStatus === 'loading' ? ' · loading…' : ''}
              </span>
            </h2>
            {sortMode === 'trending' && !searchQuery.trim() && (
              <p className="directory-sort-hint">
                Sorted by recent engagement (upvotes, installs, views).
              </p>
            )}
            {sortMode === 'relevance' && searchQuery.trim() && (
              <p className="directory-sort-hint">
                Ranked by name, description, tools, and AI summary match for
                &ldquo;{searchQuery.trim()}&rdquo;.
              </p>
            )}
          </div>

          <div className="directory-toolbar-controls">
            <div
              className="directory-segmented"
              role="group"
              aria-label="Client filter"
            >
              {(
                [
                  ['all', 'All Clients'],
                  ['cursor', 'Cursor'],
                  ['claude', 'Claude'],
                  ['windsurf', 'Windsurf'],
                  ['cline', 'Cline'],
                ] as const
              ).map(([c, label]) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedClient(c)}
                  className={`directory-segmented-btn ${selectedClient === c ? 'is-active' : ''}`}
                  aria-pressed={selectedClient === c}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              className="directory-segmented"
              role="group"
              aria-label="Tech stack filter"
            >
              {(
                [
                  ['all', 'All Stacks'],
                  ['typescript', 'TypeScript'],
                  ['python', 'Python'],
                  ['go', 'Go'],
                  ['rust', 'Rust'],
                ] as const
              ).map(([stack, label]) => (
                <button
                  key={stack}
                  type="button"
                  onClick={() => setSelectedStack(stack)}
                  className={`directory-segmented-btn ${selectedStack === stack ? 'is-active' : ''}`}
                  aria-pressed={selectedStack === stack}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              className="directory-segmented"
              role="group"
              aria-label="Transport filter"
            >
              {(
                [
                  ['all', 'All Transports'],
                  ['stdio', 'STDIO'],
                  ['remote', 'SSE / Remote'],
                ] as const
              ).map(([tr, label]) => (
                <button
                  key={tr}
                  type="button"
                  onClick={() => setSelectedTransport(tr)}
                  className={`directory-segmented-btn ${selectedTransport === tr ? 'is-active' : ''}`}
                  aria-pressed={selectedTransport === tr}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              className="directory-segmented"
              role="group"
              aria-label="Pricing filter"
            >
              {(
                [
                  ['all', 'Any price'],
                  ['free', 'Free'],
                  ['freemium', 'Freemium'],
                  ['paid', 'Paid'],
                  ['byok', 'BYOK'],
                ] as const
              ).map(([p, label]) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPricing(p)}
                  className={`directory-segmented-btn ${selectedPricing === p ? 'is-active' : ''}`}
                  aria-pressed={selectedPricing === p}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              className="directory-segmented"
              role="group"
              aria-label="Auth filter"
            >
              {(
                [
                  ['all', 'Any auth'],
                  ['none', 'No auth'],
                  ['api_key', 'API key'],
                  ['oauth', 'OAuth'],
                ] as const
              ).map(([a, label]) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setSelectedAuth(a)}
                  className={`directory-segmented-btn ${selectedAuth === a ? 'is-active' : ''}`}
                  aria-pressed={selectedAuth === a}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              className="directory-segmented"
              role="group"
              aria-label="Sort order"
            >
              {(
                [
                  // Relevance only applies while searching; hidden otherwise.
                  ...(searchQuery.trim() ? [['relevance', 'Relevance']] : []),
                  ['trending', 'Trending'],
                  ['most_upvoted', 'Top Voted'],
                  ['most_viewed', 'Most Viewed'],
                  ['newest', 'Newest'],
                  ['alpha', 'A-Z'],
                ] as [SortMode, string][]
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSortMode(mode)}
                  className={`directory-segmented-btn ${sortMode === mode ? 'is-active' : ''}`}
                  aria-pressed={sortMode === mode}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              className="directory-segmented"
              role="group"
              aria-label="View mode"
            >
              <button
                type="button"
                onClick={() => handleViewMode('list')}
                className={`directory-segmented-btn directory-segmented-icon ${viewMode === 'list' ? 'is-active' : ''}`}
                aria-pressed={viewMode === 'list'}
                aria-label="List view"
                title="List view"
              >
                <List size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => handleViewMode('grid')}
                className={`directory-segmented-btn directory-segmented-icon ${viewMode === 'grid' ? 'is-active' : ''}`}
                aria-pressed={viewMode === 'grid'}
                aria-label="Grid view"
                title="Grid view"
              >
                <LayoutGrid size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {!isBrowse &&
          typeof totalCount === 'number' &&
          totalCount > initialServers.length && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                padding: '0.85rem 1.1rem',
                marginBottom: '1.5rem',
                borderRadius: '10px',
                border: '1px solid rgba(0, 229, 255, 0.25)',
                background: 'rgba(0, 229, 255, 0.06)',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
              }}
            >
              <span>
                {isFiltered
                  ? `Searching only the ${initialServers.length} listings on this page — press Enter or open Browse for the full catalog.`
                  : `Showing the ${initialServers.length} most recently added listings of ${totalCount.toLocaleString('en-US')} total.`}
              </span>
              <button
                type="button"
                onClick={() => goToFullDirectorySearch(searchQuery)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontWeight: 700,
                  color: 'var(--accent-color)',
                  whiteSpace: 'nowrap',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 'inherit',
                  padding: 0,
                }}
              >
                {searchQuery.trim()
                  ? `Search all ${totalCount.toLocaleString('en-US')} for “${searchQuery.trim().slice(0, 32)}${searchQuery.trim().length > 32 ? '…' : ''}”`
                  : `Browse all ${totalCount.toLocaleString('en-US')} servers`}{' '}
                <ChevronRight size={14} />
              </button>
            </div>
          )}

        {filteredServers.length === 0 ? (
          <div className="surface" style={{ borderStyle: 'dashed' }}>
            <EmptyState
              icon={<Search size={22} aria-hidden="true" />}
              title={
                searchQuery.trim()
                  ? `No servers match “${searchQuery.trim()}”`
                  : 'No tools found'
              }
              description={
                !isBrowse &&
                typeof totalCount === 'number' &&
                totalCount > initialServers.length
                  ? 'Nothing in this homepage preview matches. Try the full directory — or browse a popular category.'
                  : 'Try a broader query, clear filters, or explore a category below.'
              }
              actions={
                <div className="directory-empty-actions">
                  {!isBrowse && searchQuery.trim() && (
                    <Button
                      variant="primary"
                      onClick={() => goToFullDirectorySearch(searchQuery)}
                    >
                      Search full directory
                    </Button>
                  )}
                  {isFiltered && (
                    <Button variant="secondary" onClick={clearAllFilters}>
                      Clear all filters
                    </Button>
                  )}
                  <div className="directory-empty-suggestions">
                    {[
                      { href: '/best/databases', label: 'Best for databases' },
                      {
                        href: '/best/developer-tools',
                        label: 'Best for developers',
                      },
                      { href: '/categories', label: 'All categories' },
                      { href: '/submit', label: 'Submit a server' },
                    ].map((s) => (
                      <Link
                        key={s.href}
                        href={s.href}
                        className="directory-intent-chip"
                      >
                        {s.label}
                      </Link>
                    ))}
                  </div>
                </div>
              }
            />
          </div>
        ) : viewMode === 'grid' ? (
          <div className="directory-grid">
            {visibleServers.map((server, index) => {
              const surface =
                isFiltered && searchQuery
                  ? ('search_results' as const)
                  : selectedCategory
                    ? ('category_page' as const)
                    : ('browse_grid' as const);
              return (
                <React.Fragment key={server.id}>
                  {index === adSlot && (
                    <SponsorAdUnit placement="directory_inline" />
                  )}
                  <ImpressionBeacon serverId={server.id} surface={surface}>
                    <Card
                      href={`/mcp/${server.id}`}
                      className={`directory-card-uniform ${isFeaturedListing(server) ? 'directory-card-featured' : ''} ${isVerifiedListing(server) ? 'directory-card-verified' : ''}`.trim()}
                    >
                      <div className="directory-card-header">
                        <ServerAvatar
                          name={server.name}
                          logoUrl={server.logoUrl}
                          category={server.category}
                        />
                        <div
                          style={{
                            display: 'flex',
                            gap: '0.35rem',
                            flexWrap: 'wrap',
                            justifyContent: 'flex-end',
                          }}
                        >
                          {isFeaturedListing(server) && (
                            <Badge variant="success" className="badge-featured">
                              ★ Featured
                            </Badge>
                          )}
                          {isVerifiedListing(server) && (
                            <Badge variant="official">Verified</Badge>
                          )}
                        </div>
                      </div>
                      {(() => {
                        const { displayName, org } = parseServerName(
                          server.name,
                        );
                        return (
                          <div className="directory-card-title-block">
                            <h3 className="directory-card-title-text">
                              {displayName}
                            </h3>
                            {org && (
                              <div className="directory-card-org-text">
                                {org}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <div className="directory-card-desc-block">
                        <SafeMarkdown
                          content={
                            server.description || 'No description provided.'
                          }
                          isInline
                        />
                      </div>
                      <div className="directory-card-footer">
                        <div
                          style={{
                            display: 'flex',
                            gap: '0.4rem',
                            flexWrap: 'wrap',
                            minWidth: 0,
                            alignItems: 'center',
                          }}
                        >
                          {(() => {
                            const catMeta = getCategoryMeta(server.category);
                            return (
                              <Badge
                                variant="category"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                }}
                              >
                                <span aria-hidden="true">{catMeta.emoji}</span>
                                {catMeta.label}
                              </Badge>
                            );
                          })()}
                        </div>
                        <Stats server={server} />
                      </div>
                    </Card>
                  </ImpressionBeacon>
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div className="directory-list">
            {visibleServers.map((server, index) => {
              const surface =
                isFiltered && searchQuery
                  ? ('search_results' as const)
                  : selectedCategory
                    ? ('category_page' as const)
                    : ('browse_list' as const);
              return (
                <React.Fragment key={server.id}>
                  {index === adSlot && (
                    <SponsorAdUnit placement="directory_inline" layout="row" />
                  )}
                  <ImpressionBeacon serverId={server.id} surface={surface}>
                    <Link
                      href={`/mcp/${server.id}`}
                      className={`directory-list-row surface-interactive${isFeaturedListing(server) ? ' directory-list-row-featured' : ''}`}
                    >
                      <ServerAvatar
                        name={server.name}
                        logoUrl={server.logoUrl}
                        category={server.category}
                        size={44}
                      />
                      <div className="directory-list-body">
                        <div className="directory-list-title-row">
                          {(() => {
                            const { displayName, org } = parseServerName(
                              server.name,
                            );
                            return (
                              <div className="directory-list-name-col">
                                <h3 className="directory-list-name">
                                  {displayName}
                                </h3>
                                {org && (
                                  <span className="directory-list-org">
                                    {org}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                          {isFeaturedListing(server) && (
                            <Badge variant="success" className="badge-featured">
                              ★ Featured
                            </Badge>
                          )}
                          {isVerifiedListing(server) && (
                            <Badge variant="official">Verified</Badge>
                          )}
                          {!selectedCategory &&
                            (() => {
                              const catMeta = getCategoryMeta(server.category);
                              return (
                                <Badge
                                  variant="category"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                  }}
                                >
                                  <span aria-hidden="true">
                                    {catMeta.emoji}
                                  </span>
                                  {catMeta.label}
                                </Badge>
                              );
                            })()}
                        </div>
                        <div className="directory-list-desc">
                          <SafeMarkdown
                            content={
                              server.description || 'No description provided.'
                            }
                            isInline
                          />
                        </div>
                      </div>
                      <Stats server={server} />
                    </Link>
                  </ImpressionBeacon>
                </React.Fragment>
              );
            })}
          </div>
        )}

        {filteredServers.length > 0 && hasMore && (
          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <Button
              variant="secondary"
              onClick={() => setVisibleCount((v) => v + 30)}
            >
              Load More
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
