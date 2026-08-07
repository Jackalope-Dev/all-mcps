'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { FeaturedMarquee } from './FeaturedMarquee';
import { FeaturedCards } from './FeaturedCards';
import { Eye, Heart, Download, LayoutGrid, List, X, BadgeCheck, ChevronRight, Search, Star, Loader2, Package, Sparkles, Grid, ShieldCheck, Terminal, Zap, CheckCircle2, ArrowRight, Copy, Check } from 'lucide-react';
import { SafeMarkdown } from './ui/SafeMarkdown';
import { EmptyState } from './EmptyState';
import { ServerAvatar } from './ui/ServerAvatar';
import {
  isFeaturedListing as isFeaturedListingShared,
  isVerifiedListing as isVerifiedListingShared,
} from '../lib/featuredStatus';
import { parseServerName } from '../lib/displayName';
import { trackSearch, trackOutboundClick } from '../lib/gtag';
import { NewsletterSignupForm } from './forms/NewsletterSignupForm';
import { ImpressionBeacon } from './ImpressionTracker';
import { StatsBanner } from './StatsBanner';
import type { SiteStats } from '../lib/siteStats';
import { DIRECTORY_CATEGORIES, CATEGORY_GROUPS, getCategoryMeta, parseCategoryLabel } from '../lib/categories';
import { compileQuery, scoreServerMatch, engagementScore, trendingScore } from '../lib/search';


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
  /** high | medium | low — from health cron / install resolver. */
  installConfidence?: string | null;
  installKind?: string | null;
  installCommand?: string | null;
  /** Space-joined tool names for search recall (from directory feed). */
  toolText?: string | null;
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
type SortMode = 'relevance' | 'trending' | 'most_upvoted' | 'most_viewed' | 'newest' | 'alpha';
type TechStack = 'all' | 'typescript' | 'python' | 'go' | 'rust';
type TransportKind = 'all' | 'stdio' | 'remote';



export default function DirectoryGrid({
  initialServers,
  marqueeServers = [],
  featuredCards = [],
  initialCategory = null,
  initialQuery = '',
  variant = 'landing',
  totalCount,
  lazyFeedUrl,
  siteStats,
  fullCategoryCounts,
}: {
  initialServers: Server[];
  marqueeServers?: Server[];
  featuredCards?: Server[];
  initialCategory?: string | null;
  initialQuery?: string;
  /** `landing` = homepage with marketing hero; `browse` = dedicated list/filter page */
  variant?: 'landing' | 'browse';
  /** Full catalog size, when `initialServers` is a truncated subset (landing page only). Drives the "browse all" callout. */
  totalCount?: number;
  /**
   * When set, the grid renders `initialServers` for the first paint (kept small
   * for SEO + fast HTML) and fetches the full catalog from this URL on mount so
   * search/sort/filter cover everything without shipping the whole catalog in HTML.
   */
  lazyFeedUrl?: string;
  /** Aggregate platform stats (AI system reads, monthly visitors, countries) for hero social proof. */
  siteStats?: SiteStats;
  /** Full category counts from the backend catalog (landing view). */
  fullCategoryCounts?: Record<string, number>;
}) {
  const isBrowse = variant === 'browse';
  const browseBase = '/browse';
  // Working dataset: seeded from the server-rendered slice, then replaced by the
  // full feed once `lazyFeedUrl` resolves (browse only).
  const [servers, setServers] = useState<Server[]>(initialServers);
  const [feedStatus, setFeedStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    lazyFeedUrl ? 'loading' : 'idle'
  );
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory);
  const [selectedStack, setSelectedStack] = useState<TechStack>('all');
  const [selectedTransport, setSelectedTransport] = useState<TransportKind>('all');
  const [selectedPricing, setSelectedPricing] = useState<'all' | 'free' | 'freemium' | 'paid' | 'byok'>('all');
  const [selectedAuth, setSelectedAuth] = useState<'all' | 'none' | 'api_key' | 'oauth' | 'other'>('all');
  // Default to relevance ordering whenever there's a query (incl. deep links).
  const [sortMode, setSortMode] = useState<SortMode>(initialQuery.trim() ? 'relevance' : 'trending');
  // Landing favors visual discovery (grid); /browse defaults to power-user list.
  // localStorage may override after mount.
  const [viewMode, setViewMode] = useState<ViewMode>(isBrowse ? 'list' : 'grid');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);

  const SEARCH_PLACEHOLDERS = useMemo(
    () => [
      'Search 1,000+ MCP tools (e.g. GitHub, Postgres, Slack)...',
      'Try searching: "find latest btc prices"...',
      'Try searching: "check transit times & train schedules"...',
      'Try searching: "query postgres database"...',
      'Try searching: "convert pdf documents to markdown"...',
      'Try searching: "send slack notifications with AI"...',
      'Try searching: "fetch github pull requests & issues"...',
    ],
    []
  );

  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Rotating placeholders are decorative; pause when reduced motion is preferred
  // so the input isn't constantly changing under the cursor for sensitive users.
  useEffect(() => {
    if (searchQuery.trim()) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
  // single request has to carry the whole catalog (which could hang/time out);
  // we walk the pages, growing the working set as each arrives. Partial results
  // are kept — only a completely empty load surfaces the error state.
  useEffect(() => {
    if (!lazyFeedUrl) return;
    let cancelled = false;
    setFeedStatus('loading');

    (async () => {
      const accumulated: Server[] = [];
      let offset = 0;
      // Guard against a misbehaving `nextOffset` looping forever.
      for (let page = 0; page < 200; page++) {
        let data: { servers?: Server[]; nextOffset?: number | null } | null = null;
        try {
          const sep = lazyFeedUrl.includes('?') ? '&' : '?';
          const res = await fetch(`${lazyFeedUrl}${sep}offset=${offset}`);
          if (!res.ok) throw new Error(`directory feed ${res.status}`);
          data = await res.json();
        } catch {
          break; // Network/HTTP error — keep whatever we've gathered so far.
        }
        if (cancelled) return;

        const batch = data?.servers ?? [];
        if (batch.length) {
          accumulated.push(...batch);
          loadedFullRef.current = true;
          // Merge with initialServers/prev to prevent active category servers from flashing/dropping
          setServers((prev) => {
            const map = new Map<string, Server>();
            for (const s of prev) map.set(s.id, s);
            for (const s of accumulated) map.set(s.id, s);
            return Array.from(map.values());
          });
        }

        const next = data?.nextOffset;
        if (next == null || batch.length === 0) break;
        offset = next;
      }

      if (cancelled) return;
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

  // Top categories by count for quick-filter tags
  const topCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of servers) {
      counts.set(s.category, (counts.get(s.category) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);
  }, [servers]);

  // Precompile the query once per keystroke; scoring stays cheap per row.
  const queryTerms = useMemo(() => compileQuery(searchQuery), [searchQuery]);
  const fullQuery = useMemo(() => queryTerms.map((t) => t.term).join(' '), [queryTerms]);

  const filteredServers = useMemo(() => {
    const hasQuery = queryTerms.length > 0;

    const stackMatch = (server: Server): boolean => {
      if (selectedStack === 'all') return true;
      const name = server.name.toLowerCase();
      const desc = (server.description || '').toLowerCase();
      const cmd = (server.installCommand || '').toLowerCase();
      if (selectedStack === 'typescript') {
        return name.includes('ts') || name.includes('typescript') || desc.includes('typescript') || desc.includes('npm') || desc.includes('npx') || cmd.includes('npx') || cmd.includes('node');
      }
      if (selectedStack === 'python') {
        return name.includes('py') || name.includes('python') || desc.includes('python') || desc.includes('uvx') || desc.includes('pip') || cmd.includes('uvx') || cmd.includes('python') || cmd.includes('pip');
      }
      if (selectedStack === 'go') {
        return name.includes('go-') || name.includes('-go') || desc.includes('golang') || desc.includes(' go ') || cmd.includes('go ');
      }
      if (selectedStack === 'rust') {
        return name.includes('rust') || desc.includes('rust') || desc.includes('cargo') || cmd.includes('cargo');
      }
      return true;
    };

    const transportMatch = (server: Server): boolean => {
      if (selectedTransport === 'all') return true;
      const kind = (server.installConfidence || server.installKind || '').toLowerCase();
      if (selectedTransport === 'stdio') {
        return kind.includes('stdio') || kind.includes('high') || kind.includes('medium') || !kind;
      }
      if (selectedTransport === 'remote') {
        return kind.includes('sse') || kind.includes('remote') || kind.includes('http');
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
    for (const server of servers) {
      if (selectedCategory && server.category !== selectedCategory) continue;
      if (verifiedOnly && !isVerifiedListing(server)) continue;
      if (!stackMatch(server)) continue;
      if (!transportMatch(server)) continue;
      if (!pricingMatch(server)) continue;
      if (!authMatch(server)) continue;

      const relevance = hasQuery
        ? scoreServerMatch(
            {
              name: server.name,
              description: server.description,
              category: server.category,
              toolText: server.toolText,
              extraText: server.aiText,
            },
            queryTerms,
            fullQuery
          )
        : 0;
      if (hasQuery && relevance <= 0) continue;
      scored.push({ server, relevance });
    }

    // With a query, relevance is meaningful; fall back to trending when the user
    // has cleared the query but the sort state briefly still reads 'relevance'.
    const effectiveSort: SortMode = sortMode === 'relevance' && !hasQuery ? 'trending' : sortMode;

    scored.sort((x, y) => {
      const a = x.server;
      const b = y.server;
      // Featured/premium listings get the "higher ranking weight" the pricing page
      // promises — but only as a tiebreak ahead of the mode's own score, and only on
      // the two discovery-oriented modes. Objective modes (alpha, most viewed/upvoted)
      // stay literal, since buyers of a badge shouldn't distort a metric users trust.
      if (effectiveSort === 'relevance' || effectiveSort === 'trending') {
        const featuredBoost = (isFeaturedListing(b) ? 1 : 0) - (isFeaturedListing(a) ? 1 : 0);
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
  }, [servers, queryTerms, fullQuery, selectedCategory, selectedStack, selectedTransport, selectedPricing, selectedAuth, sortMode, verifiedOnly]);

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
      url.searchParams.set('category', cat);
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
      url.searchParams.set('category', cat);
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
    if (selectedCategory) url.searchParams.set('category', selectedCategory);
    window.location.assign(url.pathname + url.search);
  };

  const clearAllFilters = () => {
    setSelectedCategory(null);
    setSearchQuery('');
    setVerifiedOnly(false);
    setSelectedStack('all');
    setSelectedTransport('all');
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
  }, [searchQuery, selectedCategory, selectedStack, selectedTransport, sortMode, verifiedOnly]);

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
  // Discovery chrome (marquee / featured) only on the unfiltered marketing landing
  const showDiscovery = !isBrowse && !isFiltered;
  const categoryMeta = selectedCategory ? parseCategoryLabel(selectedCategory) : null;

  // Width for the category select so long names are never clipped
  const selectLabel = selectedCategory || 'All Categories';
  const selectMinCh = Math.min(Math.max(selectLabel.length + 4, 16), 48);

  const Stats = ({ server }: { server: Server }) => (
    <div className="directory-stats">
      <div title="Upvotes">
        <Heart size={12} aria-hidden="true" /> {(server.upvotes || 0).toLocaleString()}
      </div>
      {typeof server.githubStars === 'number' && (
        <div title="GitHub stars">
          <Star size={12} aria-hidden="true" /> {server.githubStars.toLocaleString()}
        </div>
      )}
      <div title="Install / copy actions">
        <Download size={12} aria-hidden="true" /> {(server.copies || 0).toLocaleString()}
      </div>
    </div>
  );

  /** Compact install-readiness chip — only when we have a real signal. */
  const InstallReadyBadge = ({ server }: { server: Server }) => {
    const conf = (server.installConfidence || '').toLowerCase();
    if (conf !== 'high' && conf !== 'medium') return null;
    const isHigh = conf === 'high';
    return (
      <Badge
        variant={isHigh ? 'official' : 'success'}
        title={
          isHigh
            ? 'Install command detected from README or listing signals'
            : 'Install path inferred — verify in the listing'
        }
      >
        {isHigh ? 'Install ready' : 'Install known'}
      </Badge>
    );
  };

  const TransportBadge = ({ server }: { server: Server }) => {
    const isRemote = server.installKind === 'remote' || (server.url && !server.url.includes('github.com') && !server.url.includes('gitlab.com'));
    return (
      <Badge
        variant="category"
        style={{
          background: isRemote ? 'rgba(0, 229, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)',
          color: isRemote ? '#00E5FF' : 'var(--text-secondary)',
          borderColor: isRemote ? 'rgba(0, 229, 255, 0.3)' : 'var(--border-color)',
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
    if (cmd.includes('uvx') || cmd.includes('python') || cmd.includes('pip') || desc.includes('python') || name.includes('py')) {
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
      <strong style={{ color: 'var(--text-primary)' }}>{filteredServers.length.toLocaleString()}</strong>{' '}
      {filteredServers.length === 1 ? 'server' : 'servers'}
      {selectedCategory ? ' in this category' : ''}
      {verifiedOnly ? ' (verified only)' : ''}
      {searchQuery ? (
        <>
          {' '}
          matching &ldquo;{searchQuery}&rdquo;
        </>
      ) : null}
    </>
  );

  const [activeCategoryGroup, setActiveCategoryGroup] = useState<string>('all');

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (fullCategoryCounts && Object.keys(fullCategoryCounts).length > 0) {
      for (const [cat, cnt] of Object.entries(fullCategoryCounts)) {
        counts.set(cat, cnt);
      }
    } else {
      for (const s of servers) {
        if (s.category) {
          counts.set(s.category, (counts.get(s.category) || 0) + 1);
        }
      }
    }
    return counts;
  }, [servers, fullCategoryCounts]);

  const featuredCategoryCards = useMemo(() => {
    const all = DIRECTORY_CATEGORIES.length > 0 ? DIRECTORY_CATEGORIES : categories;
    if (activeCategoryGroup === 'all') {
      return [...all]
        .sort((a, b) => (categoryCounts.get(b) || 0) - (categoryCounts.get(a) || 0))
        .slice(0, 12);
    }
    return all.filter((cat) => {
      const meta = getCategoryMeta(cat);
      return meta.group.id === activeCategoryGroup;
    });
  }, [activeCategoryGroup, categoryCounts, categories]);

  return (
    <>
      {/* Marketing hero — only on the unfiltered homepage landing.
          Hierarchy: value prop → primary search (below) → one secondary CTA strip. */}
      {!isBrowse && !selectedCategory && (
        <section className="container animate-fade-in delay-1 landing-hero">
          <h1 className="text-display">
            Discover &amp; Install <span className="text-brand-gradient">Model Context Protocol</span> Servers
          </h1>
          <p className="text-lead">
            The open directory for MCP servers. Connect Claude, Cursor, Windsurf, and AI agents to
            databases, tools, files, and APIs.
            {typeof totalCount === 'number' && totalCount > 0 ? (
              <>
                {' '}
                Explore{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{totalCount.toLocaleString()}+</strong>{' '}
                servers.
              </>
            ) : null}
          </p>

          <div className="landing-hero-actions">
            <a href="#directory-search" className="btn btn-primary btn-lg">
              <Search size={16} aria-hidden="true" /> Search servers
            </a>
            <Link href="/submit" className="btn btn-lg btn-submit-noticeable">
              <Sparkles size={16} aria-hidden="true" /> Submit a server
            </Link>
          </div>

          <div className="landing-hero-explore" aria-label="Explore AllMCPs">
            {[
              { href: '/browse', label: 'Browse all' },
              { href: '/best', label: 'Best of' },
              { href: '/categories', label: 'Categories' },
              { href: '/tools', label: 'Tools' },
              { href: '/guides', label: 'Guides' },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="landing-hero-explore-link">
                {item.label}
              </Link>
            ))}
          </div>

          <p className="landing-hero-clients">
            <span className="landing-hero-clients-label">Works with</span>
            {[
              { href: '/mcp-for-claude-desktop', label: 'Claude' },
              { href: '/mcp-for-cursor', label: 'Cursor' },
              { href: '/mcp-for-windsurf', label: 'Windsurf' },
              { href: '/mcp-for-cline', label: 'Cline' },
              { href: '/clients', label: 'All clients' },
            ].map((client, i, arr) => (
              <React.Fragment key={client.href}>
                <Link href={client.href} className="landing-hero-client-link">
                  {client.label}
                </Link>
                {i < arr.length - 1 ? <span className="landing-hero-client-sep" aria-hidden="true">·</span> : null}
              </React.Fragment>
            ))}
          </p>
        </section>
      )}

      {/* Trust-signal stats strip — three metrics max; detail on /trust */}
      {!isBrowse && !selectedCategory && <StatsBanner stats={siteStats} />}

      {/* Browse page title — the marketing hero (with its own <h1>) only renders on the
          unfiltered homepage landing above, so the dedicated /browse route needs its own
          single, page-specific <h1> here instead of relying on the "Results" <h2> below. */}
      {/* Browse page title — centered with proper header spacing */}
      {isBrowse && (
        <section className="container animate-fade-in delay-1" style={{ paddingTop: '2.5rem', paddingBottom: '1.25rem', textAlign: 'center' }}>
          <h1 className="text-page-title" style={{ marginBottom: '0.5rem' }}>
            {categoryMeta ? `${categoryMeta.label} MCP Servers` : 'Browse MCP Servers'}
          </h1>
          <p className="text-lead" style={{ margin: '0 auto', maxWidth: '640px' }}>
            {categoryMeta
              ? `Model Context Protocol servers in the ${categoryMeta.label} category.`
              : 'Discover, filter, and connect verified Model Context Protocol tools to your AI agents.'}
          </p>
        </section>
      )}

      {/* Search Bar & Filters — sticky on scroll so discovery stays one gesture away */}
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
              <Search size={22} className="directory-search-icon" aria-hidden="true" />
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
                onChange={(e) => handleCategorySelect(e.target.value === '' ? null : e.target.value)}
                aria-label="Filter by category"
              >
                <option value="">All Categories</option>
                {(DIRECTORY_CATEGORIES.length > 0 ? DIRECTORY_CATEGORIES : categories).map((cat) => (
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

          {/* Intent chips — popular queries that teach how search works */}
          {!searchQuery.trim() && (
            <div className="directory-intent-chips" role="group" aria-label="Popular searches">
              {[
                { q: 'postgres', label: 'Postgres' },
                { q: 'github issues', label: 'GitHub issues' },
                { q: 'browser automation', label: 'Browser automation' },
                { q: 'read pdf documents', label: 'PDF documents' },
                { q: 'slack notifications', label: 'Slack' },
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
            <div className="directory-tags-row" role="group" aria-label="Active filters">
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

      {/* Featured & Trending Cards (below search, hidden when filtering) */}
      {showDiscovery && <FeaturedCards servers={featuredCards} />}

      {/* Category Showcase Section (mcp.so vibe) — homepage landing only when not filtered */}
      {!isBrowse && !selectedCategory && !searchQuery && (
        <section className="container animate-fade-in delay-2" style={{ margin: '0 auto 2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Grid size={20} style={{ color: 'var(--accent-color)' }} aria-hidden="true" />
                <span>Browse by Category &amp; Ecosystem</span>
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.2rem 0 0' }}>
                Find ready-to-install MCP servers grouped by technology stack and workflow
              </p>
            </div>
            <Link href="/categories" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}>
              <span>All 50+ categories</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {/* Category Group Filter Tabs */}
          <div className="directory-tags-row" style={{ marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            <button
              type="button"
              className={`directory-tag ${activeCategoryGroup === 'all' ? 'directory-tag-active' : ''}`}
              onClick={() => setActiveCategoryGroup('all')}
            >
              ✨ All Featured
            </button>
            {CATEGORY_GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`directory-tag ${activeCategoryGroup === g.id ? 'directory-tag-active' : ''}`}
                onClick={() => setActiveCategoryGroup(g.id)}
                style={{
                  borderColor: activeCategoryGroup === g.id ? g.color : undefined,
                  color: activeCategoryGroup === g.id ? g.color : undefined,
                  background: activeCategoryGroup === g.id ? g.bgTint : undefined,
                }}
              >
                <span aria-hidden="true">{g.emoji}</span>
                <span>{g.label}</span>
              </button>
            ))}
          </div>

          {/* Category Showcase Cards */}
          <div className="categories-grid">
            {featuredCategoryCards.map((catName) => {
              const meta = getCategoryMeta(catName);
              const count = categoryCounts.get(catName) || 0;
              const isSelected = selectedCategory === catName;
              return (
                <Link
                  key={catName}
                  href={`/browse?category=${encodeURIComponent(catName)}`}
                  className={`category-card surface-interactive ${isSelected ? 'category-card-selected' : ''}`}
                  style={{
                    textAlign: 'left',
                    textDecoration: 'none',
                    border: isSelected ? `2px solid ${meta.color}` : `1px solid ${meta.borderTint || meta.color + '40'}`,
                    background: isSelected
                      ? `linear-gradient(135deg, ${meta.color}25 0%, var(--bg-elevated) 100%)`
                      : `linear-gradient(135deg, ${meta.color}15 0%, var(--bg-elevated) 100%)`,
                    boxShadow: isSelected ? `0 0 20px ${meta.color}35` : `var(--shadow-sm)`,
                    cursor: 'pointer',
                  }}
                >
                  <div
                    className="category-card-emoji"
                    aria-hidden="true"
                    style={{
                      background: isSelected ? `${meta.color}30` : `${meta.color}18`,
                      borderColor: isSelected ? meta.color : (meta.borderTint || `${meta.color}40`),
                      boxShadow: `0 2px 10px ${meta.color}20`,
                    }}
                  >
                    {meta.emoji}
                  </div>
                  <div className="category-card-content">
                    <h3 className="category-card-label" style={{ color: isSelected ? meta.color : 'var(--text-primary)' }}>
                      {meta.label}
                    </h3>
                    <span className="category-card-count" style={{ color: 'var(--text-secondary)' }}>
                      {count > 0 ? `Browse ${count.toLocaleString()} ${meta.label} MCP ${count === 1 ? 'server' : 'servers'}` : 'Explore MCP servers'}
                    </span>
                  </div>
                  <span className="category-card-arrow" aria-hidden="true" style={{ color: meta.color }}>
                    →
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Featured Marquee near top of the discovery section */}
      {showDiscovery && <FeaturedMarquee servers={marqueeServers} />}



      {showDiscovery && (
        <section className="container newsletter-homepage-section">
          <div>
            <h3 style={{ margin: '0 0 0.25rem' }}>Get new MCP servers in your inbox</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              A roundup of new and top submissions — no spam, unsubscribe anytime.
            </p>
          </div>
          <NewsletterSignupForm source="homepage" compact />
        </section>
      )}

      {/* Directory */}
      <section className="container animate-fade-in delay-3" style={{ marginBottom: '6rem' }}>
        {lazyFeedUrl && feedStatus === 'loading' && (
          <div className="directory-feed-status" role="status" aria-live="polite">
            <Loader2 size={16} aria-hidden="true" className="directory-feed-spinner" />
            Loading full directory so search and filters cover every listing…
          </div>
        )}
        {lazyFeedUrl && feedStatus === 'error' && (
          <div className="directory-feed-status directory-feed-status--warn" role="status">
            Showing the initial page of results. Full-catalog search is temporarily unavailable — try
            refreshing.
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
            <h2 style={{ marginBottom: 0, fontSize: isBrowse || selectedCategory ? '1.5rem' : undefined }}>
              {isBrowse || selectedCategory || isFiltered ? 'Results' : 'Newest Servers'}{' '}
              <span style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', fontWeight: 500 }}>
                ({filteredServers.length.toLocaleString()} {filteredServers.length === 1 ? 'tool' : 'tools'})
                {lazyFeedUrl && feedStatus === 'loading' ? ' · loading…' : ''}
              </span>
            </h2>
            {sortMode === 'trending' && !searchQuery.trim() && (
              <p className="directory-sort-hint">Sorted by recent engagement (upvotes, installs, views).</p>
            )}
            {sortMode === 'relevance' && searchQuery.trim() && (
              <p className="directory-sort-hint">
                Ranked by name, description, tools, and AI summary match for &ldquo;{searchQuery.trim()}&rdquo;.
              </p>
            )}
          </div>

          <div className="directory-toolbar-controls">
            <div className="directory-segmented" role="group" aria-label="Tech stack filter">
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

            <div className="directory-segmented" role="group" aria-label="Transport filter">
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

            <div className="directory-segmented" role="group" aria-label="Pricing filter">
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

            <div className="directory-segmented" role="group" aria-label="Auth filter">
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

            <div className="directory-segmented" role="group" aria-label="Sort order">
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

            <div className="directory-segmented" role="group" aria-label="View mode">
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

        {!isBrowse && typeof totalCount === 'number' && totalCount > initialServers.length && (
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
                : `Showing the ${initialServers.length} most recently added listings of ${totalCount.toLocaleString()} total.`}
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
                ? `Search all ${totalCount.toLocaleString()} for “${searchQuery.trim().slice(0, 32)}${searchQuery.trim().length > 32 ? '…' : ''}”`
                : `Browse all ${totalCount.toLocaleString()} servers`}{' '}
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {filteredServers.length === 0 ? (
          <div className="surface" style={{ borderStyle: 'dashed' }}>
            <EmptyState
              icon={<Search size={22} aria-hidden="true" />}
              title={searchQuery.trim() ? `No servers match “${searchQuery.trim()}”` : 'No tools found'}
              description={
                !isBrowse && typeof totalCount === 'number' && totalCount > initialServers.length
                  ? 'Nothing in this homepage preview matches. Try the full directory — or browse a popular category.'
                  : 'Try a broader query, clear filters, or explore a category below.'
              }
              actions={
                <div className="directory-empty-actions">
                  {!isBrowse && searchQuery.trim() && (
                    <Button variant="primary" onClick={() => goToFullDirectorySearch(searchQuery)}>
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
                      { href: '/best/developer-tools', label: 'Best for developers' },
                      { href: '/categories', label: 'All categories' },
                      { href: '/submit', label: 'Submit a server' },
                    ].map((s) => (
                      <Link key={s.href} href={s.href} className="directory-intent-chip">
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
            {visibleServers.map((server) => {
              const surface = isFiltered && searchQuery ? 'search_results' as const : selectedCategory ? 'category_page' as const : 'browse_grid' as const;
              return (
              <ImpressionBeacon key={server.id} serverId={server.id} surface={surface}>
              <Card
                href={`/mcp/${server.id}`}
                className={`directory-card-uniform ${isFeaturedListing(server) ? 'directory-card-featured' : ''} ${isVerifiedListing(server) ? 'directory-card-verified' : ''}`.trim()}
              >
                <div className="directory-card-header">
                  <ServerAvatar name={server.name} logoUrl={server.logoUrl} category={server.category} />
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {isFeaturedListing(server) && (
                      <Badge variant="success" className="badge-featured">
                        ★ Featured
                      </Badge>
                    )}
                    {isVerifiedListing(server) && <Badge variant="official">Verified</Badge>}
                  </div>
                </div>
                {(() => {
                  const { displayName, org } = parseServerName(server.name);
                  return (
                    <div className="directory-card-title-block">
                      <h3 className="directory-card-title-text">{displayName}</h3>
                      {org && <div className="directory-card-org-text">{org}</div>}
                    </div>
                  );
                })()}
                <div className="directory-card-desc-block">
                  <SafeMarkdown content={server.description || 'No description provided.'} isInline />
                </div>
                <div className="directory-card-footer">
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', minWidth: 0, alignItems: 'center' }}>
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
              );
            })}
          </div>
        ) : (
          <div className="directory-list">
            {visibleServers.map((server) => {
              const surface = isFiltered && searchQuery ? 'search_results' as const : selectedCategory ? 'category_page' as const : 'browse_list' as const;
              return (
              <ImpressionBeacon key={server.id} serverId={server.id} surface={surface}>
              <Link
                href={`/mcp/${server.id}`}
                className={`directory-list-row surface-interactive${isFeaturedListing(server) ? ' directory-list-row-featured' : ''}`}
              >
                <ServerAvatar name={server.name} logoUrl={server.logoUrl} category={server.category} size={44} />
                <div className="directory-list-body">
                  <div className="directory-list-title-row">
                    {(() => {
                      const { displayName, org } = parseServerName(server.name);
                      return (
                        <div className="directory-list-name-col">
                          <h3 className="directory-list-name">{displayName}</h3>
                          {org && <span className="directory-list-org">{org}</span>}
                        </div>
                      );
                    })()}
                    {isFeaturedListing(server) && (
                      <Badge variant="success" className="badge-featured">
                        ★ Featured
                      </Badge>
                    )}
                    {isVerifiedListing(server) && <Badge variant="official">Verified</Badge>}
                    {!selectedCategory && (
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
                            <span aria-hidden="true">{catMeta.emoji}</span>
                            {catMeta.label}
                          </Badge>
                        );
                      })()
                    )}
                  </div>
                  <div className="directory-list-desc">
                    <SafeMarkdown content={server.description || 'No description provided.'} isInline />
                  </div>
                </div>
                <Stats server={server} />
              </Link>
              </ImpressionBeacon>
              );
            })}
          </div>
        )}

        {filteredServers.length > 0 && hasMore && (
          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <Button variant="secondary" onClick={() => setVisibleCount((v) => v + 30)}>
              Load More
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
