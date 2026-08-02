'use client';

import { useEffect, useState, useRef } from 'react';
import { toast } from '../../components/ui/Toast';
import { notifyAdminStatsChanged } from '../../lib/adminStatsRefresh';

type Listing = {
  id: string;
  name: string;
  url: string;
  websiteUrl?: string | null;
  description: string;
  category: string;
  createdAt: string;
  isPremium: boolean;
  status: string;
  healthStatus: string;
  featuredUntil?: string | null;
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
      params.set('offset', String(nextOffset));
      params.set('limit', String(PAGE_SIZE));

      const res = await fetch(`/api/admin/listings?${params.toString()}`);
      const data = (await res.json()) as { items?: Listing[]; total?: number; error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not load listings');

      // Guard: only apply state if this is still the latest request
      if (requestId !== requestIdRef.current) return;

      setItems(data.items || []);
      setTotal(data.total || 0);
      setOffset(nextOffset);
    } catch (err: any) {
      // Only show error toast for genuine failures, not for stale requests
      if (requestId === requestIdRef.current) {
        toast.error('Could not load listings', { description: err?.message });
      }
    } finally {
      // Only clear loading if this is still the latest request
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
  }, [search, statusFilter, premiumFilter, featuredFilter, healthFilter]);

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
      <div className="admin-filters">
        <input
          className="form-input"
          placeholder="Search name or URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="admin-filter-selects">
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="removed">Removed</option>
          </select>
          <select
            className="form-input"
            value={premiumFilter}
            onChange={(e) => setPremiumFilter(e.target.value)}
          >
            <option value="">Any premium</option>
            <option value="true">Premium only</option>
            <option value="false">Free only</option>
          </select>
          <select
            className="form-input"
            value={featuredFilter}
            onChange={(e) => setFeaturedFilter(e.target.value)}
          >
            <option value="">Any featured</option>
            <option value="true">Currently featured</option>
          </select>
          <select
            className="form-input"
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
          >
            <option value="">Any health</option>
            <option value="healthy">Healthy</option>
            <option value="unknown">Unknown</option>
            <option value="archived">Archived</option>
            <option value="offline">Offline</option>
          </select>
        </div>
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Links</th>
              <th>Featured</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="admin-table-empty">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="admin-table-empty">
                  No listings match these filters.
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
                          <strong>{listing.name}</strong>
                          {listing.status === 'removed' && (
                            <span className="admin-badge" style={{ color: '#ef4444' }}>
                              REMOVED
                            </span>
                          )}
                          {listing.isPremium && (
                            <span className="admin-badge" style={{ color: '#00E5FF' }}>
                              PREMIUM
                            </span>
                          )}
                          <div className="admin-desc-line">{listing.description}</div>
                        </>
                      )}
                    </td>
                    <td data-label="Links">
                      <div className="admin-links-cell">
                        <a
                          href={listing.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}
                        >
                          Repo
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
                      </div>
                    </td>
                    <td data-label="Featured / Sponsor">
                      <div className="admin-feature-cell">
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: featuredDaysLeft && featuredDaysLeft > 0 ? '#00E5FF' : 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                          {featuredDaysLeft && featuredDaysLeft > 0 ? `★ ${featuredDaysLeft}d remaining` : 'No active boost'}
                        </div>
                        <div className="admin-feature-controls" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <button
                            onClick={() => runAction(listing.id, 'feature', { days: 7 })}
                            disabled={rowLoading}
                            className="admin-btn"
                            style={{ background: 'rgba(0,229,255,0.15)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.3)', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            title="Grant 7 days boost"
                          >
                            +7d Boost
                          </button>
                          <button
                            onClick={() => runAction(listing.id, 'feature', { days: 30 })}
                            disabled={rowLoading}
                            className="admin-btn"
                            style={{ background: 'rgba(255,215,0,0.15)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.3)', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            title="Grant 30 days boost"
                          >
                            +30d
                          </button>
                          <input
                            type="number"
                            min={1}
                            className="form-input"
                            style={{ width: '60px', padding: '0.25rem 0.4rem', fontSize: '0.75rem' }}
                            placeholder="Days"
                            value={featureDays[listing.id] || ''}
                            onChange={(e) => setFeatureDays((prev) => ({ ...prev, [listing.id]: e.target.value }))}
                          />
                          <button
                            onClick={() => grantFeatured(listing.id)}
                            disabled={rowLoading}
                            className="admin-btn"
                            style={{ background: '#007BFF', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            Grant
                          </button>
                        </div>
                      </div>
                    </td>
                    <td data-label="Submitted" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(listing.createdAt).toLocaleDateString()}
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
                              style={{ background: listing.isPremium ? '#64748b' : '#007BFF' }}
                            >
                              {listing.isPremium ? 'Remove premium' : 'Make premium'}
                            </button>
                            <button
                              onClick={() => startEdit(listing)}
                              disabled={rowLoading}
                              className="admin-btn"
                              style={{ background: '#64748b' }}
                            >
                              Edit
                            </button>
                            {listing.status === 'active' ? (
                              <>
                                <button
                                  onClick={() => runAction(listing.id, 'resend_approval')}
                                  disabled={rowLoading}
                                  className="admin-btn"
                                  style={{ background: '#007BFF' }}
                                  title="Re-send listing-approved email with claim + dofollow CTAs"
                                >
                                  Resend email
                                </button>
                                <button
                                  onClick={() => runAction(listing.id, 'unpublish')}
                                  disabled={rowLoading}
                                  className="admin-btn"
                                  style={{ background: '#f59e0b' }}
                                >
                                  Unpublish
                                </button>
                              </>
                            ) : listing.status === 'removed' ? (
                              <button
                                onClick={() => runAction(listing.id, 'republish')}
                                disabled={rowLoading}
                                className="admin-btn"
                                style={{ background: '#10b981' }}
                              >
                                Republish
                              </button>
                            ) : null}
                            <button
                              onClick={() => deleteListing(listing)}
                              disabled={rowLoading}
                              className="admin-btn"
                              style={{ background: '#ef4444' }}
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
    </div>
  );
}
