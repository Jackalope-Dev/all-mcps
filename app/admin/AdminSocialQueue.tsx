'use client';

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CopyX,
  Plus,
  RefreshCw,
  Send,
  Share2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '@/components/ui/Toast';

type SocialPost = {
  id: number;
  guid: string;
  channel: string;
  status: 'queued' | 'sent' | 'failed';
  serverId?: string | null;
  tweetText: string;
  source?: string | null;
  createdAt: string;
  sentAt?: string | null;
};

export function AdminSocialQueue() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [customTweet, setCustomTweet] = useState('');
  const [queuing, setQueuing] = useState(false);
  const [deduping, setDeduping] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/social');
      if (!res.ok) throw new Error('Failed to load social posts');
      const data: any = await res.json();
      setPosts(data.posts || []);
    } catch (err: any) {
      toast.error('Social Queue Error', { description: err?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleQueueCustom = async () => {
    if (!customTweet.trim()) {
      toast.error('Enter tweet text to queue.');
      return;
    }
    setQueuing(true);
    try {
      const res = await fetch('/api/admin/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'queue_tweet',
          tweetText: customTweet.trim(),
        }),
      });
      const data: any = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to queue tweet');

      toast.success('Custom tweet queued!');
      setCustomTweet('');
      fetchPosts();
    } catch (err: any) {
      toast.error('Failed to queue tweet', { description: err?.message });
    } finally {
      setQueuing(false);
    }
  };

  const handleDedupe = async () => {
    setDeduping(true);
    try {
      const res = await fetch('/api/admin/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dedupe_queue' }),
      });
      const data: any = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clear duplicates');
      toast.success(data.message || 'Duplicates cleared.');
      fetchPosts();
    } catch (err: any) {
      toast.error('Failed to clear duplicates', { description: err?.message });
    } finally {
      setDeduping(false);
    }
  };

  const handleMarkSent = async (id: number) => {
    setPendingId(id);
    try {
      const res = await fetch('/api/admin/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_sent', id }),
      });
      const data: any = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark as sent');
      toast.success('Marked as sent — removed from the outbound feed.');
      fetchPosts();
    } catch (err: any) {
      toast.error('Failed to mark as sent', { description: err?.message });
    } finally {
      setPendingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'queued':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: '#fbbf24',
              background: 'rgba(251, 191, 36, 0.1)',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <Clock className="w-3.5 h-3.5" /> QUEUED
          </span>
        );
      case 'sent':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: '#10b981',
              background: 'rgba(16, 185, 129, 0.1)',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> SENT
          </span>
        );
      case 'failed':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: '#ef4444',
              background: 'rgba(239, 68, 68, 0.1)',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <AlertCircle className="w-3.5 h-3.5" /> FAILED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Queue Custom Tweet Box */}
      <div className="admin-card" style={{ padding: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Share2
              className="w-5 h-5"
              style={{ color: 'var(--accent-color)' }}
            />
            <h3
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                margin: 0,
                color: 'var(--text-primary)',
              }}
            >
              Social Tweet Pipeline
            </h3>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleDedupe}
              disabled={deduping || loading}
              className="admin-btn"
              title="Delete queued tweets whose text duplicates a newer one so Buffer never reposts the same content."
              style={{
                background: 'rgba(128, 128, 128, 0.08)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <CopyX
                className={`w-3.5 h-3.5 ${deduping ? 'animate-spin' : ''}`}
              />{' '}
              Clear duplicates
            </button>
            <button
              onClick={fetchPosts}
              disabled={loading}
              className="admin-btn"
              style={{
                background: 'rgba(128, 128, 128, 0.08)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              />{' '}
              Refresh
            </button>
          </div>
        </div>

        <p
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            marginBottom: '1rem',
          }}
        >
          Outbound Twitter RSS queue. Newly approved listings and automated
          highlights are added automatically.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            className="form-input"
            style={{ flex: 1, minWidth: '260px' }}
            placeholder="Compose custom tweet text to enqueue..."
            value={customTweet}
            onChange={(e) => setCustomTweet(e.target.value)}
          />
          <button
            onClick={handleQueueCustom}
            disabled={queuing || !customTweet.trim()}
            className="admin-btn"
            style={{
              background: '#007BFF',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <Plus className="w-4 h-4" /> Queue Tweet
          </button>
        </div>
      </div>

      {/* Social Posts Table */}
      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Channel</th>
              <th>Tweet Preview</th>
              <th>Source</th>
              <th>Queued Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="admin-table-empty">
                  Loading social posts...
                </td>
              </tr>
            ) : posts.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-table-empty">
                  No social posts in history.
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id}>
                  <td data-label="Status">{getStatusBadge(post.status)}</td>
                  <td
                    data-label="Channel"
                    style={{
                      fontSize: '0.85rem',
                      textTransform: 'capitalize',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {post.channel}
                  </td>
                  <td data-label="Tweet Preview">
                    <div
                      style={{
                        fontSize: '0.85rem',
                        whiteSpace: 'pre-wrap',
                        maxWidth: '480px',
                      }}
                    >
                      {post.tweetText}
                    </div>
                  </td>
                  <td
                    data-label="Source"
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {post.source || 'system'}
                  </td>
                  <td
                    data-label="Queued Date"
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {new Date(post.createdAt).toLocaleString()}
                  </td>
                  <td data-label="Actions">
                    {post.status === 'queued' ? (
                      <button
                        onClick={() => handleMarkSent(post.id)}
                        disabled={pendingId === post.id}
                        className="admin-btn"
                        title="Mark this post as sent so it drops out of the outbound RSS feed."
                        style={{
                          background: 'rgba(128, 128, 128, 0.08)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          padding: '0.3rem 0.6rem',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <Send className="w-3.5 h-3.5" /> Mark sent
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
