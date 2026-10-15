'use client';

import {
  LayoutGrid,
  List,
  Loader2,
  RotateCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import Link from 'next/link';
import {
  type CSSProperties,
  Fragment,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  BROWSE_MAX_OFFSET,
  BROWSE_PAGE_SIZE,
  type BrowseParams,
  browseQueryString,
} from '../lib/browseParams';
import { categorySlug, getCategoryMeta } from '../lib/categories';
import { trackSearch } from '../lib/gtag';
import { SponsorAdUnit } from './ads/SponsorAdUnit';
import {
  BrowseFilters,
  type FacetKey,
  type FacetState,
  facetValueLabel,
} from './directory/BrowseFilters';
import {
  type DirectoryServer,
  ServerCard,
  ServerRow,
  ServerRowSkeleton,
  skeletonKeys,
} from './directory/ServerRow';
import { ImpressionBeacon } from './ImpressionTracker';

type Server = DirectoryServer & {
  url?: string;
  description: string;
  views?: number;
  npmDownloads?: number | null;
  lastCommitAt?: string | Date | null;
  createdAt?: string | Date | null;
};

type ViewMode = 'grid' | 'list';
type SortMode = BrowseParams['sort'];

const SORT_LABELS: Array<[SortMode, string]> = [
  ['relevance', 'Best match'],
  ['trending', 'Trending'],
  ['popular', 'Most popular'],
  ['most_upvoted', 'Top voted'],
  ['most_viewed', 'Most viewed'],
  ['newest', 'Newest'],
  ['alpha', 'A–Z'],
];

/** Popular situational searches offered under the box and in the empty state. */
const QUICK_QUERIES = [
  { q: 'postgres mysql sqlite', label: 'Databases' },
  { q: 'browser playwright puppeteer scrape', label: 'Web scraping' },
  { q: 'github git gitlab repository', label: 'GitHub & Git' },
  { q: 'memory vector embeddings rag', label: 'Agent memory' },
  { q: 'aws kubernetes docker cloudflare', label: 'Cloud & DevOps' },
  { q: 'pdf document markdown excel', label: 'PDF & docs' },
];

const EMPTY_FACETS: FacetState = {
  client: null,
  stack: null,
  transport: null,
  pricing: null,
  auth: null,
};

/** In-feed sponsor position: after the second result, so it's above the fold
 *  on first paint (ad impressions only count once ≥50% is in view). Fixed, so
 *  SSR and hydration render the same tree. */
const AD_SLOT = 2;

/** Typing pause before a browse search hits the server. */
const SEARCH_DEBOUNCE_MS = 250;

/** /browse results: server-backed faceted search (see BrowseView). */
export default function DirectoryGrid({
  initialServers,
  initialCategory = null,
  initialQuery = '',
  serverResults,
}: {
  initialServers: Server[];
  initialCategory?: string | null;
  initialQuery?: string;
  /**
   * `initialServers` is page one of a server-side result (lib/browse.ts) for
   * `params`, and every search, filter, sort and "Load more" asks
   * /api/browse for the next page instead of filtering in the browser.
   */
  serverResults: { params: BrowseParams; total: number; capped: boolean };
}) {
  return (
    <BrowseView
      initialServers={initialServers}
      initialCategory={initialCategory}
      initialQuery={initialQuery}
      serverResults={serverResults}
    />
  );
}

/* ── /browse: server-backed faceted search ──────────────────────────────── */

function BrowseView({
  initialServers,
  initialCategory,
  initialQuery,
  serverResults,
}: {
  initialServers: Server[];
  initialCategory: string | null;
  initialQuery: string;
  serverResults: { params: BrowseParams; total: number; capped: boolean };
}) {
  const initialParams = serverResults.params;
  // Working dataset: the server-rendered page, replaced by each /api/browse
  // response (or extended by "Load more").
  const [servers, setServers] = useState<Server[]>(initialServers);
  const [browseTotal, setBrowseTotal] = useState(serverResults.total);
  const [browseCapped, setBrowseCapped] = useState(serverResults.capped);
  const [browseStatus, setBrowseStatus] = useState<
    'idle' | 'loading' | 'error'
  >('idle');
  const [appending, setAppending] = useState(false);
  // Next page's offset, tracked apart from servers.length: a page can come
  // back short when a listing was hidden after its ids were cached.
  const [browseNextOffset, setBrowseNextOffset] = useState(BROWSE_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    initialCategory,
  );
  const [facets, setFacets] = useState<FacetState>({
    client: initialParams.client,
    stack: initialParams.stack,
    transport: initialParams.transport,
    pricing: initialParams.pricing,
    auth: initialParams.auth,
  });
  const [verifiedOnly, setVerifiedOnly] = useState(initialParams.verified);
  // Default to relevance ordering whenever there's a query (incl. deep links).
  const [sortMode, setSortMode] = useState<SortMode>(
    initialParams.sort ?? (initialQuery.trim() ? 'relevance' : 'trending'),
  );
  // /browse defaults to the scannable list; localStorage may override after mount.
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sheetOpen, setSheetOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Keep client state in sync when the server re-renders with new searchParams (e.g. category links)
  useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    setSearchQuery(initialQuery);
  }, [initialQuery]);

  // Entering a query switches to relevance; clearing it drops relevance back
  // to trending. Any other sort the user picked is preserved.
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

  // A server re-render (category link, back/forward) brings a new SSR page.
  useEffect(() => {
    setServers(initialServers);
    setBrowseNextOffset(BROWSE_PAGE_SIZE);
    setBrowseTotal(serverResults.total);
    setBrowseCapped(serverResults.capped);
  }, [initialServers, serverResults]);

  // The current filters as /api/browse params (page one).
  const browseParams: BrowseParams = {
    q: searchQuery.trim(),
    category: selectedCategory,
    ...facets,
    verified: verifiedOnly,
    sort:
      sortMode === 'relevance' && !searchQuery.trim() ? 'trending' : sortMode,
    offset: 0,
    limit: BROWSE_PAGE_SIZE,
  };
  const browseKey = browseQueryString(browseParams);
  const initialBrowseKey = useRef<string | null>(
    browseQueryString(initialParams),
  );
  const browseAbort = useRef<AbortController | null>(null);

  const fetchBrowsePage = async (
    query: string,
    append: boolean,
    offset = 0,
  ): Promise<void> => {
    browseAbort.current?.abort();
    const controller = new AbortController();
    browseAbort.current = controller;
    setBrowseStatus('loading');
    setAppending(append);
    try {
      const res = await fetch(`/api/browse?${query}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`browse ${res.status}`);
      const data = (await res.json()) as {
        items: Server[];
        total: number | null;
        capped: boolean;
      };
      setServers((prev) => {
        if (!append) return data.items;
        const seen = new Set(prev.map((s) => s.id));
        return [...prev, ...data.items.filter((s) => !seen.has(s.id))];
      });
      setBrowseNextOffset(offset + BROWSE_PAGE_SIZE);
      // Later pages skip the count; keep page one's total.
      if (data.total != null) setBrowseTotal(data.total);
      setBrowseCapped(data.capped);
      setBrowseStatus('idle');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setBrowseStatus('error');
    } finally {
      if (browseAbort.current === controller) setAppending(false);
    }
  };

  // Refetch page one whenever the filters change. Typing waits for a short
  // pause; clicks go out at once. The SSR page already matches the initial
  // filters, so the first render doesn't refetch.
  const lastQueryRef = useRef(searchQuery);
  // biome-ignore lint/correctness/useExhaustiveDependencies: browseKey encodes every filter, and fetchBrowsePage is recreated each render.
  useEffect(() => {
    if (browseKey === initialBrowseKey.current) {
      initialBrowseKey.current = null;
      return;
    }
    initialBrowseKey.current = null;
    const typing = lastQueryRef.current !== searchQuery;
    lastQueryRef.current = searchQuery;
    const timer = setTimeout(
      () => void fetchBrowsePage(browseKey, false),
      typing ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => clearTimeout(timer);
  }, [browseKey]);

  // Keep every filter in the URL, so a filtered view can be shared or
  // reloaded. Defaults (page one, the default sort) are left out.
  // biome-ignore lint/correctness/useExhaustiveDependencies: browseKey encodes every filter.
  useEffect(() => {
    const defaultSort = browseParams.q ? 'relevance' : 'trending';
    const qs = browseQueryString({
      ...browseParams,
      category: browseParams.category
        ? categorySlug(browseParams.category)
        : null,
      sort: browseParams.sort === defaultSort ? undefined : browseParams.sort,
      limit: 0,
    });
    window.history.replaceState({}, '', qs ? `/browse?${qs}` : '/browse');
  }, [browseKey]);

  const loadMore = () => {
    void fetchBrowsePage(
      browseQueryString({ ...browseParams, offset: browseNextOffset }),
      true,
      browseNextOffset,
    );
  };

  useEffect(() => {
    if (!searchQuery && !selectedCategory) return;
    const timer = setTimeout(() => {
      trackSearch({
        searchTerm: searchQuery,
        category: selectedCategory,
        resultCount: browseTotal,
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, browseTotal]);

  // Restore preferred view mode once on mount.
  useEffect(() => {
    try {
      const savedView = window.localStorage.getItem('allmcps-view-mode');
      if (savedView === 'grid' || savedView === 'list') setViewMode(savedView);
    } catch {}
  }, []);

  const handleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      window.localStorage.setItem('allmcps-view-mode', mode);
    } catch {}
  };

  // "/" focuses search from anywhere on the page (unless already typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
      ) {
        return;
      }
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Bottom sheet: lock page scroll, close on Escape.
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [sheetOpen]);

  const setFacet = (key: FacetKey, value: string | null) =>
    setFacets((prev) => ({ ...prev, [key]: value }) as FacetState);

  const clearFilters = () => {
    setSelectedCategory(null);
    setVerifiedOnly(false);
    setFacets(EMPTY_FACETS);
  };

  const clearAll = () => {
    clearFilters();
    setSearchQuery('');
  };

  // Active filter chips, in sidebar order.
  const activeChips: Array<{ id: string; label: string; remove: () => void }> =
    [];
  if (verifiedOnly) {
    activeChips.push({
      id: 'verified',
      label: 'Tested working',
      remove: () => setVerifiedOnly(false),
    });
  }
  if (selectedCategory) {
    activeChips.push({
      id: 'category',
      label: getCategoryMeta(selectedCategory).label,
      remove: () => setSelectedCategory(null),
    });
  }
  for (const key of Object.keys(facets) as FacetKey[]) {
    const value = facets[key];
    if (value) {
      activeChips.push({
        id: key,
        label: facetValueLabel(key, value),
        remove: () => setFacet(key, null),
      });
    }
  }
  const filterCount = activeChips.length;
  const hasQuery = searchQuery.trim().length > 0;

  const hasMore =
    browseNextOffset < browseTotal && browseNextOffset <= BROWSE_MAX_OFFSET;
  const refreshing = browseStatus === 'loading' && !appending;
  const countLabel = `${browseTotal.toLocaleString('en-US')}${browseCapped ? '+' : ''}`;
  const surface = hasQuery
    ? ('search_results' as const)
    : selectedCategory
      ? ('category_page' as const)
      : viewMode === 'grid'
        ? ('browse_grid' as const)
        : ('browse_list' as const);
  const categoryLabel = selectedCategory
    ? getCategoryMeta(selectedCategory).label
    : null;

  const filtersPanel = (idPrefix: string) => (
    <BrowseFilters
      idPrefix={idPrefix}
      category={selectedCategory}
      onCategory={setSelectedCategory}
      facets={facets}
      onFacet={setFacet}
      verified={verifiedOnly}
      onVerified={setVerifiedOnly}
    />
  );

  const ad = (
    <div className={viewMode === 'grid' ? 'dir-grid-span' : 'dir-ad-slot'}>
      <SponsorAdUnit placement="directory_inline" layout="row" />
    </div>
  );

  return (
    <div className="container dir-browse">
      <header className="dir-browse-head animate-in">
        <h1 className="text-page-title">
          {categoryLabel
            ? `${categoryLabel} MCP servers`
            : 'Browse MCP servers'}
        </h1>
        <p className="dir-browse-lead">
          {categoryLabel
            ? `Model Context Protocol servers in the ${categoryLabel} category.`
            : 'Search the catalog, narrow by client, language and transport, and install in one step.'}
        </p>
      </header>

      {/* The form only supplies Enter-to-submit; display: contents leaves the
          <search> landmark as the laid-out box. */}
      <form
        style={{ display: 'contents' }}
        onSubmit={(e) => {
          e.preventDefault();
          searchRef.current?.blur();
        }}
      >
        <search
          className="dir-search animate-in"
          style={{ '--i': 1 } as CSSProperties}
          aria-label="Search MCP servers"
        >
          <Search size={20} className="dir-search-icon" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            name="q"
            className="dir-search-input"
            placeholder="Search servers, tools or tasks…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search MCP servers"
            autoComplete="off"
            enterKeyHint="search"
          />
          {refreshing && (
            <Loader2
              size={17}
              className="dir-search-spin"
              aria-label="Loading results"
            />
          )}
          {searchQuery ? (
            <button
              type="button"
              className="dir-search-clear"
              onClick={() => {
                setSearchQuery('');
                searchRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              <X size={16} aria-hidden="true" />
            </button>
          ) : (
            <span className="kbd dir-search-kbd" aria-hidden="true">
              /
            </span>
          )}
        </search>
      </form>

      {!hasQuery && (
        <fieldset
          className="dir-quick fade-x scroll-x animate-in fieldset-plain"
          style={{ '--i': 2 } as CSSProperties}
          aria-label="Popular searches"
        >
          {QUICK_QUERIES.map((chip) => (
            <button
              key={chip.q}
              type="button"
              className="chip"
              onClick={() => setSearchQuery(chip.q)}
            >
              {chip.label}
            </button>
          ))}
        </fieldset>
      )}

      <div className="dir-layout">
        <aside className="dir-sidebar" aria-label="Filters">
          <div className="dir-sidebar-head">
            <h2 className="dir-sidebar-title">Filters</h2>
            {filterCount > 0 && (
              <button
                type="button"
                className="dir-text-btn"
                onClick={clearFilters}
              >
                Clear all
              </button>
            )}
          </div>
          {filtersPanel('side')}
        </aside>

        <div className="dir-results" ref={resultsRef}>
          <div className="dir-toolbar">
            <button
              type="button"
              className="btn btn-secondary btn-sm dir-filter-btn"
              onClick={() => setSheetOpen(true)}
              aria-haspopup="dialog"
            >
              <SlidersHorizontal size={15} aria-hidden="true" />
              Filters
              {filterCount > 0 && (
                <span className="dir-filter-count">{filterCount}</span>
              )}
            </button>
            <p className="dir-count" aria-live="polite">
              {refreshing ? (
                <span className="dir-count-busy">Updating results…</span>
              ) : (
                <>
                  <strong className="tabular">{countLabel}</strong>{' '}
                  {browseTotal === 1 ? 'server' : 'servers'}
                  {hasQuery && <> for &ldquo;{searchQuery.trim()}&rdquo;</>}
                </>
              )}
            </p>
            <div className="dir-toolbar-right">
              <label className="dir-sort">
                <span className="sr-only">Sort by</span>
                <select
                  value={
                    sortMode === 'relevance' && !hasQuery
                      ? 'trending'
                      : sortMode
                  }
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                >
                  {SORT_LABELS.filter(
                    ([mode]) => mode !== 'relevance' || hasQuery,
                  ).map(([mode, label]) => (
                    <option key={mode} value={mode}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset
                className="segmented dir-view fieldset-plain"
                aria-label="View"
              >
                <button
                  type="button"
                  onClick={() => handleViewMode('list')}
                  aria-pressed={viewMode === 'list'}
                  aria-label="List view"
                  title="List view"
                >
                  <List size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => handleViewMode('grid')}
                  aria-pressed={viewMode === 'grid'}
                  aria-label="Grid view"
                  title="Grid view"
                >
                  <LayoutGrid size={15} aria-hidden="true" />
                </button>
              </fieldset>
            </div>
          </div>

          {filterCount > 0 && (
            <fieldset
              className="dir-active fieldset-plain"
              aria-label="Active filters"
            >
              {activeChips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="chip is-active dir-active-chip"
                  onClick={c.remove}
                  aria-label={`Remove filter: ${c.label}`}
                >
                  {c.label}
                  <X size={13} aria-hidden="true" />
                </button>
              ))}
              <button
                type="button"
                className="dir-text-btn"
                onClick={clearFilters}
              >
                Clear all
              </button>
            </fieldset>
          )}

          {browseStatus === 'error' && (
            <div className="dir-error" role="alert">
              <span>Couldn&rsquo;t load results. Check your connection.</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void fetchBrowsePage(browseKey, false)}
              >
                <RotateCw size={14} aria-hidden="true" /> Retry
              </button>
            </div>
          )}

          <h2 className="sr-only">Results</h2>
          {servers.length === 0 && browseStatus !== 'loading' ? (
            <div className="dir-empty">
              <div className="dir-empty-icon" aria-hidden="true">
                <Search size={22} />
              </div>
              <h3 className="dir-empty-title">
                {hasQuery
                  ? `No servers match “${searchQuery.trim()}”`
                  : 'No servers match these filters'}
              </h3>
              <p className="dir-empty-body">
                {filterCount > 0
                  ? 'Try removing a filter — each one narrows the catalog further.'
                  : 'Try fewer or broader words, or start from a popular search.'}
              </p>
              {filterCount > 0 ? (
                <div className="dir-empty-row">
                  {activeChips.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="chip"
                      onClick={c.remove}
                    >
                      Remove &ldquo;{c.label}&rdquo;
                    </button>
                  ))}
                </div>
              ) : (
                <div className="dir-empty-row">
                  {QUICK_QUERIES.slice(0, 4).map((chip) => (
                    <button
                      key={chip.q}
                      type="button"
                      className="chip"
                      onClick={() => setSearchQuery(chip.q)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="dir-empty-actions">
                {(hasQuery || filterCount > 0) && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={clearAll}
                  >
                    Reset search
                  </button>
                )}
                <Link href="/categories" className="btn btn-ghost btn-sm">
                  Browse categories
                </Link>
                <Link href="/submit" className="btn btn-ghost btn-sm">
                  Submit a server
                </Link>
              </div>
            </div>
          ) : (
            <div
              className={`${viewMode === 'grid' ? 'dir-grid' : 'dir-list'}${refreshing ? ' is-refreshing' : ''}`}
              aria-busy={browseStatus === 'loading'}
            >
              {servers.map((server, index) => (
                <Fragment key={server.id}>
                  {index === AD_SLOT && ad}
                  <ImpressionBeacon
                    serverId={server.id}
                    surface={surface}
                    className="dir-beacon"
                  >
                    {viewMode === 'grid' ? (
                      <ServerCard server={server} />
                    ) : (
                      <ServerRow
                        server={server}
                        hideCategory={Boolean(selectedCategory)}
                      />
                    )}
                  </ImpressionBeacon>
                </Fragment>
              ))}
              {appending && viewMode === 'list' && (
                <ServerRowSkeleton count={4} />
              )}
              {appending &&
                viewMode === 'grid' &&
                skeletonKeys(3).map((k) => (
                  <div key={k} className="skeleton dir-card-skel" aria-hidden />
                ))}
            </div>
          )}

          {servers.length > 0 &&
            (hasMore || servers.length > BROWSE_PAGE_SIZE) && (
              <div className="dir-more">
                <span className="dir-more-meta tabular">
                  Showing {servers.length.toLocaleString('en-US')} of{' '}
                  {countLabel}
                </span>
                {hasMore && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-md"
                    disabled={browseStatus === 'loading'}
                    onClick={loadMore}
                  >
                    {appending ? (
                      <>
                        <Loader2
                          size={15}
                          className="dir-spin"
                          aria-hidden="true"
                        />
                        Loading
                      </>
                    ) : (
                      'Load more'
                    )}
                  </button>
                )}
              </div>
            )}
        </div>
      </div>

      {sheetOpen && (
        <div className="dir-sheet-root">
          <button
            type="button"
            className="dir-sheet-backdrop"
            aria-label="Close filters"
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="dir-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
          >
            <div className="dir-sheet-grip" aria-hidden="true" />
            <div className="dir-sheet-head">
              <h2 className="dir-sidebar-title">Filters</h2>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => setSheetOpen(false)}
                aria-label="Close filters"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="dir-sheet-body">{filtersPanel('sheet')}</div>
            <div className="dir-sheet-foot">
              <button
                type="button"
                className="btn btn-ghost btn-md"
                onClick={clearFilters}
                disabled={filterCount === 0}
              >
                Clear all
              </button>
              <button
                type="button"
                className="btn btn-primary btn-md dir-sheet-apply"
                onClick={() => {
                  setSheetOpen(false);
                  resultsRef.current?.scrollIntoView({ block: 'start' });
                }}
              >
                {refreshing ? (
                  <Loader2 size={15} className="dir-spin" aria-hidden="true" />
                ) : null}
                {browseTotal === 0 && !refreshing
                  ? 'No matches yet'
                  : `Show ${countLabel} ${browseTotal === 1 ? 'result' : 'results'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
