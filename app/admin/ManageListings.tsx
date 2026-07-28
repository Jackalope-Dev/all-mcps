'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { toast } from '../../components/ui/Toast';

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

  const fetchListings = async (nextOffset: number) => {
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

      setItems(data.items || []);
      setTotal(data.total || 0);
      setOffset(nextOffset);
    } catch (err: any) {
      toast.error('Could not load listings', { description: err?.message });
    } finally {
      setLoading(false);
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
    action: 'set_premium' | 'unset_premium' | 'edit' | 'unpublish' | 'republish' | 'delete' | 'feature',
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
    if (!window.confirm(`Permanently delete "${listing.name}"? This cannot be undone.`)) return;
    runAction(listing.id, 'delete');
  };

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <input
          className="form-input"
          placeholder="Search name or URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 220px' }}
        />
        <select
          className="form-input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: 'auto' }}
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
          style={{ width: 'auto' }}
        >
          <option value="">Any premium</option>
          <option value="true">Premium only</option>
          <option value="false">Free only</option>
        </select>
        <select
          className="form-input"
          value={featuredFilter}
          onChange={(e) => setFeaturedFilter(e.target.value)}
          style={{ width: 'auto' }}
        >
          <option value="">Any featured</option>
          <option value="true">Currently featured</option>
        </select>
        <select
          className="form-input"
          value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value)}
          style={{ width: 'auto' }}
        >
          <option value="">Any health</option>
          <option value="healthy">Healthy</option>
          <option value="unknown">Unknown</option>
          <option value="archived">Archived</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
              <th style={{ padding: '1rem' }}>Name</th>
              <th style={{ padding: '1rem' }}>Links</th>
              <th style={{ padding: '1rem' }}>Featured</th>
              <th style={{ padding: '1rem' }}>Submitted</th>
              <th style={{ padding: '1rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
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
                  <tr key={listing.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '260px' }}>
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
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>
                              REMOVED
                            </span>
                          )}
                          {listing.isPremium && (
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#00E5FF', fontWeight: 700 }}>
                              PREMIUM
                            </span>
                          )}
                          <div
                            style={{
                              fontSize: '0.875rem',
                              color: 'var(--text-secondary)',
                              marginTop: '0.25rem',
                              maxWidth: '300px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {listing.description}
                          </div>
                        </>
                      )}
                    </td>
                    <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
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
                    <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        {featuredDaysLeft && featuredDaysLeft > 0 ? `${featuredDaysLeft}d left` : '—'}
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <input
                          type="number"
                          min={1}
                          className="form-input"
                          placeholder="Days"
                          value={featureDays[listing.id] || ''}
                          onChange={(e) => setFeatureDays((prev) => ({ ...prev, [listing.id]: e.target.value }))}
                          style={{ width: '70px' }}
                        />
                        <button
                          onClick={() => grantFeatured(listing.id)}
                          disabled={rowLoading}
                          style={btnStyle('#007BFF', rowLoading)}
                        >
                          Grant
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', verticalAlign: 'top' }}>
                      {new Date(listing.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', maxWidth: '220px' }}>
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit(listing.id)}
                              disabled={rowLoading}
                              style={btnStyle('#10b981', rowLoading)}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              disabled={rowLoading}
                              style={btnStyle('#64748b', rowLoading)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => runAction(listing.id, listing.isPremium ? 'unset_premium' : 'set_premium')}
                              disabled={rowLoading}
                              style={btnStyle(listing.isPremium ? '#64748b' : '#007BFF', rowLoading)}
                            >
                              {listing.isPremium ? 'Remove premium' : 'Make premium'}
                            </button>
                            <button
                              onClick={() => startEdit(listing)}
                              disabled={rowLoading}
                              style={btnStyle('#64748b', rowLoading)}
                            >
                              Edit
                            </button>
                            {listing.status === 'active' ? (
                              <button
                                onClick={() => runAction(listing.id, 'unpublish')}
                                disabled={rowLoading}
                                style={btnStyle('#f59e0b', rowLoading)}
                              >
                                Unpublish
                              </button>
                            ) : listing.status === 'removed' ? (
                              <button
                                onClick={() => runAction(listing.id, 'republish')}
                                disabled={rowLoading}
                                style={btnStyle('#10b981', rowLoading)}
                              >
                                Republish
                              </button>
                            ) : null}
                            <button
                              onClick={() => deleteListing(listing)}
                              disabled={rowLoading}
                              style={btnStyle('#ef4444', rowLoading)}
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {total === 0
            ? 'No listings'
            : `Showing ${offset + 1}-${Math.min(offset + PAGE_SIZE, total)} of ${total} (page ${page} of ${totalPages})`}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => fetchListings(Math.max(0, offset - PAGE_SIZE))}
            disabled={loading || offset === 0}
            style={btnStyle('#64748b', loading || offset === 0)}
          >
            Prev
          </button>
          <button
            onClick={() => fetchListings(offset + PAGE_SIZE)}
            disabled={loading || offset + PAGE_SIZE >= total}
            style={btnStyle('#64748b', loading || offset + PAGE_SIZE >= total)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function btnStyle(bg: string, disabled: boolean): CSSProperties {
  return {
    padding: '0.5rem 1rem',
    background: bg,
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontSize: '0.85rem',
    fontWeight: 600,
  };
}
