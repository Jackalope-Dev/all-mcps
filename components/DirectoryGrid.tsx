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
import {
  isFeaturedListing as isFeaturedListingShared,
  isVerifiedListing as isVerifiedListingShared,
} from '../lib/featuredStatus';

type Server = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  isOfficial: boolean;
  /** Paid listing — counts as verified for browse filters. */
  isPremium?: boolean;
  featuredUntil?: string | Date | null;
  views?: number;
  copies?: number;
  upvotes?: number;
  createdAt?: string;
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
type SortMode = 'trending' | 'most_viewed' | 'newest';

// Deterministic brand-adjacent avatar gradients (cyan / blue / slate)
function getGradient(str: string) {
  const colors = [
    'linear-gradient(135deg, #00e5ff, #007bff)',
    'linear-gradient(135deg, #007bff, #0f172a)',
    'linear-gradient(135deg, #22d3ee, #0369a1)',
    'linear-gradient(135deg, #38bdf8, #1e3a8a)',
    'linear-gradient(135deg, #0ea5e9, #164e63)',
    'linear-gradient(135deg, #67e8f9, #1d4ed8)',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

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
}: {
  initialServers: Server[];
  marqueeServers?: Server[];
  featuredCards?: Server[];
  initialCategory?: string | null;
  initialQuery?: string;
  /** `landing` = homepage with marketing hero; `browse` = dedicated list/filter page */
  variant?: 'landing' | 'browse';
}) {
  const isBrowse = variant === 'browse';
  const browseBase = '/browse';
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory);
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
      return matchesSearch && matchesCategory && matchesVerified;
    });

    result.sort((a, b) => {
      if (sortMode === 'trending') {
        const scoreA = (a.upvotes || 0) * 5 + (a.copies || 0);
        const scoreB = (b.upvotes || 0) * 5 + (b.copies || 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
      } else if (sortMode === 'most_viewed') {
        if ((b.views || 0) !== (a.views || 0)) return (b.views || 0) - (a.views || 0);
      }

      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    return result;
  }, [initialServers, searchQuery, selectedCategory, sortMode, verifiedOnly]);

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
  }, [searchQuery, selectedCategory, sortMode, verifiedOnly]);

  const visibleServers = filteredServers.slice(0, visibleCount);
  const hasMore = visibleCount < filteredServers.length;

  const isFiltered = searchQuery.length > 0 || selectedCategory !== null || verifiedOnly;
  // Discovery chrome (marquee / featured) only on the unfiltered marketing landing
  const showDiscovery = !isBrowse && !isFiltered;
  const categoryMeta = selectedCategory ? parseCategoryLabel(selectedCategory) : null;

  // Width for the category select so long names are never clipped
  const selectLabel = selectedCategory || 'All Categories';
  const selectMinCh = Math.min(Math.max(selectLabel.length + 4, 16), 48);

  const ServerIcon = ({ name, size = 48 }: { name: string; size?: number }) => (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size > 40 ? 12 : 10,
        background: getGradient(name),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size > 40 ? '1.5rem' : '1.1rem',
        fontWeight: 800,
        textTransform: 'uppercase',
        flexShrink: 0,
      }}
    >
      {name.charAt(0)}
    </div>
  );

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
              {categories.map((cat) => (
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

            {!selectedCategory &&
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
            <div className="directory-segmented" role="group" aria-label="Sort order">
              {(
                [
                  ['trending', 'Trending'],
                  ['most_viewed', 'Most Viewed'],
                  ['newest', 'Newest'],
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

        {filteredServers.length === 0 ? (
          <div className="surface" style={{ borderStyle: 'dashed' }}>
            <EmptyState
              icon={<Search size={22} aria-hidden="true" />}
              title="No tools found"
              description="Nothing matches your current search or filters. Try a different query or clear filters."
              actions={
                isFiltered ? (
                  <Button variant="secondary" onClick={clearAllFilters}>
                    Clear all filters
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : viewMode === 'grid' ? (
          <div className="directory-grid">
            {visibleServers.map((server) => (
              <Card
                key={server.id}
                href={`/mcp/${server.id}`}
                className={isFeaturedListing(server) ? 'directory-card-featured' : undefined}
                style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '1rem',
                  }}
                >
                  <ServerIcon name={server.name} />
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
                <h3
                  style={{
                    fontSize: '1.25rem',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {server.name}
                </h3>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0 }}>
                    <Badge variant="category">{server.category}</Badge>
                  </div>
                  <Stats server={server} />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="directory-list">
            {visibleServers.map((server) => (
              <Link
                key={server.id}
                href={`/mcp/${server.id}`}
                className={`directory-list-row surface-interactive${isFeaturedListing(server) ? ' directory-list-row-featured' : ''}`}
              >
                <ServerIcon name={server.name} size={44} />
                <div className="directory-list-body">
                  <div className="directory-list-title-row">
                    <h3 className="directory-list-name">{server.name}</h3>
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
            ))}
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
