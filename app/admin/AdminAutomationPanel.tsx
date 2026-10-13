'use client';

import { Bot, ChevronDown, ChevronRight, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from '../../components/ui/Toast';

type Mode = 'off' | 'shadow' | 'live';
type Decision = 'approve' | 'reject' | 'hold';

type GateView = {
  gate: 'submission' | 'ingest_promote';
  label: string;
  detail: string;
  mode: Mode;
  bar: { confidence: number; mcpProbability: number; stars: number };
  stats: {
    total: number;
    approve: number;
    reject: number;
    hold: number;
    compared: number;
    agreed: number;
    holdsDecided: number;
    acted: number;
    undone: number;
  };
  recent: {
    id: number;
    serverId: string;
    name: string | null;
    currentStatus: string;
    decision: Decision;
    reason: string;
    mode: 'shadow' | 'live';
    actedAt: string | null;
    humanDecision: 'approve' | 'reject' | null;
    undoneAt: string | null;
    createdAt: string;
  }[];
};

/** Agreement needed before the panel suggests going live, and the sample it needs. */
const SUGGEST_LIVE_AGREEMENT = 0.95;
const SUGGEST_LIVE_MIN_COMPARED = 30;

const DECISION_COLOR: Record<Decision, string> = {
  approve: 'var(--admin-ok)',
  reject: 'var(--admin-bad)',
  hold: 'var(--text-secondary)',
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Modes, track record and recent decisions for the automation gates
 * (lib/autoDecision.ts). A gate earns 'live' here: the agreement rate is
 * between what it decided and what the admin later did on the same listing.
 */
export function AdminAutomationPanel() {
  const [gates, setGates] = useState<GateView[] | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/automation');
      const json = (await res.json()) as { gates?: GateView[]; error?: string };
      if (!res.ok || !json.gates) throw new Error(json.error || 'Failed');
      setGates(json.gates);
    } catch (e: any) {
      toast.error(`Automation: ${e.message}`);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: object, ok: string) => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(json.error || 'Failed');
      toast.success(json.message || ok);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const setMode = (g: GateView, mode: Mode) => {
    if (mode === g.mode) return;
    if (mode === 'live') {
      const { compared, agreed } = g.stats;
      const record =
        compared > 0
          ? `It agreed with you on ${agreed}/${compared} (${pct(agreed / compared)}).`
          : 'It has no track record yet.';
      if (
        !window.confirm(
          `Turn "${g.label}" live? It will approve${g.gate === 'submission' ? ' and reject' : ''} listings on its own, with the same emails as your clicks. ${record}`,
        )
      )
        return;
    }
    void post({ action: 'set_mode', gate: g.gate, mode }, `Mode: ${mode}`);
  };

  if (!gates) return null;

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        marginBottom: '1.5rem',
      }}
    >
      <div>
        <h2
          className="admin-section-title"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Bot className="w-5 h-5" /> Automation
        </h2>
        <p className="admin-section-desc">
          Shadow records what a gate would do and compares it with what you did
          on the same listing. Turn a gate live once its agreement is high
          enough — live decisions send the same emails as your clicks, and
          approvals can be undone below.
        </p>
      </div>

      {gates.map((g) => {
        const { stats } = g;
        const agreement =
          stats.compared > 0 ? stats.agreed / stats.compared : null;
        const decided = stats.approve + stats.reject;
        const ready =
          agreement !== null &&
          stats.compared >= SUGGEST_LIVE_MIN_COMPARED &&
          agreement >= SUGGEST_LIVE_AGREEMENT;
        return (
          <div
            key={g.gate}
            style={{
              padding: '1rem',
              borderRadius: '12px',
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.75rem',
                justifyContent: 'space-between',
              }}
            >
              <strong style={{ color: 'var(--text-primary)' }}>
                {g.label}
              </strong>
              <div className="directory-segmented">
                {(['off', 'shadow', 'live'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={busy}
                    onClick={() => setMode(g, m)}
                    className={`directory-segmented-btn ${g.mode === m ? 'is-active' : ''}`}
                    aria-pressed={g.mode === m}
                  >
                    {m === 'off' ? 'Off' : m === 'shadow' ? 'Shadow' : 'Live'}
                  </button>
                ))}
              </div>
            </div>

            <p
              style={{
                margin: 0,
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              {g.detail} Bar: Jev ≥ {pct(g.bar.confidence)} confident, MCP ≥{' '}
              {pct(g.bar.mcpProbability)}, and a sandbox run, a published
              package or ≥ {g.bar.stars} stars.
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1.25rem',
                fontSize: '0.82rem',
              }}
            >
              <span>
                <strong
                  style={{
                    fontSize: '1.1rem',
                    color:
                      agreement === null
                        ? 'var(--text-secondary)'
                        : agreement >= SUGGEST_LIVE_AGREEMENT
                          ? 'var(--admin-ok)'
                          : 'var(--admin-warn)',
                  }}
                >
                  {agreement === null ? '—' : pct(agreement)}
                </strong>{' '}
                agreed with you ({stats.agreed}/{stats.compared})
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {decided} decided ({stats.approve} approve, {stats.reject}{' '}
                reject) · {stats.hold} left for you
                {stats.holdsDecided > 0
                  ? ` (${stats.holdsDecided} you've since decided)`
                  : ''}
              </span>
              {stats.acted > 0 && (
                <span style={{ color: 'var(--text-secondary)' }}>
                  {stats.acted} acted live · {stats.undone} undone
                </span>
              )}
            </div>

            {g.mode === 'shadow' && ready && (
              <div style={{ fontSize: '0.8rem', color: 'var(--admin-ok)' }}>
                Agreed on {pct(agreement as number)} of {stats.compared}{' '}
                decisions — ready to go live if you're comfortable.
              </div>
            )}
            {g.mode === 'shadow' &&
              !ready &&
              stats.compared < SUGGEST_LIVE_MIN_COMPARED && (
                <div
                  style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                >
                  {SUGGEST_LIVE_MIN_COMPARED - stats.compared} more of your
                  decisions on listings it approved or rejected before a
                  reliable read.
                </div>
              )}

            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [g.gate]: !o[g.gate] }))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                width: 'fit-content',
              }}
            >
              {open[g.gate] ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              Recent decisions ({g.recent.length})
            </button>

            {open[g.gate] && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                {g.recent.map((d) => {
                  const disagree =
                    d.humanDecision &&
                    d.decision !== 'hold' &&
                    d.humanDecision !== d.decision;
                  return (
                    <div
                      key={d.id}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'baseline',
                        gap: '0.5rem',
                        fontSize: '0.78rem',
                        padding: '0.4rem 0.5rem',
                        borderRadius: '8px',
                        background: disagree
                          ? 'var(--admin-chip-bg)'
                          : 'transparent',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          color: DECISION_COLOR[d.decision],
                          minWidth: '4rem',
                        }}
                      >
                        {d.decision}
                      </span>
                      <a
                        href={`/mcp/${d.serverId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: 'var(--text-primary)',
                          fontWeight: 600,
                        }}
                      >
                        {d.name ?? d.serverId}
                      </a>
                      <span style={{ color: 'var(--text-secondary)', flex: 1 }}>
                        {d.reason}
                      </span>
                      {d.humanDecision && (
                        <span
                          style={{
                            color: disagree
                              ? 'var(--admin-warn)'
                              : 'var(--text-secondary)',
                          }}
                        >
                          you: {d.humanDecision}
                        </span>
                      )}
                      {d.mode === 'live' && d.actedAt && !d.undoneAt && (
                        <>
                          <span style={{ color: 'var(--accent-color)' }}>
                            acted
                          </span>
                          {d.decision === 'approve' && (
                            <button
                              type="button"
                              className="admin-tab-btn"
                              disabled={busy}
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.2rem 0.5rem',
                              }}
                              onClick={() =>
                                void post(
                                  {
                                    action: 'undo',
                                    gate: g.gate,
                                    serverId: d.serverId,
                                  },
                                  'Undone',
                                )
                              }
                            >
                              <Undo2 className="w-3 h-3" /> Undo
                            </button>
                          )}
                        </>
                      )}
                      {d.undoneAt && (
                        <span style={{ color: 'var(--admin-warn)' }}>
                          undone
                        </span>
                      )}
                    </div>
                  );
                })}
                {g.recent.length === 0 && (
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Nothing yet — the sweep decides as listings get triaged and
                    their repo checked.
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
