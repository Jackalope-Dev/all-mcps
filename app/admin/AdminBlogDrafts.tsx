'use client';

import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  Send,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { SafeMarkdown } from '@/components/ui/SafeMarkdown';
import { toast } from '@/components/ui/Toast';

type Draft = {
  id: string;
  status: 'ready' | 'needs_human';
  slug: string;
  title: string;
  excerpt: string;
  primaryKeyword: string;
  tags: string[];
  faq: { q: string; a: string }[];
  content: string;
  iterations: number;
  review: {
    review?: { scores?: Record<string, number>; suggestions?: string[] };
    issues?: string[];
    similarity?: {
      maxCosine?: number;
      maxCosineUrl?: string;
      shingle?: number;
    };
  } | null;
  backlinkSuggestions: { url: string; title: string; anchor: string }[];
};

type ListResponse = {
  drafts: Draft[];
  inFlight: number;
  publishConfigured: boolean;
  error?: string;
};

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

/**
 * Review queue for the blog pipeline. Publishing commits the post to main,
 * which the Workers Build deploys — see app/api/admin/blog-drafts/route.ts.
 */
export function AdminBlogDrafts({
  onCountChange,
}: {
  onCountChange?: (readyCount: number) => void;
}) {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/blog-drafts', { cache: 'no-store' });
      const json = (await res.json()) as ListResponse;
      if (!res.ok) throw new Error(json.error || 'Failed to load drafts');
      setData(json);
      onCountChange?.(json.drafts.filter((d) => d.status === 'ready').length);
    } catch (err: any) {
      toast.error('Could not load blog drafts', { description: err?.message });
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (draft: Draft, action: 'publish' | 'reject' | 'retry') => {
    if (
      action === 'publish' &&
      !window.confirm(
        `Publish "${draft.title}"?\n\nThis commits the post to main and triggers a deploy. It goes live in a few minutes.`,
      )
    ) {
      return;
    }
    if (
      action === 'reject' &&
      !window.confirm(`Reject "${draft.title}"? This discards the draft.`)
    ) {
      return;
    }
    setBusyId(draft.id);
    try {
      const res = await fetch('/api/admin/blog-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draft.id, action }),
      });
      const json = (await res.json()) as {
        error?: string;
        commitUrl?: string | null;
        url?: string;
      };
      if (!res.ok) throw new Error(json.error || 'Action failed');
      setData((prev) => {
        if (!prev) return prev;
        const drafts = prev.drafts.filter((d) => d.id !== draft.id);
        onCountChange?.(drafts.filter((d) => d.status === 'ready').length);
        return {
          ...prev,
          drafts,
          inFlight: action === 'retry' ? prev.inFlight + 1 : prev.inFlight,
        };
      });
      if (action === 'publish') {
        toast.success('Published — deploying now', {
          description: `Live at ${json.url} once the Cloudflare build finishes (a few minutes).`,
        });
      } else {
        toast.success(
          action === 'reject' ? 'Draft rejected' : 'Sent back for review',
        );
      }
    } catch (err: any) {
      toast.error('Action failed', { description: err?.message });
    } finally {
      setBusyId(null);
    }
  };

  const drafts = data?.drafts ?? [];
  const ready = drafts.filter((d) => d.status === 'ready');
  const needsHuman = drafts.filter((d) => d.status === 'needs_human');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <p className="admin-section-desc" style={{ margin: 0 }}>
          {loading && !data
            ? 'Loading drafts…'
            : `${ready.length} ready · ${needsHuman.length} need a human · ${data?.inFlight ?? 0} still in the review loop`}
        </p>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {data && !data.publishConfigured && (
        <div
          className="surface"
          style={{
            padding: '0.9rem 1rem',
            borderLeft: '3px solid #d97706',
            fontSize: '0.85rem',
          }}
        >
          <strong>Publishing isn&apos;t configured yet.</strong> Add a{' '}
          <code>BLOG_PUBLISH_TOKEN</code> Worker secret: a fine-grained GitHub
          token for the repo with <em>Contents: read &amp; write</em>. Reject
          and retry still work without it.
        </div>
      )}

      {data && drafts.length === 0 && (
        <div
          className="surface"
          style={{ padding: '2rem', textAlign: 'center' }}
        >
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            No drafts waiting. The pipeline cron writes new ones on its own.
          </p>
        </div>
      )}

      {[...ready, ...needsHuman].map((d) => {
        const isOpen = openId === d.id;
        const scores = d.review?.review?.scores;
        const sim = d.review?.similarity;
        const issues = d.review?.issues ?? [];
        const busy = busyId === d.id;
        return (
          <article key={d.id} className="admin-card" style={{ padding: 0 }}>
            <div style={{ padding: '1rem 1.1rem' }}>
              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'center',
                  marginBottom: '0.35rem',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  className="admin-tab-badge"
                  style={{
                    background: d.status === 'ready' ? '#10b981' : '#d97706',
                  }}
                >
                  {d.status === 'ready' ? 'Ready' : 'Needs human'}
                </span>
                <code style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                  /blog/{d.slug}
                </code>
              </div>
              <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem' }}>
                {d.title}
              </h3>
              <p
                style={{
                  margin: '0 0 0.6rem',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                }}
              >
                {d.excerpt}
              </p>
              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.25rem 1rem',
                }}
              >
                <span>Keyword: {d.primaryKeyword}</span>
                <span>{wordCount(d.content).toLocaleString()} words</span>
                <span>Review passes: {d.iterations}</span>
                {scores && (
                  <span>
                    Scores:{' '}
                    {Object.entries(scores)
                      .map(([k, v]) => `${k} ${v}`)
                      .join(' · ')}
                  </span>
                )}
                {sim?.maxCosineUrl && (
                  <span>
                    Closest existing: {sim.maxCosineUrl} (
                    {Number(sim.maxCosine).toFixed(2)})
                  </span>
                )}
                <span>Tags: {d.tags.join(', ')}</span>
              </div>

              {d.status === 'needs_human' && issues.length > 0 && (
                <ul
                  style={{
                    margin: '0.75rem 0 0',
                    paddingLeft: '1.1rem',
                    fontSize: '0.82rem',
                    color: '#d97706',
                  }}
                >
                  {issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}

              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  marginTop: '0.9rem',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setOpenId(isOpen ? null : d.id)}
                >
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  {isOpen ? 'Hide post' : 'Read post'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={busy || !data?.publishConfigured}
                  onClick={() => act(d, 'publish')}
                >
                  <Send className="w-4 h-4" />
                  {busy ? 'Working…' : 'Approve & publish'}
                </button>
                {d.status === 'needs_human' && (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    disabled={busy}
                    onClick={() => act(d, 'retry')}
                  >
                    <Undo2 className="w-4 h-4" /> Send back for review
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={busy}
                  onClick={() => act(d, 'reject')}
                >
                  <Trash2 className="w-4 h-4" /> Reject
                </button>
              </div>
            </div>

            {isOpen && (
              <div
                style={{
                  borderTop: '1px solid var(--border-color)',
                  padding: '1rem 1.1rem',
                  maxHeight: '70vh',
                  overflowY: 'auto',
                }}
              >
                <div className="markdown-body">
                  <SafeMarkdown content={d.content} />
                </div>
                {d.faq.length > 0 && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>FAQ</h4>
                    {d.faq.map((f) => (
                      <div key={f.q} style={{ marginBottom: '0.75rem' }}>
                        <strong style={{ fontSize: '0.9rem' }}>{f.q}</strong>
                        <p
                          style={{
                            margin: '0.25rem 0 0',
                            fontSize: '0.875rem',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {f.a}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {d.backlinkSuggestions.length > 0 && (
                  <div
                    className="surface"
                    style={{
                      marginTop: '1.5rem',
                      padding: '0.75rem 1rem',
                      fontSize: '0.82rem',
                    }}
                  >
                    <strong>After publishing,</strong> link to this post from:
                    <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
                      {d.backlinkSuggestions.map((b) => (
                        <li key={b.url}>
                          <a href={b.url} target="_blank" rel="noreferrer">
                            {b.title} <ExternalLink className="w-3 h-3" />
                          </a>{' '}
                          — anchor e.g. &ldquo;{b.anchor}&rdquo;
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
