'use client';

import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Link2,
  RefreshCw,
  Send,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { SafeMarkdown } from '@/components/ui/SafeMarkdown';
import { toast } from '@/components/ui/Toast';
import { hueClass } from '@/lib/palette';
import { AdminEmpty, AdminSkeletonList } from './AdminUi';

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
    <div className="adm-stack">
      <div className="adm-toolbar-line">
        <p className="adm-sub" aria-live="polite">
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
          <RefreshCw
            size={14}
            aria-hidden="true"
            className={loading ? 'acct-spin' : undefined}
          />{' '}
          Refresh
        </button>
      </div>

      {data && !data.publishConfigured && (
        <div className="acct-callout acct-callout--warn">
          <AlertTriangle size={16} aria-hidden="true" />
          <div>
            <strong>Publishing isn&apos;t configured yet.</strong> Add a{' '}
            <code>BLOG_PUBLISH_TOKEN</code> Worker secret: a fine-grained GitHub
            token for the repo with <em>Contents: read &amp; write</em>. Reject
            and retry still work without it.
          </div>
        </div>
      )}

      {loading && !data && <AdminSkeletonList rows={2} />}

      {data && drafts.length === 0 && (
        <AdminEmpty icon={FileText} title="No drafts waiting" boxed>
          The pipeline cron writes new ones on its own.
        </AdminEmpty>
      )}

      {[...ready, ...needsHuman].map((d) => {
        const isOpen = openId === d.id;
        const scores = d.review?.review?.scores;
        const sim = d.review?.similarity;
        const issues = d.review?.issues ?? [];
        const busy = busyId === d.id;
        return (
          <article
            key={d.id}
            className={`adm-card adm-draft${busy ? ' is-busy' : ''}`}
          >
            <div className="adm-draft-main">
              <div className="adm-draft-top">
                <span
                  className={`adm-tag is-dot ${d.status === 'ready' ? 'hue-green' : 'hue-amber'}`}
                >
                  {d.status === 'ready' ? 'Ready' : 'Needs human'}
                </span>
                <code className="adm-draft-slug">/blog/{d.slug}</code>
              </div>
              <h3 className="adm-draft-title">{d.title}</h3>
              <p className="adm-draft-excerpt">{d.excerpt}</p>
              <div className="adm-meta">
                <span>
                  Keyword <strong>{d.primaryKeyword}</strong>
                </span>
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
              </div>
              {d.tags.length > 0 && (
                <div className="adm-tags">
                  {d.tags.map((tag) => (
                    <span key={tag} className={`adm-tag ${hueClass(tag)}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {d.status === 'needs_human' && issues.length > 0 && (
                <ul className="adm-issues">
                  {issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}

              <div className="adm-actions adm-draft-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  aria-expanded={isOpen}
                  onClick={() => setOpenId(isOpen ? null : d.id)}
                >
                  {isOpen ? (
                    <ChevronUp size={14} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={14} aria-hidden="true" />
                  )}
                  {isOpen ? 'Hide post' : 'Read post'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={busy || !data?.publishConfigured}
                  onClick={() => act(d, 'publish')}
                >
                  <Send size={14} aria-hidden="true" />
                  {busy ? 'Working…' : 'Approve & publish'}
                </button>
                {d.status === 'needs_human' && (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    disabled={busy}
                    onClick={() => act(d, 'retry')}
                  >
                    <Undo2 size={14} aria-hidden="true" /> Send back for review
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-sm adm-btn-tint hue-red"
                  disabled={busy}
                  onClick={() => act(d, 'reject')}
                >
                  <Trash2 size={14} aria-hidden="true" /> Reject
                </button>
              </div>
            </div>

            {isOpen && (
              <div className="adm-draft-body">
                <div className="markdown-body">
                  <SafeMarkdown content={d.content} />
                </div>
                {d.faq.length > 0 && (
                  <div className="adm-faq">
                    <h4>FAQ</h4>
                    {d.faq.map((f) => (
                      <div key={f.q} className="adm-faq-item">
                        <strong>{f.q}</strong>
                        <p>{f.a}</p>
                      </div>
                    ))}
                  </div>
                )}
                {d.backlinkSuggestions.length > 0 && (
                  <div className="acct-callout acct-callout--info adm-backlinks">
                    <Link2 size={16} aria-hidden="true" />
                    <div>
                      <strong>After publishing,</strong> link to this post from:
                      <ul>
                        {d.backlinkSuggestions.map((b) => (
                          <li key={b.url}>
                            <a href={b.url} target="_blank" rel="noreferrer">
                              {b.title}{' '}
                              <ExternalLink size={12} aria-hidden="true" />
                            </a>{' '}
                            — anchor e.g. &ldquo;{b.anchor}&rdquo;
                          </li>
                        ))}
                      </ul>
                    </div>
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
