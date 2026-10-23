'use client';

import {
  Check,
  ExternalLink,
  Inbox,
  RefreshCw,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '../../components/ui/Toast';
import { notifyAdminStatsChanged } from '../../lib/adminStatsRefresh';
import type { RepoStatus } from '../../lib/repoCheck';
import { STALE_REASON_LABEL, type StaleReason } from '../../lib/staleness';
import { TRUST_TIER_COPY, type TrustTier } from '../../lib/trustTier';
import { AdminEmpty, AdminSectionHead, AdminSkeletonList } from './AdminUi';

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
  repoStatus: RepoStatus | null;
  repoGoneCount: number | null;
  repoCheckedAt: string | null;
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
  /** The automation gate's call on a pending listing (Jev plus hard evidence). */
  recommendation: {
    decision: 'approve' | 'reject' | 'hold';
    reasons: string[];
  } | null;
};

type TriageResponse = {
  items: TriageItem[];
  counts: Record<string, number>;
  pageSize: number;
};

const VERDICT_STYLE: Record<Verdict, { label: string; hue: string }> = {
  approve: { label: 'Jev: approve', hue: 'hue-green' },
  needs_review: { label: 'Jev: look closer', hue: 'hue-amber' },
  reject: { label: 'Jev: reject', hue: 'hue-red' },
};

const RECOMMENDATION_STYLE = {
  approve: { label: 'Recommend: approve', hue: 'hue-green' },
  reject: { label: 'Recommend: reject', hue: 'hue-red' },
  hold: { label: 'Your call', hue: 'hue-amber' },
} as const;

/**
 * What a row's bulk action keys on: the gate's recommendation on the pending
 * queue (it already folds in Jev), Jev's verdict on the flagged-live queue.
 */
function bulkVerdict(item: TriageItem): 'approve' | 'reject' | null {
  if (item.recommendation) {
    const d = item.recommendation.decision;
    return d === 'hold' ? null : d;
  }
  return item.triageVerdict === 'approve' || item.triageVerdict === 'reject'
    ? item.triageVerdict
    : null;
}

const TIER_HUE: Record<TrustTier, string> = {
  verified: 'hue-green',
  runs_needs_keys: 'hue-cyan',
  installable: '',
  unverified: 'hue-amber',
};

function fmtDate(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 10);
}

/** Evidence pill; `hue` is a status/identity hue-* class (neutral when omitted). */
function Chip({
  children,
  hue = '',
}: {
  children: React.ReactNode;
  hue?: string;
}) {
  return <span className={`adm-tag ${hue}`}>{children}</span>;
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
          repoStatus?: TriageItem['repoStatus'];
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
                        repoStatus:
                          json.repoStatus && json.repoStatus !== 'unknown'
                            ? json.repoStatus
                            : i.repoStatus,
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

  /** Accept the confident calls for everything on this page. */
  const bulkAccept = async (which: 'approve' | 'reject') => {
    const targets = items.filter((i) => bulkVerdict(i) === which);
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
      !window.confirm(`${verb} ${targets.length} listing(s) marked "${which}"?`)
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
  const pageApprove = items.filter((i) => bulkVerdict(i) === 'approve').length;
  const pageReject = items.filter((i) => bulkVerdict(i) === 'reject').length;
  const bulkSource = queue === 'pending' ? 'recommended' : 'Jev-';
  const acceptLabel = queue === 'pending' ? 'Approve' : 'Keep';
  const rejectLabel = queue === 'pending' ? 'Reject' : 'Unpublish';

  return (
    <section className="adm-section">
      <AdminSectionHead
        title="Triage queue"
        description={
          <>
            Jev recommends; you decide. Keys: <kbd className="kbd">j</kbd>/
            <kbd className="kbd">k</kbd> move · <kbd className="kbd">a</kbd>{' '}
            {acceptLabel.toLowerCase()} · <kbd className="kbd">r</kbd>{' '}
            {rejectLabel.toLowerCase()} · <kbd className="kbd">t</kbd> ask Jev
            again · <kbd className="kbd">o</kbd> open repo ·{' '}
            <kbd className="kbd">e</kbd> sandbox log
          </>
        }
        actions={
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw
              size={14}
              aria-hidden="true"
              className={loading ? 'acct-spin' : undefined}
            />{' '}
            Refresh
          </button>
        }
      />

      <div className="adm-card adm-toolbar">
        <div className="adm-toolbar-row">
          <fieldset className="fieldset-plain segmented">
            <legend className="sr-only">Queue</legend>
            {(['pending', 'stale'] as const).map((q) => (
              <button
                key={q}
                type="button"
                className={queue === q ? 'is-active' : undefined}
                aria-pressed={queue === q}
                onClick={() => setQueue(q)}
              >
                {q === 'pending' ? 'Pending approval' : 'Flagged stale'}
              </button>
            ))}
          </fieldset>
        </div>

        <div className="adm-chip-row scroll-x fade-x">
          {(
            [
              ['all', 'All', total],
              ['approve', 'Jev approve', counts.approve ?? 0],
              ['reject', 'Jev reject', counts.reject ?? 0],
              ['needs_review', 'Look closer', counts.needs_review ?? 0],
              ['none', 'Not triaged yet', counts.none ?? 0],
            ] as const
          ).map(([v, label, n]) => (
            <button
              key={v}
              type="button"
              className="chip"
              aria-pressed={verdict === v}
              onClick={() => setVerdict(v)}
            >
              {label}
              <span className="chip-count">{n}</span>
            </button>
          ))}
        </div>

        <div className="adm-toolbar-row adm-bulk">
          <span className="adm-toolbar-label">On this page</span>
          <div className="adm-actions">
            <button
              type="button"
              className="btn btn-sm adm-btn-tint hue-green"
              disabled={pageApprove === 0}
              onClick={() => void bulkAccept('approve')}
            >
              <Check size={14} aria-hidden="true" /> {acceptLabel} all{' '}
              {bulkSource === 'recommended' ? 'recommended' : 'Jev-approved'} (
              {pageApprove})
            </button>
            <button
              type="button"
              className="btn btn-sm adm-btn-tint hue-red"
              disabled={pageReject === 0}
              onClick={() => void bulkAccept('reject')}
            >
              <X size={14} aria-hidden="true" /> {rejectLabel} all{' '}
              {bulkSource === 'recommended' ? 'recommended' : 'Jev-rejected'} (
              {pageReject})
            </button>
          </div>
        </div>
      </div>

      {loading && items.length === 0 && <AdminSkeletonList rows={3} />}
      {!loading && items.length === 0 && (
        <AdminEmpty icon={Inbox} title="Queue clear" boxed>
          Nothing here right now.
        </AdminEmpty>
      )}

      <div className="adm-triage-list">
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
              className={`adm-triage${focused ? ' is-focused' : ''}${isBusy ? ' is-busy' : ''}`}
            >
              <div className="adm-name">
                <strong>{item.name}</strong>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="adm-repo-link"
                >
                  {item.url.replace(/^https?:\/\//, '')}
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
                {item.reviewPriority && <Chip hue="hue-amber">Priority</Chip>}
                {item.submitterEmail ? (
                  <Chip>Submitted</Chip>
                ) : (
                  <Chip>Ingested</Chip>
                )}
              </div>

              {item.recommendation && (
                <div className="adm-verdict">
                  <Chip
                    hue={RECOMMENDATION_STYLE[item.recommendation.decision].hue}
                  >
                    {RECOMMENDATION_STYLE[item.recommendation.decision].label}
                  </Chip>
                  <span className="adm-muted">
                    {item.recommendation.reasons.join(' · ')}
                  </span>
                </div>
              )}

              {v ? (
                <div className="adm-verdict">
                  <Chip hue={v.hue}>
                    <Sparkles size={12} aria-hidden="true" />
                    {v.label}
                  </Chip>
                  <span className="adm-muted">{item.triageReason}</span>
                </div>
              ) : (
                <span className="adm-note">
                  Not triaged yet — press <kbd className="kbd">t</kbd> to ask
                  Jev now.
                </span>
              )}

              <p className="adm-triage-desc">
                {(item.aiSummary || item.description).slice(0, 280)}
              </p>

              <div className="adm-tags">
                <Chip hue={TIER_HUE[item.trustTier]}>
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
                  <Chip hue="hue-amber">fork of {item.repoForkOf}</Chip>
                )}
                {item.repoStatus === 'gone' && (
                  <Chip hue="hue-red">
                    source 404
                    {(item.repoGoneCount ?? 0) >= 2
                      ? ' · confirmed'
                      : ' · rechecking'}
                  </Chip>
                )}
                {item.repoStatus === 'ok' && (
                  <Chip hue="hue-green">
                    source live · {fmtDate(item.repoCheckedAt)}
                  </Chip>
                )}
                {item.repoStatus === 'site_only' && (
                  <Chip hue="hue-amber">
                    repo 404 · website live (private repo?)
                  </Chip>
                )}
                {item.repoStatus === 'archived' && (
                  <Chip hue="hue-amber">repo archived</Chip>
                )}
                {item.healthStatus === 'archived' && (
                  <Chip hue="hue-red">archived</Chip>
                )}
                {item.packageDeprecated && (
                  <Chip hue="hue-red">
                    deprecated: {item.packageDeprecated.slice(0, 60)}
                  </Chip>
                )}
                {item.staleReasons.map((r) => (
                  <Chip key={r} hue="hue-amber">
                    {STALE_REASON_LABEL[r] ?? r}
                  </Chip>
                ))}
                {item.sandboxStatus && item.sandboxStatus !== 'pending' && (
                  <Chip
                    hue={
                      item.sandboxStatus === 'ok'
                        ? 'hue-green'
                        : item.sandboxStatus === 'needs_credentials'
                          ? 'hue-cyan'
                          : 'hue-amber'
                    }
                  >
                    <Terminal size={12} aria-hidden="true" />
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
                  <pre className="adm-pre">
                    {item.sandboxError ? `${item.sandboxError}\n\n` : ''}
                    {item.sandboxStderr}
                  </pre>
                )}

              <div className="adm-actions">
                <button
                  type="button"
                  className="btn btn-sm adm-btn-tint hue-green"
                  disabled={isBusy}
                  onClick={() => void decide(item, true)}
                >
                  <Check size={14} aria-hidden="true" /> {acceptLabel}
                </button>
                <button
                  type="button"
                  className="btn btn-sm adm-btn-tint hue-red"
                  disabled={isBusy}
                  onClick={() => void decide(item, false)}
                >
                  <X size={14} aria-hidden="true" /> {rejectLabel}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={isBusy}
                  onClick={() => void retriage(item)}
                >
                  <Sparkles size={14} aria-hidden="true" /> Ask Jev
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
