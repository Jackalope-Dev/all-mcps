'use client';

import { useEffect, useState, useRef } from 'react';
import { toast } from '../../components/ui/Toast';
import { notifyAdminStatsChanged } from '../../lib/adminStatsRefresh';
import { DIRECTORY_CATEGORIES } from '../../lib/categories';
import {
  Search,
  ArrowUpDown,
  Eye,
  Heart,
  Download,
  Star,
  Info,
  Edit2,
  Trash2,
  ShieldCheck,
  Globe,
  Activity,
  Sparkles,
  Crown,
  CheckCircle2,
  X,
  ExternalLink,
  Mail,
  User,
  Plus,
  RefreshCw,
} from 'lucide-react';

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
  websiteVerified?: boolean;
  status: string;
  healthStatus: string;
  featuredUntil?: string | null;
  aiSummary?: string | null;
  tools?: string | null;
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
};

const PAGE_SIZE = 25;

export default function ManageListings() {
  const [items, setItems] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [premiumFilter, setPremiumFilter] = useState('');
  const [featuredFilter, setFeaturedFilter] = useState('');
  const [healthFilter, setHealthFilter] = useState('');
  const [aiFilter, setAiFilter] = useState('');
  const [toolsFilter, setToolsFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const [inspectListing, setInspectListing] = useState<Listing | null>(null);
  const [boostModalListing, setBoostModalListing] = useState<Listing | null>(null);
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

  const fetchListings = async (nextOffset: number) => {
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
      params.set('sort', sortBy);
      params.set('order', sortOrder);
      params.set('offset', String(nextOffset));
      params.set('limit', String(PAGE_SIZE));

      const res = await fetch(`/api/admin/listings?${params.toString()}`);
      const data = (await res.json()) as { items?: Listing[]; total?: number; error?: string };
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
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchListings(0);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, premiumFilter, featuredFilter, healthFilter, aiFilter, toolsFilter, sortBy, sortOrder]);

  const runAction = async (
    id: string,
    action:
      | 'set_premium'
      | 'unset_premium'
      | 'edit'
      | 'unpublish'
      | 'republish'
      | 'delete'
      | 'feature'
      | 'resend_approval'
      | 'toggle_official'
      | 'toggle_website_verified'
      | 'check_health',
    extra?: { fields?: Partial<EditFields>; days?: number }
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
        websiteVerified?: boolean;
        healthStatus?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Action failed');

      if (action === 'delete') {
        setItems((prev) => prev.filter((s) => s.id !== id));
        setTotal((prev) => Math.max(0, prev - 1));
      } else if (action === 'set_premium' || action === 'unset_premium') {
        setItems((prev) =>
          prev.map((s) => (s.id === id ? { ...s, isPremium: action === 'set_premium' } : s))
        );
      } else if (action === 'toggle_official') {
        setItems((prev) =>
          prev.map((s) => (s.id === id ? { ...s, isOfficial: data.isOfficial ?? !s.isOfficial } : s))
        );
      } else if (action === 'toggle_website_verified') {
        setItems((prev) =>
          prev.map((s) => (s.id === id ? { ...s, websiteVerified: data.websiteVerified ?? !s.websiteVerified } : s))
        );
      } else if (action === 'check_health') {
        setItems((prev) =>
          prev.map((s) => (s.id === id ? { ...s, healthStatus: data.healthStatus ?? s.healthStatus } : s))
        );
      } else if (action === 'unpublish' || action === 'republish') {
        setItems((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status: action === 'unpublish' ? 'removed' : 'active' } : s))
        );
      } else if (action === 'edit') {
        setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...extra?.fields } : s)));
        setEditingId(null);
      } else if (action === 'feature') {
        setItems((prev) =>
          prev.map((s) => (s.id === id ? { ...s, featuredUntil: data.featuredUntil ?? s.featuredUntil } : s))
        );
        setBoostModalListing(null);
      }

      toast.success(data.message || 'Done');
      notifyAdminStatsChanged();
    } catch (err: any) {
      toast.error('Action failed', { description: err?.message || 'Something went wrong.' });
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

  const deleteListing = (listing: Listing) => {
    const warning = listing.isPremium
      ? `"${listing.name}" is a premium listing. Deleting it here does NOT cancel its Stripe subscription — cancel that separately in Stripe. Permanently delete anyway?`
      : `Permanently delete "${listing.name}"? This cannot be undone.`;
    if (!window.confirm(warning)) return;
    runAction(listing.id, 'delete');
  };

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Search & Filter Toolbar */}
      <div className="admin-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', width: '100%', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
            <Search className="w-4 h-4" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Search catalog by listing name or repository URL..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select
              className="form-input"
              style={{ width: 'auto', minWidth: '160px' }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="createdAt">Sort: Created Date</option>
              <option value="name">Sort: Name</option>
              <option value="views">Sort: Views</option>
              <option value="upvotes">Sort: Upvotes</option>
              <option value="stars">Sort: GitHub Stars</option>
            </select>

            <button
              onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              className="admin-btn"
              style={{
                background: 'rgba(128, 128, 128, 0.08)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              title="Toggle sort direction"
            >
              <ArrowUpDown className="w-3.5 h-3.5" /> {sortOrder.toUpperCase()}
            </button>
          </div>
        </div>

        <div className="admin-filter-selects">
          <select className="form-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Status: All</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="removed">Removed</option>
          </select>
          <select className="form-input" value={premiumFilter} onChange={(e) => setPremiumFilter(e.target.value)}>
            <option value="">Premium: Any</option>
            <option value="true">Premium only</option>
            <option value="false">Free only</option>
          </select>
          <select className="form-input" value={featuredFilter} onChange={(e) => setFeaturedFilter(e.target.value)}>
            <option value="">Featured: Any</option>
            <option value="true">Currently Featured</option>
          </select>
          <select className="form-input" value={healthFilter} onChange={(e) => setHealthFilter(e.target.value)}>
            <option value="">Health: Any</option>
            <option value="healthy">Healthy</option>
            <option value="unknown">Unknown</option>
            <option value="archived">Archived</option>
            <option value="offline">Offline</option>
          </select>
          <select className="form-input" value={aiFilter} onChange={(e) => setAiFilter(e.target.value)}>
            <option value="">AI Content: Any</option>
            <option value="true">Enriched</option>
            <option value="false">Not Enriched</option>
          </select>
          <select className="form-input" value={toolsFilter} onChange={(e) => setToolsFilter(e.target.value)}>
            <option value="">MCP Tools: Any</option>
            <option value="true">Has Tools</option>
            <option value="false">No Tools</option>
          </select>
        </div>
      </div>

      {/* Directory Listing Cards Layout */}
      {loading ? (
        <div className="admin-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading MCP listings catalog...
        </div>
      ) : items.length === 0 ? (
        <div className="admin-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No listings match the specified filter criteria.
        </div>
      ) : (
        <ul role="list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((listing) => {
            const featuredUntilDate = listing.featuredUntil ? new Date(listing.featuredUntil) : null;
            const featuredDaysLeft = featuredUntilDate
              ? Math.ceil((featuredUntilDate.getTime() - Date.now()) / 86400000)
              : null;
            const isEditing = editingId === listing.id;
            const rowLoading = loadingId === listing.id;

            return (
              <li
                key={listing.id}
                className="admin-card"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  borderLeft: listing.isPremium ? '4px solid var(--accent-color)' : '1px solid var(--border-color)',
                }}
              >
                {/* Header Row: Title, Badges & Links */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{listing.name}</h3>

                      {listing.status === 'removed' && (
                        <span className="admin-badge" style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.12)' }}>
                          REMOVED
                        </span>
                      )}
                      {listing.isPremium && (
                        <span className="admin-badge" style={{ color: '#0284c7', background: 'rgba(2, 132, 199, 0.12)', border: '1px solid rgba(2, 132, 199, 0.3)' }}>
                          PREMIUM
                        </span>
                      )}
                      {listing.isOfficial && (
                        <span className="admin-badge" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.12)' }}>
                          ★ OFFICIAL
                        </span>
                      )}
                      {listing.websiteVerified && (
                        <span className="admin-badge" style={{ color: '#2563eb', background: 'rgba(37, 99, 235, 0.12)' }}>
                          SITE VERIFIED
                        </span>
                      )}
                      {listing.aiSummary && (
                        <span className="admin-badge" style={{ color: '#7c3aed', background: 'rgba(124, 58, 237, 0.12)' }}>
                          AI ENRICHED
                        </span>
                      )}
                      <span
                        className="admin-badge"
                        style={{
                          color: listing.healthStatus === 'healthy' ? '#10b981' : listing.healthStatus === 'unknown' ? 'var(--text-secondary)' : '#ef4444',
                          background: 'rgba(128, 128, 128, 0.1)',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        HEALTH: {listing.healthStatus.toUpperCase()}
                      </span>
                    </div>

                    {/* External Links Bar */}
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.825rem', marginTop: '0.15rem' }}>
                      <a href={`/mcp/${listing.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}>
                        <ExternalLink className="w-3.5 h-3.5" /> Listing Page
                      </a>
                      <a href={listing.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}>
                        GitHub Repo
                      </a>
                      {listing.websiteUrl && (
                        <a href={listing.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}>
                          Product Website
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Boost Status Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        background: featuredDaysLeft && featuredDaysLeft > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(128, 128, 128, 0.08)',
                        border: featuredDaysLeft && featuredDaysLeft > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-color)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: featuredDaysLeft && featuredDaysLeft > 0 ? '#d97706' : 'var(--text-secondary)',
                      }}
                    >
                      {featuredDaysLeft && featuredDaysLeft > 0 ? `★ ${featuredDaysLeft}d boost active` : 'No placement boost'}
                    </div>
                  </div>
                </div>

                {/* Inline Edit Form OR Overview details */}
                {isEditing ? (
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Edit Listing Metadata</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                      <input
                        className="form-input"
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Name"
                      />
                      <select
                        className="form-input"
                        value={editForm.category}
                        onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                      >
                        {(!editForm.category || DIRECTORY_CATEGORIES.includes(editForm.category)
                          ? DIRECTORY_CATEGORIES
                          : [editForm.category, ...DIRECTORY_CATEGORIES]
                        ).map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      className="form-input"
                      rows={2}
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Description"
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                      <input
                        className="form-input"
                        value={editForm.url}
                        onChange={(e) => setEditForm((f) => ({ ...f, url: e.target.value }))}
                        placeholder="GitHub Repo URL"
                      />
                      <input
                        className="form-input"
                        value={editForm.websiteUrl}
                        onChange={(e) => setEditForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                        placeholder="Website URL"
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <button onClick={() => saveEdit(listing.id)} disabled={rowLoading} className="admin-btn" style={{ background: '#10b981' }}>
                        Save Changes
                      </button>
                      <button onClick={() => setEditingId(null)} disabled={rowLoading} className="admin-btn" style={{ background: '#64748b' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, marginBottom: '0.5rem', lineHeight: 1.4 }}>
                      {listing.description}
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(128,128,128,0.04)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <span>Category: <strong style={{ color: 'var(--text-primary)' }}>{listing.category}</strong></span>
                      {listing.submitterEmail && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Mail className="w-3.5 h-3.5" /> Submitter: <strong style={{ color: 'var(--text-primary)' }}>{listing.submitterEmail}</strong>
                        </span>
                      )}
                      {listing.ownerUserId && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <User className="w-3.5 h-3.5" /> Owner: <strong style={{ color: 'var(--text-primary)' }}>{listing.ownerUserId.slice(0, 8)}...</strong>
                        </span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Eye className="w-3.5 h-3.5" /> {listing.views || 0} views</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Heart className="w-3.5 h-3.5 text-red-400" /> {listing.upvotes || 0} upvotes</span>
                      {listing.githubStars !== null && listing.githubStars !== undefined && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Star className="w-3.5 h-3.5 text-amber-400" /> {listing.githubStars} stars</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Verification & Placement Control Toolbars */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                  {/* Manual Verification Action Pills */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => runAction(listing.id, 'toggle_official')}
                      disabled={rowLoading}
                      className="admin-btn"
                      style={{
                        background: listing.isOfficial ? 'rgba(16, 185, 129, 0.15)' : 'rgba(128,128,128,0.08)',
                        color: listing.isOfficial ? '#10b981' : 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                      title="Manually toggle Official Project badge"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> {listing.isOfficial ? 'Official Badge: ON' : 'Make Official'}
                    </button>

                    <button
                      onClick={() => runAction(listing.id, 'toggle_website_verified')}
                      disabled={rowLoading}
                      className="admin-btn"
                      style={{
                        background: listing.websiteVerified ? 'rgba(37, 99, 235, 0.15)' : 'rgba(128,128,128,0.08)',
                        color: listing.websiteVerified ? '#2563eb' : 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                      title="Manually toggle Website Verified status"
                    >
                      <Globe className="w-3.5 h-3.5" /> {listing.websiteVerified ? 'Site Verified: YES' : 'Verify Site'}
                    </button>

                    <button
                      onClick={() => runAction(listing.id, 'check_health')}
                      disabled={rowLoading}
                      className="admin-btn"
                      style={{
                        background: 'rgba(128,128,128,0.08)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                      title="Perform instant live HTTP health check"
                    >
                      <Activity className="w-3.5 h-3.5" /> Re-check Links Health
                    </button>
                  </div>

                  {/* Primary Action Buttons Bar */}
                  <div className="admin-actions" style={{ gap: '0.4rem' }}>
                    <button
                      onClick={() => runAction(listing.id, 'feature', { days: 7 })}
                      disabled={rowLoading}
                      className="admin-btn"
                      style={{ background: 'rgba(2,132,199,0.15)', color: '#0284c7', border: '1px solid rgba(2,132,199,0.4)', padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}
                    >
                      +7d Boost
                    </button>

                    <button
                      onClick={() => runAction(listing.id, 'feature', { days: 30 })}
                      disabled={rowLoading}
                      className="admin-btn"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706', border: '1px solid rgba(245,158,11,0.4)', padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}
                    >
                      +30d Boost
                    </button>

                    <button
                      onClick={() => setBoostModalListing(listing)}
                      disabled={rowLoading}
                      className="admin-btn"
                      style={{ background: 'rgba(128,128,128,0.08)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                    >
                      Custom Boost...
                    </button>

                    <button
                      onClick={() => runAction(listing.id, listing.isPremium ? 'unset_premium' : 'set_premium')}
                      disabled={rowLoading}
                      className="admin-btn"
                      style={{ background: listing.isPremium ? '#64748b' : '#0284c7', color: '#ffffff', padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                    >
                      {listing.isPremium ? 'Unset Premium' : 'Make Premium'}
                    </button>

                    <button
                      onClick={() => startEdit(listing)}
                      disabled={rowLoading}
                      className="admin-btn"
                      style={{ background: '#64748b', color: '#ffffff', padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => setInspectListing(listing)}
                      disabled={rowLoading}
                      className="admin-btn"
                      style={{ background: 'rgba(128,128,128,0.08)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                    >
                      Inspector
                    </button>

                    {listing.status === 'active' ? (
                      <>
                        <button
                          onClick={() => runAction(listing.id, 'resend_approval')}
                          disabled={rowLoading}
                          className="admin-btn"
                          style={{ background: '#0284c7', padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                          title="Resend approval email"
                        >
                          Resend Email
                        </button>
                        <button
                          onClick={() => runAction(listing.id, 'unpublish')}
                          disabled={rowLoading}
                          className="admin-btn"
                          style={{ background: '#f59e0b', padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                        >
                          Unpublish
                        </button>
                      </>
                    ) : listing.status === 'removed' ? (
                      <button
                        onClick={() => runAction(listing.id, 'republish')}
                        disabled={rowLoading}
                        className="admin-btn"
                        style={{ background: '#10b981', padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                      >
                        Republish
                      </button>
                    ) : null}

                    <button
                      onClick={() => deleteListing(listing)}
                      disabled={rowLoading}
                      className="admin-btn"
                      style={{ background: '#ef4444', padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination Controls */}
      <div className="admin-pagination">
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {total === 0
            ? 'No listings'
            : `Showing ${offset + 1}-${Math.min(offset + PAGE_SIZE, total)} of ${total} (page ${page} of ${totalPages})`}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => fetchListings(Math.max(0, offset - PAGE_SIZE))}
            disabled={loading || offset === 0}
            className="admin-btn"
            style={{ background: '#64748b' }}
          >
            Prev
          </button>
          <button
            onClick={() => fetchListings(offset + PAGE_SIZE)}
            disabled={loading || offset + PAGE_SIZE >= total}
            className="admin-btn"
            style={{ background: '#64748b' }}
          >
            Next
          </button>
        </div>
      </div>

      {/* Boost Modal (Fixes Firefox squished spinner issue) */}
      {boostModalListing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setBoostModalListing(null)}
        >
          <div
            style={{
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Grant Placement Boost: {boostModalListing.name}
              </h3>
              <button onClick={() => setBoostModalListing(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Grant featured placement duration for this listing on the homepage and search listings.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Number of Days to Add
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  className="form-input"
                  style={{ width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.95rem' }}
                  value={customBoostDays}
                  onChange={(e) => setCustomBoostDays(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[7, 14, 30, 60, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setCustomBoostDays(String(d))}
                    className="admin-btn"
                    style={{ background: 'rgba(128,128,128,0.08)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  >
                    {d} days
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button onClick={() => setBoostModalListing(null)} className="admin-btn" style={{ background: '#64748b', color: '#ffffff' }}>
                  Cancel
                </button>
                <button onClick={() => grantFeaturedModal(boostModalListing.id)} className="admin-btn" style={{ background: '#0284c7', color: '#ffffff' }}>
                  Grant {customBoostDays} Days Boost
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inspector Modal */}
      {inspectListing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setInspectListing(null)}
        >
          <div
            style={{
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '640px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Listing Inspector: {inspectListing.name}</h3>
              <button onClick={() => setInspectListing(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div><strong>ID:</strong> <code style={{ color: 'var(--accent-color)', fontWeight: 700 }}>{inspectListing.id}</code></div>
              <div><strong>Submitter Email:</strong> {inspectListing.submitterEmail || 'Not recorded'}</div>
              <div><strong>Owner User ID:</strong> {inspectListing.ownerUserId || 'Unclaimed'}</div>
              <div><strong>Official Project Badge:</strong> {inspectListing.isOfficial ? 'Yes (Verified)' : 'No'}</div>
              <div><strong>Website Verified:</strong> {inspectListing.websiteVerified ? 'Yes (Verified)' : 'No'}</div>
              <div><strong>Health Status:</strong> {inspectListing.healthStatus}</div>
              <div><strong>Created At:</strong> {new Date(inspectListing.createdAt).toLocaleString()}</div>
              <div><strong>AI Summary:</strong> {inspectListing.aiSummary || 'Not generated yet'}</div>

              <div>
                <strong>Introspected MCP Tools:</strong>
                {inspectListing.tools ? (
                  <pre style={{ background: 'rgba(128,128,128,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', overflowX: 'auto', marginTop: '0.25rem' }}>
                    {JSON.stringify(JSON.parse(inspectListing.tools), null, 2)}
                  </pre>
                ) : (
                  <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>None introspected</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
