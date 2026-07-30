'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { FeaturedMarquee } from './FeaturedMarquee';
import { FeaturedCards } from './FeaturedCards';
import { Eye, Heart, Download, LayoutGrid, List, X, BadgeCheck, ChevronRight, Search } from 'lucide-react';
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
import { DIRECTORY_CATEGORIES } from '../lib/categories';

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
type SortMode = 'trending' | 'most_upvoted' | 'most_viewed' | 'newest' | 'alpha';
type TechStack = 'all' | 'typescript' | 'python' | 'go' | 'rust';

function parseCategoryLabel(category: string): { emoji: string; label: string } {
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
  const match = category.match(/^(\p{Extended_Pictographic}(?:\u200D\p{Extended_Pictographic}|\uFE0F)*)\s*/u);
  if (match) {
    return { emoji: match[1], label: category.slice(match[0].length) };
  }
  return { emoji: '', label: category };
}

export default function DirectoryGrid({
  initialServers,
  marqueeServers = [],
  featuredCards = [],
  initialCategory = null,
  initialQuery = '',
  variant = 'landing',
  totalCount,
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
}) {
  const isBrowse = variant === 'browse';
  const browseBase = '/browse';
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory);
  const [selectedStack, setSelectedStack] = useState<TechStack>('all');
  const [sortMode, setSortMode] = useState<SortMode>('trending');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);

  // Keep client state in sync when the server re-renders with new searchParams (e.g. category links)
  useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    setSearchQuery(initialQuery);
  }, [initialQuery]);

  // Extract unique categories for the filter pill list
  const categories = useMemo(() => {
    const cats = new Set(initialServers.map((s) => s.category));
    return Array.from(cats).sort();
  }, [initialServers]);

  // Top categories by count for quick-filter tags
  const topCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of initialServers) {
      counts.set(s.category, (counts.get(s.category) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);
  }, [initialServers]);

  const filteredServers = useMemo(() => {
    let result = initialServers.filter((server) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        server.name.toLowerCase().includes(q) ||
        server.description.toLowerCase().includes(q) ||
        server.category.toLowerCase().includes(q);
      const matchesCategory = selectedCategory ? server.category === selectedCategory : true;
      const matchesVerified = verifiedOnly ? isVerifiedListing(server) : true;

      const matchesStack = (() => {
        if (selectedStack === 'all') return true;
        const name = server.name.toLowerCase();
        const desc = server.description.toLowerCase();
        const url = server.url.toLowerCase();

        if (selectedStack === 'typescript') {
          return name.includes('ts') || name.includes('typescript') || desc.includes('typescript') || desc.includes('npm') || desc.includes('npx');
        }
        if (selectedStack === 'python') {
          return name.includes('py') || name.includes('python') || desc.includes('python') || desc.includes('uvx') || desc.includes('pip');
        }
        if (selectedStack === 'go') {
          return name.includes('go-') || name.includes('-go') || desc.includes('golang') || desc.includes(' go ');
        }
        if (selectedStack === 'rust') {
          return name.includes('rust') || desc.includes('rust') || desc.includes('cargo');
        }
        return true;
      })();

      return matchesSearch && matchesCategory && matchesVerified && matchesStack;
    });

    result.sort((a, b) => {
      if (sortMode === 'trending') {
        const scoreA = (a.upvotes || 0) * 5 + (a.copies || 0);
        const scoreB = (b.upvotes || 0) * 5 + (b.copies || 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
      } else if (sortMode === 'most_upvoted') {
        if ((b.upvotes || 0) !== (a.upvotes || 0)) return (b.upvotes || 0) - (a.upvotes || 0);
      } else if (sortMode === 'most_viewed') {
        if ((b.views || 0) !== (a.views || 0)) return (b.views || 0) - (a.views || 0);
      } else if (sortMode === 'alpha') {
        return a.name.localeCompare(b.name);
      }

      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    return result;
  }, [initialServers, searchQuery, selectedCategory, selectedStack, sortMode, verifiedOnly]);

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

  // Restore preferred view mode once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedView = window.localStorage.getItem('allmcps-view-mode');
    if (savedView === 'grid' || savedView === 'list') {
      setViewMode(savedView);
    }
  }, []);

  const updateUrl = (cat: string | null, q: string) => {
    if (typeof window === 'undefined') return;

    // Homepage: only category picks jump to the dedicated browse page.
    // Search on the landing stays client-side so typing doesn't reload every keystroke.
    if (!isBrowse) {
      if (cat) {
        const url = new URL(browseBase, window.location.origin);
        url.searchParams.set('category', cat);
        if (q.trim()) url.searchParams.set('q', q.trim());
        window.location.assign(url.pathname + url.search);
      }
      return;
    }

    const url = new URL(browseBase, window.location.origin);
    if (cat) {
      url.searchParams.set('category', cat);
    }
    if (q.trim()) {
      url.searchParams.set('q', q.trim());
    }
    // Client-side URL sync without full RSC re-fetch
    window.history.replaceState({}, '', url.pathname + url.search);
  };

  const handleCategorySelect = (cat: string | null) => {
    if (!isBrowse && cat) {
      const url = new URL(browseBase, window.location.origin);
      url.searchParams.set('category', cat);
      if (searchQuery.trim()) url.searchParams.set('q', searchQuery.trim());
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

  const clearAllFilters = () => {
    setSelectedCategory(null);
    setSearchQuery('');
    setVerifiedOnly(false);
    setSelectedStack('all');
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
  }, [searchQuery, selectedCategory, selectedStack, sortMode, verifiedOnly]);

  const visibleServers = filteredServers.slice(0, visibleCount);
  const hasMore = visibleCount < filteredServers.length;

  const isFiltered = searchQuery.length > 0 || selectedCategory !== null || verifiedOnly || selectedStack !== 'all';
  // Discovery chrome (marquee / featured) only on the unfiltered marketing landing
  const showDiscovery = !isBrowse && !isFiltered;
  const categoryMeta = selectedCategory ? parseCategoryLabel(selectedCategory) : null;

  // Width for the category select so long names are never clipped
  const selectLabel = selectedCategory || 'All Categories';
  const selectMinCh = Math.min(Math.max(selectLabel.length + 4, 16), 48);

  const Stats = ({ server }: { server: Server }) => (
    <div className="directory-stats">
      <div title="Unique views">
        <Eye size={12} aria-hidden="true" /> {(server.views || 0).toLocaleString()}
      </div>
      <div title="Install / copy actions">
        <Download size={12} aria-hidden="true" /> {(server.copies || 0).toLocaleString()}
      </div>
      <div title="Upvotes">
        <Heart size={12} aria-hidden="true" /> {(server.upvotes || 0).toLocaleString()}
      </div>
    </div>
  );

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

  return (
    <>
      {/* Marketing hero — only on the unfiltered homepage landing */}
      {!isBrowse && !selectedCategory && (
        <section className="container animate-fade-in delay-1 landing-hero">
          <h1 className="text-display">
            Give your AI agents <span className="text-brand-gradient">superpowers</span>.
          </h1>
          <p className="text-lead">
            Find the best tools to connect your favorite LLMs directly to local files, databases, and external APIs.
          </p>
          <p className="text-meta" style={{ marginTop: '0.75rem' }}>
            Building your own? See <Link href="/build-mcp-server">How to Build an MCP Server</Link>.
          </p>
        </section>
      )}

      {/* Browse page header — list-first view for all (or filtered) servers */}
      {isBrowse && !selectedCategory && (
        <section className="container animate-fade-in delay-1 directory-category-header">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumb" style={{ marginBottom: '1.25rem', paddingTop: 0 }}>
              <li>
                <Link href="/">Home</Link>
              </li>
              <li className="breadcrumb-separator">
                <ChevronRight size={12} />
              </li>
              <li className="breadcrumb-current">Browse</li>
            </ol>
          </nav>

          <div className="directory-category-title-row">
            <div>
              <p className="directory-category-kicker">Directory</p>
              <h1 className="directory-category-title">Browse MCP Servers</h1>
              <p className="directory-category-subtitle">{resultSubtitle}</p>
            </div>
            {isFiltered && (
              <Button
                variant="secondary"
                onClick={clearAllFilters}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
              >
                <X size={16} /> Clear filters
              </Button>
            )}
          </div>
        </section>
      )}

      {/* Category context header — cleaner focused view when a category is selected */}
      {selectedCategory && categoryMeta && (
        <section className="container animate-fade-in delay-1 directory-category-header">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumb" style={{ marginBottom: '1.25rem', paddingTop: 0 }}>
              <li>
                <Link
                  href={browseBase}
                  onClick={(e) => {
                    // Stay client-side on the browse page; full nav when leaving homepage category view
                    if (isBrowse) {
                      e.preventDefault();
                      clearAllFilters();
                    }
                  }}
                >
                  Browse
                </Link>
              </li>
              <li className="breadcrumb-separator">
                <ChevronRight size={12} />
              </li>
              <li>
                <Link href="/categories">Categories</Link>
              </li>
              <li className="breadcrumb-separator">
                <ChevronRight size={12} />
              </li>
              <li className="breadcrumb-current">{categoryMeta.label}</li>
            </ol>
          </nav>

          <div className="directory-category-title-row">
            <div>
              <p className="directory-category-kicker">Category</p>
              <h1 className="directory-category-title">
                {categoryMeta.emoji ? (
                  <span className="directory-category-emoji" aria-hidden="true">
                    {categoryMeta.emoji}
                  </span>
                ) : null}
                {categoryMeta.label}
              </h1>
              <p className="directory-category-subtitle">{resultSubtitle}</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                handleCategorySelect(null);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
            >
              <X size={16} /> Clear category
            </Button>
          </div>
        </section>
      )}

      {/* Marquee (above search, hidden when filtering) */}
      {showDiscovery && <FeaturedMarquee servers={marqueeServers} />}

      {/* Search Bar & Filters */}
      <section
        className="container animate-fade-in delay-2"
        style={{
          margin: isBrowse || selectedCategory ? '0 auto 2rem' : '0 auto 4rem',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div className="directory-filters">
          <div className="directory-filters-row">
            <Input
              type="text"
              placeholder="Search for tools (e.g. GitHub, Postgres, File System)..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              aria-label="Search MCP Servers"
              inputClassName="search-input"
              style={{ flexGrow: 1, flexBasis: '280px', margin: 0, minWidth: 0 }}
            />

            <select
              className="form-input directory-category-select"
              style={{
                minWidth: `min(100%, ${selectMinCh}ch)`,
                width: `min(100%, max(14rem, ${selectMinCh}ch))`,
                flex: '1 1 auto',
                maxWidth: '100%',
              }}
              value={selectedCategory || ''}
              onChange={(e) => handleCategorySelect(e.target.value === '' ? null : e.target.value)}
              aria-label="Filter by Category"
            >
              <option value="">All Categories</option>
              {(DIRECTORY_CATEGORIES.length > 0 ? DIRECTORY_CATEGORIES : categories).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Active filters + quick tags */}
          <div className="directory-tags-row">
            <button
              type="button"
              className={`directory-tag ${verifiedOnly ? 'directory-tag-active' : ''}`}
              onClick={() => setVerifiedOnly((v) => !v)}
              aria-pressed={verifiedOnly}
              title="Show listings that claimed ownership (badge/DNS) or have a premium listing"
            >
              <BadgeCheck size={14} />
              Verified
            </button>

            {selectedCategory && (
              <button
                type="button"
                className="directory-tag directory-tag-active"
                onClick={() => handleCategorySelect(null)}
              >
                {selectedCategory}
                <X size={12} />
              </button>
            )}

            {searchQuery && (
              <button
                type="button"
                className="directory-tag directory-tag-active"
                onClick={() => handleSearchChange('')}
              >
                Search: {searchQuery.length > 24 ? `${searchQuery.slice(0, 24)}…` : searchQuery}
                <X size={12} />
              </button>
            )}

            {isBrowse &&
              !selectedCategory &&
              topCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className="directory-tag"
                  onClick={() => handleCategorySelect(cat)}
                >
                  {cat}
                </button>
              ))}
          </div>
        </div>
      </section>

      {/* Featured Cards (below search, hidden when filtering) */}
      {showDiscovery && <FeaturedCards servers={featuredCards} />}

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
        <div className="directory-toolbar">
          <h2 style={{ marginBottom: 0, fontSize: isBrowse || selectedCategory ? '1.5rem' : undefined }}>
            {isBrowse || selectedCategory || isFiltered ? 'Results' : 'Directory'}{' '}
            <span style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', fontWeight: 500 }}>
              ({filteredServers.length.toLocaleString()} {filteredServers.length === 1 ? 'tool' : 'tools'})
            </span>
          </h2>

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

            <div className="directory-segmented" role="group" aria-label="Sort order">
              {(
                [
                  ['trending', 'Trending'],
                  ['most_upvoted', 'Top Voted'],
                  ['most_viewed', 'Most Viewed'],
                  ['newest', 'Newest'],
                  ['alpha', 'A-Z'],
                ] as const
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
                <List size={16} />
              </button>
              <button
                type="button"
                onClick={() => handleViewMode('grid')}
                className={`directory-segmented-btn directory-segmented-icon ${viewMode === 'grid' ? 'is-active' : ''}`}
                aria-pressed={viewMode === 'grid'}
                aria-label="Grid view"
                title="Grid view"
              >
                <LayoutGrid size={16} />
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
                ? `Search and sort here only cover the ${initialServers.length} listings shown below — not the full catalog.`
                : `Showing the ${initialServers.length} most recently added listings of ${totalCount.toLocaleString()} total.`}
            </span>
            <Link
              href={searchQuery ? `/browse?q=${encodeURIComponent(searchQuery)}` : '/browse'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, color: '#00E5FF', whiteSpace: 'nowrap' }}
            >
              Browse all {totalCount.toLocaleString()} servers <ChevronRight size={14} />
            </Link>
          </div>
        )}

        {filteredServers.length === 0 ? (
          <div className="surface" style={{ borderStyle: 'dashed' }}>
            <EmptyState
              icon={<Search size={22} aria-hidden="true" />}
              title="No tools found"
              description="Nothing matches your current search or filters. Build or own an MCP server for this?"
              actions={
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Link href="/submit" className="btn btn-primary">
                    + Add Your MCP Server
                  </Link>
                  {isFiltered && (
                    <Button variant="secondary" onClick={clearAllFilters}>
                      Clear all filters
                    </Button>
                  )}
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
                className={isFeaturedListing(server) ? 'directory-card-featured' : undefined}
                style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', minHeight: '300px' }}
              >
                <div className="directory-card-header">
                  <ServerAvatar name={server.name} logoUrl={server.logoUrl} />
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {isFeaturedListing(server) && (
                      <Badge
                        variant="success"
                        style={{
                          background: 'linear-gradient(135deg, rgba(0,229,255,0.15), rgba(0,123,255,0.12))',
                          color: '#00E5FF',
                          borderColor: 'rgba(0,229,255,0.35)',
                        }}
                      >
                        ★ Featured
                      </Badge>
                    )}
                    {isVerifiedListing(server) && <Badge variant="official">Verified</Badge>}
                  </div>
                </div>
                {(() => {
                  const { displayName, org } = parseServerName(server.name);
                  return (
                    <>
                      <h3
                        style={{
                          fontSize: '1.25rem',
                          marginBottom: org ? '0.15rem' : '0.5rem',
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {displayName}
                      </h3>
                      {org && (
                        <div
                          style={{
                            fontSize: '0.75rem',
                            marginBottom: '0.5rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {org}
                        </div>
                      )}
                    </>
                  );
                })()}
                <div
                  style={{
                    fontSize: '0.875rem',
                    marginBottom: '1.5rem',
                    flexGrow: 1,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <SafeMarkdown content={server.description || 'No description provided.'} isInline />
                </div>
                <div className="directory-card-footer">
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0 }}>
                    <Badge variant="category">{server.category}</Badge>
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
                <ServerAvatar name={server.name} logoUrl={server.logoUrl} size={44} />
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
                      <Badge
                        variant="success"
                        style={{
                          background: 'linear-gradient(135deg, rgba(0,229,255,0.15), rgba(0,123,255,0.12))',
                          color: '#00E5FF',
                          borderColor: 'rgba(0,229,255,0.35)',
                        }}
                      >
                        ★ Featured
                      </Badge>
                    )}
                    {isVerifiedListing(server) && <Badge variant="official">Verified</Badge>}
                    {!selectedCategory && <Badge variant="category">{server.category}</Badge>}
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
