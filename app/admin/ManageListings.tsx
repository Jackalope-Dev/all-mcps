'use client';

import { useEffect, useState, useRef } from 'react';
import { toast } from '../../components/ui/Toast';
import { notifyAdminStatsChanged } from '../../lib/adminStatsRefresh';
import { Search, Filter, ArrowUpDown, Eye, Heart, Download, Star, Info, Edit2, Trash2, Send, Zap, X, Crown, Sparkles } from 'lucide-react';

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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFields>({
    name: '',
    description: '',
    category: '',
    url: '',
    websiteUrl: '',
  });
  const [featureDays, setFeatureDays] = useState<Record<string, string>>({});

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
      | 'resend_approval',
    extra?: { fields?: Partial<EditFields>; days?: number }
  ) => {
    setLoadingId(id);
    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const data = (await res.json()) as { error?: string; message?: string; featuredUntil?: string };
      if (!res.ok) throw new Error(data.error || 'Action failed');

      if (action === 'delete') {
        setItems((prev) => prev.filter((s) => s.id !== id));
        setTotal((prev) => Math.max(0, prev - 1));
      } else if (action === 'set_premium' || action === 'unset_premium') {
        setItems((prev) =>
          prev.map((s) => (s.id === id ? { ...s, isPremium: action === 'set_premium' } : s))
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
        setFeatureDays((prev) => ({ ...prev, [id]: '' }));
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

  const grantFeatured = (id: string) => {
    const days = Number(featureDays[id]);
    if (!days || days < 1) {
      toast.error('Enter a number of days to grant.');
      return;
    }
    runAction(id, 'feature', { days });
  };

  const deleteListing = (listing: Listing) => {
    const warning = listing.isPremium
      ? `"${listing.name}" is a premium listing. Deleting it here does NOT cancel its Stripe subscription — cancel that separately in Stripe. Permanently delete anyway? This cannot be undone.`
      : `Permanently delete "${listing.name}"? This cannot be undone.`;
    if (!window.confirm(warning)) return;
    runAction(listing.id, 'delete');
  };

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      {/* Search & Filter Toolbar */}
      <div className="admin-filters" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', width: '100%', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search className="w-4 h-4" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Search listing by name or repository URL..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select
              className="form-input"
              style={{ width: 'auto' }}
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
              style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              title="Toggle sort direction"
            >
              <ArrowUpDown className="w-3.5 h-3.5" /> {sortOrder.toUpperCase()}
            </button>
          </div>
        </div>

        <div className="admin-filter-selects" style={{ marginTop: '0.5rem' }}>
          <select
            className="form-input"
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
            value={premiumFilter}
            onChange={(e) => setPremiumFilter(e.target.value)}
          >
            <option value="">Premium: Any</option>
            <option value="true">Premium only</option>
            <option value="false">Free only</option>
          </select>
          <select
            className="form-input"
            value={featuredFilter}
            onChange={(e) => setFeaturedFilter(e.target.value)}
          >
            <option value="">Featured: Any</option>
            <option value="true">Currently Featured</option>
          </select>
          <select
            className="form-input"
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
          >
            <option value="">Health: Any</option>
            <option value="healthy">Healthy</option>
            <option value="unknown">Unknown</option>
            <option value="archived">Archived</option>
            <option value="offline">Offline</option>
          </select>
          <select
            className="form-input"
            value={aiFilter}
            onChange={(e) => setAiFilter(e.target.value)}
          >
            <option value="">AI Content: Any</option>
            <option value="true">Enriched</option>
            <option value="false">Not Enriched</option>
          </select>
          <select
            className="form-input"
            value={toolsFilter}
            onChange={(e) => setToolsFilter(e.target.value)}
          >
            <option value="">MCP Tools: Any</option>
            <option value="true">Has Introspected Tools</option>
            <option value="false">No Introspected Tools</option>
          </select>
        </div>
      </div>

      {/* Directory Table */}
      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Listing Name & Metadata</th>
              <th>Links & Details</th>
              <th>Boost / Featured</th>
              <th>Stats</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="admin-table-empty">
                  Loading listings catalog...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-table-empty">
                  No listings match the specified filter criteria.
                </td>
              </tr>
            ) : (
              items.map((listing) => {
                const featuredUntilDate = listing.featuredUntil ? new Date(listing.featuredUntil) : null;
                const featuredDaysLeft = featuredUntilDate
                  ? Math.ceil((featuredUntilDate.getTime() - Date.now()) / 86400000)
                  : null;
                const isEditing = editingId === listing.id;
                const rowLoading = loadingId === listing.id;

                return (
                  <tr key={listing.id}>
                    <td data-label="Name">
                      {isEditing ? (
                        <div className="admin-edit-form">
                          <input
                            className="form-input"
                            value={editForm.name}
                            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                            placeholder="Name"
                          />
                          <textarea
                            className="form-input"
                            rows={3}
                            value={editForm.description}
                            onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                            placeholder="Description"
                          />
                          <input
                            className="form-input"
                            value={editForm.category}
                            onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                            placeholder="Category"
                          />
                          <input
                            className="form-input"
                            value={editForm.url}
                            onChange={(e) => setEditForm((f) => ({ ...f, url: e.target.value }))}
                            placeholder="Repo URL"
                          />
                          <input
                            className="form-input"
                            value={editForm.websiteUrl}
                            onChange={(e) => setEditForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                            placeholder="Website URL"
                          />
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.95rem' }}>{listing.name}</strong>
                            {listing.status === 'removed' && (
                              <span className="admin-badge" style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}>
                                REMOVED
                              </span>
                            )}
                            {listing.isPremium && (
                              <span className="admin-badge" style={{ color: '#00E5FF', background: 'rgba(0, 229, 255, 0.1)' }}>
                                PREMIUM
                              </span>
                            )}
                            {listing.isOfficial && (
                              <span className="admin-badge" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}>
                                OFFICIAL
                              </span>
                            )}
                            {listing.aiSummary && (
                              <span className="admin-badge" style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)' }} title="AI Enriched">
                                AI
                              </span>
                            )}
                          </div>

                          <div className="admin-desc-line">{listing.description}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            Cat: <span style={{ color: 'white' }}>{listing.category}</span> · Health: <span style={{ color: listing.healthStatus === 'healthy' ? '#10b981' : '#f59e0b' }}>{listing.healthStatus}</span>
                          </div>
                        </>
                      )}
                    </td>

                    <td data-label="Links">
                      <div className="admin-links-cell" style={{ gap: '0.35rem' }}>
                        <a
                          href={`/mcp/${listing.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}
                        >
                          Listing Page
                        </a>
                        <a
                          href={listing.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}
                        >
                          Repository
                        </a>
                        {listing.websiteUrl && (
                          <a
                            href={listing.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}
                          >
                            Website
                          </a>
                        )}
                        <button
                          onClick={() => setInspectListing(listing)}
                          style={{ background: 'transparent', border: 'none', padding: 0, color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.25rem' }}
                        >
                          <Info className="w-3.5 h-3.5" /> View Inspector
                        </button>
                      </div>
                    </td>

                    <td data-label="Featured">
                      <div className="admin-feature-cell">
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: featuredDaysLeft && featuredDaysLeft > 0 ? '#ffd700' : 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                          {featuredDaysLeft && featuredDaysLeft > 0 ? `★ ${featuredDaysLeft}d boost left` : 'No active boost'}
                        </div>
                        <div className="admin-feature-controls" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <button
                            onClick={() => runAction(listing.id, 'feature', { days: 7 })}
                            disabled={rowLoading}
                            className="admin-btn"
                            style={{ background: 'rgba(0,229,255,0.12)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)', padding: '0.25rem 0.4rem', fontSize: '0.75rem' }}
                            title="Grant 7 days boost"
                          >
                            +7d
                          </button>
                          <button
                            onClick={() => runAction(listing.id, 'feature', { days: 30 })}
                            disabled={rowLoading}
                            className="admin-btn"
                            style={{ background: 'rgba(255,215,0,0.12)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.3)', padding: '0.25rem 0.4rem', fontSize: '0.75rem' }}
                            title="Grant 30 days boost"
                          >
                            +30d
                          </button>
                          <input
                            type="number"
                            min={1}
                            className="form-input"
                            style={{ width: '50px', padding: '0.2rem 0.3rem', fontSize: '0.75rem' }}
                            placeholder="Days"
                            value={featureDays[listing.id] || ''}
                            onChange={(e) => setFeatureDays((prev) => ({ ...prev, [listing.id]: e.target.value }))}
                          />
                          <button
                            onClick={() => grantFeatured(listing.id)}
                            disabled={rowLoading}
                            className="admin-btn"
                            style={{ background: '#007BFF', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                          >
                            Set
                          </button>
                        </div>
                      </div>
                    </td>

                    <td data-label="Stats" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <div><Eye className="w-3 h-3 inline mr-1" /> {listing.views || 0} views</div>
                      <div><Heart className="w-3 h-3 inline mr-1 text-red-400" /> {listing.upvotes || 0} upvotes</div>
                      <div><Star className="w-3 h-3 inline mr-1 text-amber-400" /> {listing.githubStars ? `${listing.githubStars} stars` : '—'}</div>
                    </td>

                    <td data-label="Actions">
                      <div className="admin-actions">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit(listing.id)}
                              disabled={rowLoading}
                              className="admin-btn"
                              style={{ background: '#10b981' }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              disabled={rowLoading}
                              className="admin-btn"
                              style={{ background: '#64748b' }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => runAction(listing.id, listing.isPremium ? 'unset_premium' : 'set_premium')}
                              disabled={rowLoading}
                              className="admin-btn"
                              style={{ background: listing.isPremium ? '#64748b' : '#007BFF', padding: '0.35rem 0.65rem' }}
                            >
                              {listing.isPremium ? 'Unset Premium' : 'Make Premium'}
                            </button>
                            <button
                              onClick={() => startEdit(listing)}
                              disabled={rowLoading}
                              className="admin-btn"
                              style={{ background: '#64748b', padding: '0.35rem 0.65rem' }}
                            >
                              Edit
                            </button>
                            {listing.status === 'active' ? (
                              <>
                                <button
                                  onClick={() => runAction(listing.id, 'resend_approval')}
                                  disabled={rowLoading}
                                  className="admin-btn"
                                  style={{ background: '#0284c7', padding: '0.35rem 0.65rem' }}
                                  title="Resend approval email"
                                >
                                  Resend Email
                                </button>
                                <button
                                  onClick={() => runAction(listing.id, 'unpublish')}
                                  disabled={rowLoading}
                                  className="admin-btn"
                                  style={{ background: '#f59e0b', padding: '0.35rem 0.65rem' }}
                                >
                                  Unpublish
                                </button>
                              </>
                            ) : listing.status === 'removed' ? (
                              <button
                                onClick={() => runAction(listing.id, 'republish')}
                                disabled={rowLoading}
                                className="admin-btn"
                                style={{ background: '#10b981', padding: '0.35rem 0.65rem' }}
                              >
                                Republish
                              </button>
                            ) : null}
                            <button
                              onClick={() => deleteListing(listing)}
                              disabled={rowLoading}
                              className="admin-btn"
                              style={{ background: '#ef4444', padding: '0.35rem 0.65rem' }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

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
              background: '#0f172a',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '640px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Listing Inspector: {inspectListing.name}</h3>
              <button onClick={() => setInspectListing(null)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div><strong>ID:</strong> <code style={{ color: '#00E5FF' }}>{inspectListing.id}</code></div>
              <div><strong>Submitter Email:</strong> {inspectListing.submitterEmail || 'Not recorded'}</div>
              <div><strong>Owner User ID:</strong> {inspectListing.ownerUserId || 'Unclaimed'}</div>
              <div><strong>Created At:</strong> {new Date(inspectListing.createdAt).toLocaleString()}</div>
              <div><strong>AI Summary:</strong> {inspectListing.aiSummary || 'Not generated yet'}</div>

              <div>
                <strong>Introspected MCP Tools:</strong>
                {inspectListing.tools ? (
                  <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', overflowX: 'auto', marginTop: '0.25rem' }}>
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
