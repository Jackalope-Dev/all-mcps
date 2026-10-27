'use client';

import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  Award,
  Ban,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  ExternalLink,
  Eye,
  EyeOff,
  Folder,
  GitMerge,
  Heart,
  Hourglass,
  Mail,
  Pencil,
  RotateCcw,
  ScanSearch,
  Search,
  SearchX,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '../../components/ui/Toast';
import { notifyAdminStatsChanged } from '../../lib/adminStatsRefresh';
import { DIRECTORY_CATEGORIES } from '../../lib/categories';
import { AdminEmpty, AdminModal, AdminSkeletonList } from './AdminUi';

export type ListingFilters = {
  status?: string;
  premium?: string;
  featured?: string;
  health?: string;
  aiEnriched?: string;
  hasTools?: string;
  hasToolsError?: string;
  categorySponsor?: string;
  pricingModel?: string;
  authType?: string;
  maintenanceStatus?: string;
};

type Listing = {
  id: string;
  name: string;
  url: string;
  websiteUrl?: string | null;
  submitterEmail?: string | null;
  description: string;
  category: string;
  createdAt: string;
  isPremium: boolean;
  isOfficial?: boolean;
  reciprocalBadgeOk?: boolean;
  status: string;
  healthStatus: string;
  featuredUntil?: string | null;
  categorySponsorUntil?: string | null;
  aiSummary?: string | null;
  tools?: string | null;
  toolsError?: string | null;
  toolsCheckedAt?: string | null;
  githubStars?: number | null;
  npmDownloads?: number | null;
  views?: number;
  upvotes?: number;
  copies?: number;
  ownerUserId?: string | null;
};

type EditFields = {
  name: string;
  description: string;
  category: string;
  url: string;
  websiteUrl: string;
  targetId?: string;
};

const PAGE_SIZE = 25;

export default function ManageListings({
  initialFilters,
}: {
  initialFilters?: ListingFilters;
}) {
  const [items, setItems] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(
    initialFilters?.status || 'all',
  );
  const [premiumFilter, setPremiumFilter] = useState(
    initialFilters?.premium || '',
  );
  const [featuredFilter, setFeaturedFilter] = useState(
    initialFilters?.featured || '',
  );
  const [healthFilter, setHealthFilter] = useState(
    initialFilters?.health || '',
  );
  const [aiFilter, setAiFilter] = useState(initialFilters?.aiEnriched || '');
  const [toolsFilter, setToolsFilter] = useState(
    initialFilters?.hasTools || '',
  );
  const [hasToolsErrorFilter, setHasToolsErrorFilter] = useState(
    initialFilters?.hasToolsError || '',
  );
  const [categorySponsorFilter, setCategorySponsorFilter] = useState(
    initialFilters?.categorySponsor || '',
  );
  const [pricingModelFilter, setPricingModelFilter] = useState(
    initialFilters?.pricingModel || '',
  );
  const [authTypeFilter, setAuthTypeFilter] = useState(
    initialFilters?.authType || '',
  );
  const [maintenanceStatusFilter, setMaintenanceStatusFilter] = useState(
    initialFilters?.maintenanceStatus || '',
  );
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // A KPI card click replaces the whole filter set. The KPI deck stays on
  // screen over this tab, so merging would let an earlier card's filter
  // (Premium's premium=true) hide rows the new card counted.
  useEffect(() => {
    if (initialFilters) {
      setSearch('');
      setStatusFilter(initialFilters.status ?? 'all');
      setPremiumFilter(initialFilters.premium ?? '');
      setFeaturedFilter(initialFilters.featured ?? '');
      setHealthFilter(initialFilters.health ?? '');
      setAiFilter(initialFilters.aiEnriched ?? '');
      setToolsFilter(initialFilters.hasTools ?? '');
      setHasToolsErrorFilter(initialFilters.hasToolsError ?? '');
      setCategorySponsorFilter(initialFilters.categorySponsor ?? '');
      setPricingModelFilter(initialFilters.pricingModel ?? '');
      setAuthTypeFilter(initialFilters.authType ?? '');
      setMaintenanceStatusFilter(initialFilters.maintenanceStatus ?? '');
    }
  }, [initialFilters]);

  const resetAllFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPremiumFilter('');
    setFeaturedFilter('');
    setHealthFilter('');
    setAiFilter('');
    setToolsFilter('');
    setHasToolsErrorFilter('');
    setCategorySponsorFilter('');
    setPricingModelFilter('');
    setAuthTypeFilter('');
    setMaintenanceStatusFilter('');
  };

  const hasActiveFilters =
    Boolean(search.trim()) ||
    statusFilter !== 'all' ||
    Boolean(premiumFilter) ||
    Boolean(featuredFilter) ||
    Boolean(healthFilter) ||
    Boolean(aiFilter) ||
    Boolean(toolsFilter) ||
    Boolean(hasToolsErrorFilter) ||
    Boolean(categorySponsorFilter) ||
    Boolean(pricingModelFilter) ||
    Boolean(authTypeFilter) ||
    Boolean(maintenanceStatusFilter);

  const [inspectListing, setInspectListing] = useState<Listing | null>(null);
  const [boostModalListing, setBoostModalListing] = useState<Listing | null>(
    null,
  );
  const [customBoostDays, setCustomBoostDays] = useState('14');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFields>({
    name: '',
    description: '',
    category: '',
    url: '',
    websiteUrl: '',
  });

  const requestIdRef = useRef<number>(0);

  const fetchListings = useCallback(
    async (nextOffset: number) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set('search', search.trim());
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (premiumFilter) params.set('premium', premiumFilter);
        if (featuredFilter) params.set('featured', featuredFilter);
        if (healthFilter) params.set('health', healthFilter);
        if (aiFilter) params.set('aiEnriched', aiFilter);
        if (toolsFilter) params.set('hasTools', toolsFilter);
        if (hasToolsErrorFilter)
          params.set('hasToolsError', hasToolsErrorFilter);
        if (categorySponsorFilter)
          params.set('categorySponsor', categorySponsorFilter);
        if (pricingModelFilter) params.set('pricingModel', pricingModelFilter);
        if (authTypeFilter) params.set('authType', authTypeFilter);
        if (maintenanceStatusFilter)
          params.set('maintenanceStatus', maintenanceStatusFilter);
        params.set('sort', sortBy);
        params.set('order', sortOrder);
        params.set('offset', String(nextOffset));
        params.set('limit', String(PAGE_SIZE));

        const res = await fetch(`/api/admin/listings?${params.toString()}`);
        const data = (await res.json()) as {
          items?: Listing[];
          total?: number;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || 'Could not load listings');

        if (requestId !== requestIdRef.current) return;

        setItems(data.items || []);
        setTotal(data.total || 0);
        setOffset(nextOffset);
      } catch (err: any) {
        if (requestId === requestIdRef.current) {
          toast.error('Could not load listings', { description: err?.message });
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [
      search,
      statusFilter,
      premiumFilter,
      featuredFilter,
      healthFilter,
      aiFilter,
      toolsFilter,
      hasToolsErrorFilter,
      categorySponsorFilter,
      pricingModelFilter,
      authTypeFilter,
      maintenanceStatusFilter,
      sortBy,
      sortOrder,
    ],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchListings(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchListings]);

  const runAction = async (
    id: string,
    action:
      | 'set_premium'
      | 'unset_premium'
      | 'edit'
      | 'unpublish'
      | 'republish'
      | 'withdraw'
      | 'merge_duplicate'
      | 'delete'
      | 'feature'
      | 'resend_approval'
      | 'toggle_official'
      | 'toggle_reciprocal_badge'
      | 'check_health',
    extra?: { fields?: Partial<EditFields>; days?: number },
  ) => {
    setLoadingId(id);
    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        featuredUntil?: string;
        isOfficial?: boolean;
        reciprocalBadgeOk?: boolean;
        healthStatus?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Action failed');

      if (action === 'delete') {
        setItems((prev) => prev.filter((s) => s.id !== id));
        setTotal((prev) => Math.max(0, prev - 1));
      } else if (action === 'set_premium' || action === 'unset_premium') {
        setItems((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, isPremium: action === 'set_premium' } : s,
          ),
        );
      } else if (action === 'toggle_official') {
        setItems((prev) =>
          prev.map((s) =>
            s.id === id
              ? { ...s, isOfficial: data.isOfficial ?? !s.isOfficial }
              : s,
          ),
        );
      } else if (action === 'toggle_reciprocal_badge') {
        setItems((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  reciprocalBadgeOk:
                    data.reciprocalBadgeOk ?? !s.reciprocalBadgeOk,
                }
              : s,
          ),
        );
      } else if (action === 'check_health') {
        setItems((prev) =>
          prev.map((s) =>
            s.id === id
              ? { ...s, healthStatus: data.healthStatus ?? s.healthStatus }
              : s,
          ),
        );
      } else if (
        action === 'unpublish' ||
        action === 'republish' ||
        action === 'merge_duplicate' ||
        action === 'withdraw'
      ) {
        setItems((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status:
                    action === 'republish'
                      ? 'active'
                      : action === 'withdraw'
                        ? 'withdrawn'
                        : 'removed',
                }
              : s,
          ),
        );
      } else if (action === 'edit') {
        setItems((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...extra?.fields } : s)),
        );
        setEditingId(null);
      } else if (action === 'feature') {
        setItems((prev) =>
          prev.map((s) =>
            s.id === id
              ? { ...s, featuredUntil: data.featuredUntil ?? s.featuredUntil }
              : s,
          ),
        );
        setBoostModalListing(null);
      }

      toast.success(data.message || 'Done');
      notifyAdminStatsChanged();
    } catch (err: any) {
      toast.error('Action failed', {
        description: err?.message || 'Something went wrong.',
      });
    } finally {
      setLoadingId(null);
    }
  };

  const startEdit = (listing: Listing) => {
    setEditingId(listing.id);
    setEditForm({
      name: listing.name,
      description: listing.description,
      category: listing.category,
      url: listing.url,
      websiteUrl: listing.websiteUrl || '',
    });
  };

  const saveEdit = (id: string) => {
    runAction(id, 'edit', {
      fields: {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        category: editForm.category.trim(),
        url: editForm.url.trim(),
        websiteUrl: editForm.websiteUrl.trim(),
      },
    });
  };

  const grantFeaturedModal = (id: string) => {
    const days = Number(customBoostDays);
    if (!days || days < 1) {
      toast.error('Enter a valid number of days.');
      return;
    }
    runAction(id, 'feature', { days });
  };

  const mergeDuplicate = (listing: Listing) => {
    const targetId = window.prompt(
      `Canonical listing id to merge "${listing.id}" into. The old URL will 308 to the target.`,
    );
    if (!targetId?.trim()) return;
    runAction(listing.id, 'merge_duplicate', {
      fields: { targetId: targetId.trim() },
    });
  };

  const deleteListing = (listing: Listing) => {
    const warning = listing.isPremium
      ? `"${listing.name}" is a premium listing. Deleting it here does NOT cancel its Stripe subscription — cancel that separately in Stripe. Permanently delete anyway?`
      : `Permanently delete "${listing.name}"? This cannot be undone.`;
    if (!window.confirm(warning)) return;
    runAction(listing.id, 'delete');
  };

  // For an owner's takedown request. Unlike Delete, the row stays, so ingest
  // and the submit form never re-add the server.
  const withdrawListing = (listing: Listing) => {
    if (
      !window.confirm(
        `Withdraw "${listing.name}" at its owner's request? Every public URL for it (page, readme, alternatives, embed, claim, badge, markdown, API) will 404, and it will never be re-imported. Republish does not undo this.`,
      )
    )
      return;
    runAction(listing.id, 'withdraw');
  };

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const isNewestView =
    sortBy === 'createdAt' && sortOrder === 'desc' && !hasActiveFilters;

  return (
    <div className="adm-stack">
      {/* Search & filter toolbar */}
      <div className="adm-card adm-toolbar">
        {/* Quick views */}
        <div className="adm-toolbar-row">
          <span className="adm-toolbar-label">Quick views</span>
          <div className="adm-chip-row scroll-x fade-x">
            <button
              type="button"
              onClick={() => {
                resetAllFilters();
                setSortBy('createdAt');
                setSortOrder('desc');
              }}
              className="chip"
              aria-pressed={isNewestView}
            >
              <Clock size={13} aria-hidden="true" /> Newest
            </button>
            <button
              type="button"
              onClick={() => {
                resetAllFilters();
                setStatusFilter('active');
              }}
              className="chip"
              aria-pressed={statusFilter === 'active'}
            >
              <CheckCircle2 size={13} aria-hidden="true" /> Active
            </button>
            <button
              type="button"
              onClick={() => {
                resetAllFilters();
                setStatusFilter('pending');
              }}
              className="chip"
              aria-pressed={statusFilter === 'pending'}
            >
              <Hourglass size={13} aria-hidden="true" /> Pending
            </button>
            <button
              type="button"
              onClick={() => {
                resetAllFilters();
                setHealthFilter('unhealthy');
              }}
              className="chip"
              aria-pressed={healthFilter === 'unhealthy'}
            >
              <AlertTriangle size={13} aria-hidden="true" /> Unhealthy / offline
            </button>
            <button
              type="button"
              onClick={() => {
                resetAllFilters();
                setPremiumFilter('true');
              }}
              className="chip"
              aria-pressed={premiumFilter === 'true'}
            >
              <Crown size={13} aria-hidden="true" /> Premium
            </button>
          </div>
        </div>

        <div className="adm-toolbar-row">
          <div className="adm-search">
            <Search size={16} aria-hidden="true" />
            <input
              className="form-input"
              type="search"
              aria-label="Search listings"
              placeholder="Search by listing name or repository URL…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="adm-sort">
            <select
              className="form-input"
              aria-label="Sort by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="createdAt">Sort: Created date</option>
              <option value="name">Sort: Name</option>
              <option value="views">Sort: Views</option>
              <option value="upvotes">Sort: Upvotes</option>
              <option value="stars">Sort: GitHub stars</option>
            </select>

            <button
              type="button"
              onClick={() =>
                setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
              }
              className="btn btn-secondary btn-sm adm-sort-dir"
              title="Toggle sort direction"
            >
              <ArrowUpDown size={14} aria-hidden="true" />{' '}
              {sortOrder.toUpperCase()}
            </button>
          </div>
        </div>

        <div className="adm-filter-grid">
          <select
            className="form-input"
            aria-label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Status: All</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="removed">Removed</option>
          </select>
          <select
            className="form-input"
            aria-label="Premium"
            value={premiumFilter}
            onChange={(e) => setPremiumFilter(e.target.value)}
          >
            <option value="">Premium: Any</option>
            <option value="true">Premium only</option>
            <option value="false">Free only</option>
          </select>
          <select
            className="form-input"
            aria-label="Featured"
            value={featuredFilter}
            onChange={(e) => setFeaturedFilter(e.target.value)}
          >
            <option value="">Featured: Any</option>
            <option value="true">Currently featured</option>
          </select>
          <select
            className="form-input"
            aria-label="Category sponsor"
            value={categorySponsorFilter}
            onChange={(e) => setCategorySponsorFilter(e.target.value)}
          >
            <option value="">Category sponsor: Any</option>
            <option value="true">Category sponsors only</option>
          </select>
          <select
            className="form-input"
            aria-label="Health"
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
          >
            <option value="">Health: Any</option>
            <option value="unhealthy">Unhealthy / offline (all)</option>
            <option value="healthy">Healthy</option>
            <option value="unknown">Unknown</option>
            <option value="archived">Archived</option>
            <option value="offline">Offline</option>
          </select>
          <select
            className="form-input"
            aria-label="AI content"
            value={aiFilter}
            onChange={(e) => setAiFilter(e.target.value)}
          >
            <option value="">AI content: Any</option>
            <option value="true">Enriched</option>
            <option value="false">Not enriched</option>
          </select>
          <select
            className="form-input"
            aria-label="MCP tools"
            value={toolsFilter}
            onChange={(e) => setToolsFilter(e.target.value)}
          >
            <option value="">MCP tools: Any</option>
            <option value="true">Has tools</option>
            <option value="false">No tools</option>
          </select>
          <select
            className="form-input"
            aria-label="Introspection error"
            value={hasToolsErrorFilter}
            onChange={(e) => setHasToolsErrorFilter(e.target.value)}
          >
            <option value="">Introspection error: Any</option>
            <option value="true">Errors only</option>
            <option value="false">No errors</option>
          </select>
          <select
            className="form-input"
            aria-label="Pricing"
            value={pricingModelFilter}
            onChange={(e) => setPricingModelFilter(e.target.value)}
          >
            <option value="">Pricing: Any</option>
            <option value="free">Free</option>
            <option value="freemium">Freemium</option>
            <option value="paid">Paid</option>
            <option value="byok">BYOK</option>
          </select>
          <select
            className="form-input"
            aria-label="Auth"
            value={authTypeFilter}
            onChange={(e) => setAuthTypeFilter(e.target.value)}
          >
            <option value="">Auth: Any</option>
            <option value="none">No auth</option>
            <option value="api_key">API key</option>
            <option value="oauth">OAuth</option>
            <option value="other">Other</option>
          </select>
          <select
            className="form-input"
            aria-label="Maintenance"
            value={maintenanceStatusFilter}
            onChange={(e) => setMaintenanceStatusFilter(e.target.value)}
          >
            <option value="">Maintenance: Any</option>
            <option value="active">Active</option>
            <option value="stable">Stable</option>
            <option value="experimental">Experimental</option>
            <option value="archived">Archived</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="btn btn-sm btn-ghost adm-reset"
            >
              <X size={14} aria-hidden="true" /> Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Result count */}
      <div className="adm-pager adm-pager--top" aria-live="polite">
        <span>
          {loading
            ? 'Loading listings…'
            : total === 0
              ? 'No listings'
              : `${total.toLocaleString()} listing${total === 1 ? '' : 's'}`}
        </span>
      </div>

      {/* Listing cards */}
      {loading ? (
        <AdminSkeletonList rows={4} />
      ) : items.length === 0 ? (
        <AdminEmpty
          icon={SearchX}
          title="No listings match"
          hue="adm-neutral"
          boxed
        >
          Try a different search or{' '}
          <button
            type="button"
            className="adm-text-btn"
            onClick={resetAllFilters}
          >
            reset the filters
          </button>
          .
        </AdminEmpty>
      ) : (
        <ul className="adm-listings">
          {items.map((listing) => {
            const featuredUntilDate = listing.featuredUntil
              ? new Date(listing.featuredUntil)
              : null;
            const featuredDaysLeft = featuredUntilDate
              ? Math.ceil((featuredUntilDate.getTime() - Date.now()) / 86400000)
              : null;
            const boosted = Boolean(featuredDaysLeft && featuredDaysLeft > 0);
            const isEditing = editingId === listing.id;
            const rowLoading = loadingId === listing.id;

            return (
              <li
                key={listing.id}
                className={`adm-listing${listing.isPremium ? ' is-premium' : ''}${rowLoading ? ' is-busy' : ''}`}
              >
                {/* Header row: title, status pills, links */}
                <div className="adm-listing-head">
                  <div className="adm-listing-id">
                    <div className="adm-listing-title">
                      <h3>{listing.name}</h3>
                      {listing.status === 'removed' && (
                        <span className="adm-tag is-dot hue-red">Removed</span>
                      )}
                      {listing.status === 'withdrawn' && (
                        <span className="adm-tag is-dot hue-red">
                          Withdrawn
                        </span>
                      )}
                      {listing.status === 'pending' && (
                        <span className="adm-tag is-dot hue-amber">
                          Pending
                        </span>
                      )}
                      {listing.isPremium && (
                        <span className="adm-tag hue-violet">Premium</span>
                      )}
                      {listing.isOfficial && (
                        <span className="adm-tag hue-green">
                          <ShieldCheck size={11} aria-hidden="true" /> Official
                        </span>
                      )}
                      {listing.reciprocalBadgeOk && (
                        <span className="adm-tag hue-blue">
                          <Award size={11} aria-hidden="true" /> Verified
                        </span>
                      )}
                      {listing.aiSummary && (
                        <span className="adm-tag hue-indigo">
                          <Sparkles size={11} aria-hidden="true" /> AI enriched
                        </span>
                      )}
                      <span
                        className={`adm-tag is-dot ${healthHue(listing.healthStatus)}`}
                        title="Link health"
                      >
                        {listing.healthStatus}
                      </span>
                    </div>

                    <div className="adm-listing-links">
                      <a
                        href={`/mcp/${listing.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="adm-link"
                      >
                        <ExternalLink size={13} aria-hidden="true" /> Listing
                        page
                      </a>
                      <a
                        href={listing.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="adm-link"
                      >
                        GitHub repo
                      </a>
                      {listing.websiteUrl && (
                        <a
                          href={listing.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="adm-link"
                        >
                          Product website
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Boost status */}
                  <span
                    className={`adm-tag adm-boost ${boosted ? 'hue-orange' : ''}`}
                  >
                    <Zap size={12} aria-hidden="true" />
                    {boosted
                      ? `${featuredDaysLeft}d boost active`
                      : 'No placement boost'}
                  </span>
                </div>

                {/* Inline edit form OR overview details */}
                {isEditing ? (
                  <div className="adm-edit">
                    <h4 className="adm-edit-title">Edit listing metadata</h4>
                    <div className="adm-form-grid">
                      <label className="adm-field">
                        <span>Name</span>
                        <input
                          className="form-input"
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, name: e.target.value }))
                          }
                          placeholder="Name"
                        />
                      </label>
                      <label className="adm-field">
                        <span>Category</span>
                        <select
                          className="form-input"
                          value={editForm.category}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              category: e.target.value,
                            }))
                          }
                        >
                          {(!editForm.category ||
                          DIRECTORY_CATEGORIES.includes(editForm.category)
                            ? DIRECTORY_CATEGORIES
                            : [editForm.category, ...DIRECTORY_CATEGORIES]
                          ).map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="adm-field">
                      <span>Description</span>
                      <textarea
                        className="form-input"
                        rows={3}
                        value={editForm.description}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Description"
                      />
                    </label>
                    <div className="adm-form-grid">
                      <label className="adm-field">
                        <span>GitHub repo URL</span>
                        <input
                          className="form-input"
                          value={editForm.url}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, url: e.target.value }))
                          }
                          placeholder="GitHub Repo URL"
                        />
                      </label>
                      <label className="adm-field">
                        <span>Website URL</span>
                        <input
                          className="form-input"
                          value={editForm.websiteUrl}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              websiteUrl: e.target.value,
                            }))
                          }
                          placeholder="Website URL"
                        />
                      </label>
                    </div>
                    <div className="adm-actions">
                      <button
                        type="button"
                        onClick={() => saveEdit(listing.id)}
                        disabled={rowLoading}
                        className="btn btn-sm btn-primary"
                      >
                        <Check size={14} aria-hidden="true" /> Save changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        disabled={rowLoading}
                        className="btn btn-sm btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="adm-listing-body">
                    <p className="adm-listing-desc">{listing.description}</p>

                    <div className="adm-meta">
                      <span>
                        <Folder size={13} aria-hidden="true" />
                        <strong>{listing.category}</strong>
                      </span>
                      {listing.submitterEmail && (
                        <span>
                          <Mail size={13} aria-hidden="true" /> Submitter{' '}
                          <strong>{listing.submitterEmail}</strong>
                        </span>
                      )}
                      {listing.ownerUserId && (
                        <span>
                          <User size={13} aria-hidden="true" /> Owner{' '}
                          <strong>{listing.ownerUserId.slice(0, 8)}…</strong>
                        </span>
                      )}
                      <span>
                        <Eye size={13} aria-hidden="true" />{' '}
                        {(listing.views || 0).toLocaleString()} views
                      </span>
                      <span>
                        <Heart size={13} aria-hidden="true" />{' '}
                        {(listing.upvotes || 0).toLocaleString()} upvotes
                      </span>
                      {listing.githubStars !== null &&
                        listing.githubStars !== undefined && (
                          <span>
                            <Star size={13} aria-hidden="true" />{' '}
                            {listing.githubStars.toLocaleString()} stars
                          </span>
                        )}
                    </div>
                  </div>
                )}

                {/* Grouped actions */}
                <div className="adm-action-groups">
                  {/* Group 1: verification & badges */}
                  <div className="adm-action-group">
                    <span className="adm-action-label">Badges</span>
                    <div className="adm-actions">
                      <button
                        type="button"
                        onClick={() => runAction(listing.id, 'toggle_official')}
                        disabled={rowLoading}
                        className="btn btn-sm adm-toggle"
                        aria-pressed={Boolean(listing.isOfficial)}
                        title="Manually toggle Official Project badge"
                      >
                        <ShieldCheck size={14} aria-hidden="true" />
                        {listing.isOfficial ? 'Official: on' : 'Make official'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          runAction(listing.id, 'toggle_reciprocal_badge')
                        }
                        disabled={rowLoading}
                        className="btn btn-sm adm-toggle"
                        aria-pressed={Boolean(listing.reciprocalBadgeOk)}
                        title="Manually toggle Verified (reciprocal badge) status"
                      >
                        <Award size={14} aria-hidden="true" />
                        {listing.reciprocalBadgeOk
                          ? 'Verified: yes'
                          : 'Mark verified'}
                      </button>

                      <button
                        type="button"
                        onClick={() => runAction(listing.id, 'check_health')}
                        disabled={rowLoading}
                        className="btn btn-sm btn-secondary"
                        title="Perform instant live HTTP health check"
                      >
                        <Activity size={14} aria-hidden="true" /> Re-check
                        health
                      </button>
                    </div>
                  </div>

                  {/* Group 2: boost & premium placements */}
                  <div className="adm-action-group">
                    <span className="adm-action-label">Placements</span>
                    <div className="adm-actions">
                      <button
                        type="button"
                        onClick={() =>
                          runAction(listing.id, 'feature', { days: 7 })
                        }
                        disabled={rowLoading}
                        className="btn btn-sm adm-btn-tint hue-orange"
                      >
                        +7d boost
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          runAction(listing.id, 'feature', { days: 30 })
                        }
                        disabled={rowLoading}
                        className="btn btn-sm adm-btn-tint hue-orange"
                      >
                        +30d boost
                      </button>

                      <button
                        type="button"
                        onClick={() => setBoostModalListing(listing)}
                        disabled={rowLoading}
                        className="btn btn-sm btn-secondary"
                      >
                        Custom boost…
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          runAction(
                            listing.id,
                            listing.isPremium ? 'unset_premium' : 'set_premium',
                          )
                        }
                        disabled={rowLoading}
                        className={`btn btn-sm ${listing.isPremium ? 'btn-secondary' : 'adm-btn-tint hue-violet'}`}
                      >
                        <Crown size={14} aria-hidden="true" />
                        {listing.isPremium ? 'Unset premium' : 'Make premium'}
                      </button>
                    </div>
                  </div>

                  {/* Group 3: directory controls */}
                  <div className="adm-action-group">
                    <span className="adm-action-label">Manage</span>
                    <div className="adm-actions">
                      <button
                        type="button"
                        onClick={() => startEdit(listing)}
                        disabled={rowLoading}
                        className="btn btn-sm btn-secondary"
                      >
                        <Pencil size={14} aria-hidden="true" /> Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => setInspectListing(listing)}
                        disabled={rowLoading}
                        className="btn btn-sm btn-secondary"
                      >
                        <ScanSearch size={14} aria-hidden="true" /> Inspector
                      </button>

                      {listing.status === 'active' ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              runAction(listing.id, 'resend_approval')
                            }
                            disabled={rowLoading}
                            className="btn btn-sm btn-secondary"
                            title="Resend approval email"
                          >
                            <Send size={14} aria-hidden="true" /> Resend email
                          </button>
                          <button
                            type="button"
                            onClick={() => runAction(listing.id, 'unpublish')}
                            disabled={rowLoading}
                            className="btn btn-sm adm-btn-tint hue-amber"
                          >
                            <EyeOff size={14} aria-hidden="true" /> Unpublish
                          </button>
                          <button
                            type="button"
                            onClick={() => mergeDuplicate(listing)}
                            disabled={rowLoading}
                            className="btn btn-sm btn-secondary"
                            title="Unpublish this listing and 308 its URL to another listing"
                          >
                            <GitMerge size={14} aria-hidden="true" /> Merge
                          </button>
                        </>
                      ) : listing.status === 'removed' ? (
                        <button
                          type="button"
                          onClick={() => runAction(listing.id, 'republish')}
                          disabled={rowLoading}
                          className="btn btn-sm adm-btn-tint hue-green"
                        >
                          <RotateCcw size={14} aria-hidden="true" /> Republish
                        </button>
                      ) : null}

                      {listing.status !== 'withdrawn' && (
                        <button
                          type="button"
                          onClick={() => withdrawListing(listing)}
                          disabled={rowLoading}
                          className="btn btn-sm adm-btn-tint hue-red"
                          title="Owner asked us to take it down: 404 every URL and never re-import it"
                        >
                          <Ban size={14} aria-hidden="true" /> Withdraw
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteListing(listing)}
                        disabled={rowLoading}
                        className="btn btn-sm adm-btn-tint hue-red"
                      >
                        <Trash2 size={14} aria-hidden="true" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination */}
      <nav className="adm-pager" aria-label="Listings pages">
        <span>
          {total === 0
            ? 'No listings'
            : `Showing ${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total.toLocaleString()} · page ${page} of ${totalPages}`}
        </span>
        <div className="adm-actions">
          <button
            type="button"
            onClick={() => fetchListings(Math.max(0, offset - PAGE_SIZE))}
            disabled={loading || offset === 0}
            className="btn btn-sm btn-secondary"
          >
            <ChevronLeft size={14} aria-hidden="true" /> Prev
          </button>
          <button
            type="button"
            onClick={() => fetchListings(offset + PAGE_SIZE)}
            disabled={loading || offset + PAGE_SIZE >= total}
            className="btn btn-sm btn-secondary"
          >
            Next <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      </nav>

      {/* Boost modal */}
      {boostModalListing && (
        <AdminModal
          title="Grant placement boost"
          subtitle={boostModalListing.name}
          icon={Zap}
          hue="hue-orange"
          onClose={() => setBoostModalListing(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setBoostModalListing(null)}
                className="btn btn-sm btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => grantFeaturedModal(boostModalListing.id)}
                className="btn btn-sm btn-primary"
              >
                Grant {customBoostDays} days boost
              </button>
            </>
          }
        >
          <p className="adm-dialog-text">
            Grant featured placement duration for this listing on the homepage
            and search listings.
          </p>
          <div className="adm-field">
            <label htmlFor="admin-boost-days">Number of days to add</label>
            <input
              id="admin-boost-days"
              type="number"
              min={1}
              max={365}
              className="form-input"
              value={customBoostDays}
              onChange={(e) => setCustomBoostDays(e.target.value)}
            />
          </div>
          <div className="adm-chip-row">
            {[7, 14, 30, 60, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setCustomBoostDays(String(d))}
                className="chip"
                aria-pressed={customBoostDays === String(d)}
              >
                {d} days
              </button>
            ))}
          </div>
        </AdminModal>
      )}

      {/* Inspector modal */}
      {inspectListing && (
        <AdminModal
          title="Listing inspector"
          subtitle={inspectListing.name}
          icon={ScanSearch}
          hue="hue-blue"
          wide
          onClose={() => setInspectListing(null)}
        >
          <dl className="adm-dl">
            <dt>ID</dt>
            <dd>
              <code className="adm-code">{inspectListing.id}</code>
            </dd>
            <dt>Submitter email</dt>
            <dd>{inspectListing.submitterEmail || 'Not recorded'}</dd>
            <dt>Owner user ID</dt>
            <dd>{inspectListing.ownerUserId || 'Unclaimed'}</dd>
            <dt>Official (admin-approved claim)</dt>
            <dd>{inspectListing.isOfficial ? 'Yes' : 'No'}</dd>
            <dt>Verified (reciprocal badge, SEO dofollow)</dt>
            <dd>
              {inspectListing.reciprocalBadgeOk
                ? 'Yes (Active dofollow)'
                : 'No (Pending)'}
            </dd>
            <dt>Health status</dt>
            <dd>
              <span
                className={`adm-tag is-dot ${healthHue(inspectListing.healthStatus)}`}
              >
                {inspectListing.healthStatus}
              </span>
            </dd>
            <dt>Created at</dt>
            <dd>{new Date(inspectListing.createdAt).toLocaleString()}</dd>
            <dt>AI summary</dt>
            <dd>{inspectListing.aiSummary || 'Not generated yet'}</dd>
          </dl>

          <div className="adm-field">
            <span className="adm-field-label">Introspected MCP tools</span>
            {inspectListing.tools ? (
              <pre className="adm-pre">
                {JSON.stringify(JSON.parse(inspectListing.tools), null, 2)}
              </pre>
            ) : (
              <span className="adm-muted">None introspected</span>
            )}
          </div>
        </AdminModal>
      )}
    </div>
  );
}

/** Status hue for a listing's link health. */
function healthHue(status: string): string {
  if (status === 'healthy') return 'hue-green';
  if (status === 'unknown') return '';
  return 'hue-red';
}
