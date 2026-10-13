'use client';

import {
  Check,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '../../components/ui/Toast';
import { notifyAdminStatsChanged } from '../../lib/adminStatsRefresh';
import { STALE_REASON_LABEL, type StaleReason } from '../../lib/staleness';
import { TRUST_TIER_COPY, type TrustTier } from '../../lib/trustTier';

type Queue = 'pending' | 'stale';
type VerdictFilter = 'all' | 'approve' | 'needs_review' | 'reject' | 'none';
type Verdict = 'approve' | 'needs_review' | 'reject';

type TriageItem = {
  id: string;
  name: string;
  url: string;
  websiteUrl: string | null;
  description: string;
  aiSummary: string | null;
  category: string;
  status: string;
  createdAt: string;
  submitterEmail: string | null;
  reviewPriority: boolean;
  githubStars: number | null;
  npmDownloads: number | null;
  lastCommitAt: string | null;
  repoForkOf: string | null;
  healthStatus: string;
  mcpProbability: number | null;
  listingQuality: number | null;
  triageVerdict: Verdict | null;
  triageReason: string | null;
  staleFlaggedAt: string | null;
  staleReasons: StaleReason[];
  packageDeprecated: string | null;
  installCommand: string | null;
  installPackage: string | null;
  sandboxStatus: string | null;
  sandboxError: string | null;
  sandboxStderr: string | null;
  sandboxToolCount: number | null;
  trustTier: TrustTier;
};

type TriageResponse = {
  items: TriageItem[];
  counts: Record<string, number>;
  pageSize: number;
};

const VERDICT_STYLE: Record<Verdict, { label: string; color: string }> = {
  approve: { label: 'Jev: approve', color: 'var(--admin-ok)' },
  needs_review: { label: 'Jev: look closer', color: 'var(--admin-warn)' },
  reject: { label: 'Jev: reject', color: 'var(--admin-bad)' },
};

const TIER_COLOR: Record<TrustTier, string> = {
  verified: 'var(--admin-ok)',
  runs_needs_keys: 'var(--accent-color)',
  installable: 'var(--text-secondary)',
  unverified: 'var(--admin-warn)',
};

function fmtDate(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 10);
}

function Chip({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.15rem 0.5rem',
        borderRadius: '999px',
        fontSize: '0.72rem',
        fontWeight: 600,
        background: 'var(--admin-chip-bg)',
        color: color ?? 'var(--text-secondary)',
        border: `1px solid ${color ?? 'var(--border-color)'}`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

/**
 * Keyboard-first triage over /api/admin/triage. Jev's recommendation and the
 * evidence behind it sit on each row; the curator confirms or overrides.
 */
export function AdminTriageQueue() {
  const [queue, setQueue] = useState<Queue>('pending');
  const [verdict, setVerdict] = useState<VerdictFilter>('all');
  const [data, setData] = useState<TriageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState(0);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [showStderr, setShowStderr] = useState<Set<string>>(new Set());
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/triage?queue=${queue}&verdict=${verdict}`,
      );
      const json = (await res.json()) as TriageResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Failed to load queue');
      setData(json);
      setFocus(0);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [queue, verdict]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = data?.items ?? [];

  const dropItem = useCallback((id: string) => {
    setData((d) =>
      d ? { ...d, items: d.items.filter((i) => i.id !== id) } : d,
    );
  }, []);

  const markBusy = useCallback(
    (id: string, on: boolean) =>
      setBusy((s) => {
        const next = new Set(s);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      }),
    [],
  );

  /** Decide one listing. `accept` = approve (pending) / keep (stale). */
  const decide = useCallback(
    async (item: TriageItem, accept: boolean, quiet = false) => {
      markBusy(item.id, true);
      try {
        let res: Response;
        if (queue === 'stale' && accept) {
          res = await fetch('/api/admin/triage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: item.id, action: 'keep' }),
          });
        } else {
          const action =
            queue === 'pending' ? (accept ? 'approve' : 'reject') : 'unpublish';
          res = await fetch('/api/admin/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: item.id, action }),
          });
        }
        const json = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(json.error || 'Action failed');
        dropItem(item.id);
        if (!quiet)
          toast.success(
            `${item.name}: ${accept ? (queue === 'pending' ? 'approved' : 'kept') : queue === 'pending' ? 'rejected' : 'unpublished'}`,
          );
        notifyAdminStatsChanged();
        return true;
      } catch (e: any) {
        toast.error(`${item.name}: ${e.message}`);
        return false;
      } finally {
        markBusy(item.id, false);
      }
    },
    [queue, dropItem, markBusy],
  );

  const retriage = useCallback(
    async (item: TriageItem) => {
      markBusy(item.id, true);
      try {
        const res = await fetch('/api/admin/triage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, action: 'retriage' }),
        });
        const json = (await res.json()) as {
          error?: string;
          verdict?: Verdict;
          reason?: string;
          mcpProbability?: number | null;
        };
        if (!res.ok) throw new Error(json.error || 'Jev failed');
        setData((d) =>
          d
            ? {
                ...d,
                items: d.items.map((i) =>
                  i.id === item.id
                    ? {
                        ...i,
                        triageVerdict: json.verdict ?? null,
                        triageReason: json.reason ?? null,
                        mcpProbability: json.mcpProbability ?? i.mcpProbability,
                      }
                    : i,
                ),
              }
            : d,
        );
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        markBusy(item.id, false);
      }
    },
    [markBusy],
  );

  /** Accept Jev's confident verdicts for everything on this page. */
  const bulkAccept = async (which: 'approve' | 'reject') => {
    const targets = items.filter((i) => i.triageVerdict === which);
    if (targets.length === 0) return;
    const verb =
      queue === 'pending'
        ? which === 'approve'
          ? 'Approve'
          : 'Reject (deletes the pending row)'
        : which === 'approve'
          ? 'Keep'
          : 'Unpublish';
    if (
      !window.confirm(
        `${verb} ${targets.length} listing(s) Jev marked "${which}"?`,
      )
    )
      return;
    let ok = 0;
    // Sequential: each action may send an email and revalidate pages.
    for (const t of targets) {
      if (await decide(t, which === 'approve', true)) ok++;
    }
    toast.success(`${verb}: ${ok}/${targets.length} done`);
  };

  // Keyboard: j/k move, a accept, r reject/unpublish, t re-ask Jev, o open, e stderr.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const item = items[focus];
      switch (e.key) {
        case 'j':
          setFocus((f) => Math.min(items.length - 1, f + 1));
          break;
        case 'k':
          setFocus((f) => Math.max(0, f - 1));
          break;
        case 'a':
          if (item && !busy.has(item.id)) void decide(item, true);
          break;
        case 'r':
          if (item && !busy.has(item.id)) void decide(item, false);
          break;
        case 't':
          if (item && !busy.has(item.id)) void retriage(item);
          break;
        case 'o':
          if (item) window.open(item.url, '_blank', 'noopener');
          break;
        case 'e':
          if (item)
            setShowStderr((s) => {
              const n = new Set(s);
              if (n.has(item.id)) n.delete(item.id);
              else n.add(item.id);
              return n;
            });
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, focus, busy, decide, retriage]);

  useEffect(() => {
    if (focus >= items.length && items.length > 0) setFocus(items.length - 1);
    const id = items[focus]?.id;
    if (id) rowRefs.current[id]?.scrollIntoView({ block: 'nearest' });
  }, [focus, items]);

  const counts = data?.counts ?? {};
  const total = useMemo(
    () => Object.values(counts).reduce((a, b) => a + b, 0),
    [counts],
  );
  const pageApprove = items.filter((i) => i.triageVerdict === 'approve').length;
  const pageReject = items.filter((i) => i.triageVerdict === 'reject').length;
  const acceptLabel = queue === 'pending' ? 'Approve' : 'Keep';
  const rejectLabel = queue === 'pending' ? 'Reject' : 'Unpublish';

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <h2 className="admin-section-title">Triage queue</h2>
        <p className="admin-section-desc">
          Jev recommends; you decide. Keys: <kbd>j</kbd>/<kbd>k</kbd> move ·{' '}
          <kbd>a</kbd> {acceptLabel.toLowerCase()} · <kbd>r</kbd>{' '}
          {rejectLabel.toLowerCase()} · <kbd>t</kbd> ask Jev again ·{' '}
          <kbd>o</kbd> open repo · <kbd>e</kbd> sandbox log
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {(['pending', 'stale'] as const).map((q) => (
          <button
            key={q}
            type="button"
            className={`admin-tab-btn ${queue === q ? 'active' : ''}`}
            onClick={() => setQueue(q)}
          >
            {q === 'pending' ? 'Pending approval' : 'Flagged stale'}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="admin-tab-btn"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {(
          [
            ['all', `All (${total})`],
            ['approve', `Jev approve (${counts.approve ?? 0})`],
            ['reject', `Jev reject (${counts.reject ?? 0})`],
            ['needs_review', `Look closer (${counts.needs_review ?? 0})`],
            ['none', `Not triaged yet (${counts.none ?? 0})`],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            className={`admin-tab-btn ${verdict === v ? 'active' : ''}`}
            onClick={() => setVerdict(v)}
            style={{ fontSize: '0.8rem' }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button
          type="button"
          className="admin-tab-btn"
          disabled={pageApprove === 0}
          onClick={() => void bulkAccept('approve')}
        >
          <Check className="w-4 h-4" /> {acceptLabel} all Jev-approved on page (
          {pageApprove})
        </button>
        <button
          type="button"
          className="admin-tab-btn"
          disabled={pageReject === 0}
          onClick={() => void bulkAccept('reject')}
        >
          <X className="w-4 h-4" /> {rejectLabel} all Jev-rejected on page (
          {pageReject})
        </button>
      </div>

      {loading && items.length === 0 && (
        <p className="admin-section-desc">Loading…</p>
      )}
      {!loading && items.length === 0 && (
        <p className="admin-section-desc">Nothing here. Queue clear.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {items.map((item, idx) => {
          const focused = idx === focus;
          const v = item.triageVerdict
            ? VERDICT_STYLE[item.triageVerdict]
            : null;
          const isBusy = busy.has(item.id);
          return (
            <div
              key={item.id}
              ref={(el) => {
                rowRefs.current[item.id] = el;
              }}
              style={{
                padding: '0.9rem 1rem',
                borderRadius: '12px',
                background: 'var(--card-bg)',
                border: `1px solid ${focused ? 'var(--accent-color)' : 'var(--border-color)'}`,
                opacity: isBusy ? 0.5 : 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <strong style={{ color: 'var(--text-primary)' }}>
                  {item.name}
                </strong>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.78rem',
                    display: 'inline-flex',
                    gap: '0.2rem',
                    alignItems: 'center',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {item.url.replace(/^https?:\/\//, '')}
                  <ExternalLink className="w-3 h-3" />
                </a>
                {item.reviewPriority && (
                  <Chip color="var(--gold-color)">Priority</Chip>
                )}
                {item.submitterEmail ? (
                  <Chip>Submitted</Chip>
                ) : (
                  <Chip>Ingested</Chip>
                )}
              </div>

              {v ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <Chip color={v.color}>
                    <Sparkles className="w-3 h-3" />
                    {v.label}
                  </Chip>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {item.triageReason}
                  </span>
                </div>
              ) : (
                <span
                  style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                >
                  Not triaged yet — press <kbd>t</kbd> to ask Jev now.
                </span>
              )}

              <p
                style={{
                  margin: 0,
                  fontSize: '0.84rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                {(item.aiSummary || item.description).slice(0, 280)}
              </p>

              <div
                style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}
              >
                <Chip color={TIER_COLOR[item.trustTier]}>
                  {TRUST_TIER_COPY[item.trustTier].label}
                </Chip>
                {item.mcpProbability !== null && (
                  <Chip>MCP {Math.round(item.mcpProbability * 100)}%</Chip>
                )}
                <Chip>★ {item.githubStars ?? '—'}</Chip>
                {item.npmDownloads !== null && (
                  <Chip>npm {item.npmDownloads}/mo</Chip>
                )}
                <Chip>last commit {fmtDate(item.lastCommitAt)}</Chip>
                {item.repoForkOf && (
                  <Chip color="var(--admin-warn)">
                    fork of {item.repoForkOf}
                  </Chip>
                )}
                {item.healthStatus === 'archived' && (
                  <Chip color="var(--admin-bad)">archived</Chip>
                )}
                {item.packageDeprecated && (
                  <Chip color="var(--admin-bad)">
                    deprecated: {item.packageDeprecated.slice(0, 60)}
                  </Chip>
                )}
                {item.staleReasons.map((r) => (
                  <Chip key={r} color="var(--admin-warn)">
                    {STALE_REASON_LABEL[r] ?? r}
                  </Chip>
                ))}
                {item.sandboxStatus && item.sandboxStatus !== 'pending' && (
                  <Chip
                    color={
                      item.sandboxStatus === 'ok'
                        ? 'var(--admin-ok)'
                        : item.sandboxStatus === 'needs_credentials'
                          ? 'var(--accent-color)'
                          : 'var(--admin-warn)'
                    }
                  >
                    <Terminal className="w-3 h-3" />
                    sandbox {item.sandboxStatus.replace(/_/g, ' ')}
                    {item.sandboxToolCount
                      ? ` · ${item.sandboxToolCount} tools`
                      : ''}
                  </Chip>
                )}
                {item.installCommand && (
                  <Chip>
                    {item.installCommand} {item.installPackage}
                  </Chip>
                )}
              </div>

              {showStderr.has(item.id) &&
                (item.sandboxStderr || item.sandboxError) && (
                  <pre
                    style={{
                      margin: 0,
                      padding: '0.6rem',
                      borderRadius: '8px',
                      background: 'var(--bg-color)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.72rem',
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                      maxHeight: '12rem',
                      overflowY: 'auto',
                    }}
                  >
                    {item.sandboxError ? `${item.sandboxError}\n\n` : ''}
                    {item.sandboxStderr}
                  </pre>
                )}

              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="admin-tab-btn"
                  disabled={isBusy}
                  onClick={() => void decide(item, true)}
                >
                  <Check className="w-4 h-4" /> {acceptLabel}
                </button>
                <button
                  type="button"
                  className="admin-tab-btn"
                  disabled={isBusy}
                  onClick={() => void decide(item, false)}
                >
                  <X className="w-4 h-4" /> {rejectLabel}
                </button>
                <button
                  type="button"
                  className="admin-tab-btn"
                  disabled={isBusy}
                  onClick={() => void retriage(item)}
                >
                  <Sparkles className="w-4 h-4" /> Ask Jev
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
