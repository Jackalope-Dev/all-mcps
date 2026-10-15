'use client';

import { Bot, ChevronDown, ChevronRight, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from '../../components/ui/Toast';
import { AdminSectionHead } from './AdminUi';

type Mode = 'off' | 'shadow' | 'live';
type Decision = 'approve' | 'reject' | 'hold';

type GateView = {
  gate: 'submission' | 'ingest_promote' | 'dedupe_retire';
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

/** Status hue per decision: approve green, reject red, hold neutral. */
const DECISION_HUE: Record<Decision, string> = {
  approve: 'hue-green',
  reject: 'hue-red',
  hold: '',
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
          g.gate === 'dedupe_retire'
            ? `Turn "${g.label}" live? It will retire same-repo duplicates on its own (status removed, redirect to the keeper). ${record}`
            : `Turn "${g.label}" live? It will approve${g.gate === 'submission' ? ' and reject' : ''} listings on its own, with the same emails as your clicks. ${record}`,
        )
      )
        return;
    }
    void post({ action: 'set_mode', gate: g.gate, mode }, `Mode: ${mode}`);
  };

  if (!gates) return null;

  return (
    <section className="adm-section">
      <AdminSectionHead
        title={
          <>
            <Bot size={18} aria-hidden="true" /> Automation
          </>
        }
        description="Shadow records what a gate would do and compares it with what you did on the same listing. Turn a gate live once its agreement is high enough — live decisions send the same emails as your clicks, and approvals can be undone below."
      />

      <div className="adm-stack-sm">
        {gates.map((g) => {
          const { stats } = g;
          const agreement =
            stats.compared > 0 ? stats.agreed / stats.compared : null;
          const decided = stats.approve + stats.reject;
          const ready =
            agreement !== null &&
            stats.compared >= SUGGEST_LIVE_MIN_COMPARED &&
            agreement >= SUGGEST_LIVE_AGREEMENT;
          const scoreHue =
            agreement === null
              ? ''
              : agreement >= SUGGEST_LIVE_AGREEMENT
                ? 'hue-green'
                : 'hue-amber';
          return (
            <div key={g.gate} className="adm-card adm-gate">
              <div className="adm-gate-head">
                <div className="adm-gate-name">
                  <strong>{g.label}</strong>
                  <span
                    className={`adm-tag is-dot ${g.mode === 'live' ? 'hue-green' : g.mode === 'shadow' ? 'hue-blue' : ''}`}
                  >
                    {g.mode}
                  </span>
                </div>
                <fieldset className="fieldset-plain segmented">
                  <legend className="sr-only">Mode for {g.label}</legend>
                  {(['off', 'shadow', 'live'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={busy}
                      onClick={() => setMode(g, m)}
                      className={g.mode === m ? 'is-active' : undefined}
                      aria-pressed={g.mode === m}
                    >
                      {m === 'off' ? 'Off' : m === 'shadow' ? 'Shadow' : 'Live'}
                    </button>
                  ))}
                </fieldset>
              </div>

              <p className="adm-gate-detail">
                {g.detail} Bar: Jev ≥ {pct(g.bar.confidence)} confident, MCP ≥{' '}
                {pct(g.bar.mcpProbability)}, and a sandbox run, a published
                package or ≥ {g.bar.stars} stars.
              </p>

              <div className="adm-gate-stats">
                <span>
                  <strong className={`adm-gate-score ${scoreHue}`}>
                    {agreement === null ? '—' : pct(agreement)}
                  </strong>{' '}
                  agreed with you ({stats.agreed}/{stats.compared})
                </span>
                <span>
                  {decided} decided ({stats.approve} approve, {stats.reject}{' '}
                  reject) · {stats.hold} left for you
                  {stats.holdsDecided > 0
                    ? ` (${stats.holdsDecided} you've since decided)`
                    : ''}
                </span>
                {stats.acted > 0 && (
                  <span>
                    {stats.acted} acted live · {stats.undone} undone
                  </span>
                )}
              </div>

              {g.mode === 'shadow' && ready && (
                <div className="adm-note tint-text hue-green">
                  Agreed on {pct(agreement as number)} of {stats.compared}{' '}
                  decisions — ready to go live if you're comfortable.
                </div>
              )}
              {g.mode === 'shadow' &&
                !ready &&
                stats.compared < SUGGEST_LIVE_MIN_COMPARED && (
                  <div className="adm-note">
                    {SUGGEST_LIVE_MIN_COMPARED - stats.compared} more of your
                    decisions on listings it approved or rejected before a
                    reliable read.
                  </div>
                )}

              <button
                type="button"
                className="adm-disclosure-btn"
                aria-expanded={Boolean(open[g.gate])}
                onClick={() => setOpen((o) => ({ ...o, [g.gate]: !o[g.gate] }))}
              >
                {open[g.gate] ? (
                  <ChevronDown size={16} aria-hidden="true" />
                ) : (
                  <ChevronRight size={16} aria-hidden="true" />
                )}
                Recent decisions ({g.recent.length})
              </button>

              {open[g.gate] && (
                <div className="adm-decisions">
                  {g.recent.map((d) => {
                    const disagree =
                      d.humanDecision &&
                      d.decision !== 'hold' &&
                      d.humanDecision !== d.decision;
                    return (
                      <div
                        key={d.id}
                        className={`adm-decision${disagree ? ' is-disagree' : ''}`}
                      >
                        <span
                          className={`adm-decision-verdict ${DECISION_HUE[d.decision]}`}
                        >
                          {d.decision}
                        </span>
                        <a
                          href={`/mcp/${d.serverId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="adm-row-link"
                        >
                          {d.name ?? d.serverId}
                        </a>
                        <span className="adm-decision-reason">{d.reason}</span>
                        {d.humanDecision && (
                          <span
                            className={
                              disagree ? 'tint-text hue-amber' : 'adm-muted'
                            }
                          >
                            you: {d.humanDecision}
                          </span>
                        )}
                        {d.mode === 'live' && d.actedAt && !d.undoneAt && (
                          <>
                            <span className="adm-accent">acted</span>
                            {d.decision === 'approve' && (
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary adm-btn-xs"
                                disabled={busy}
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
                                <Undo2 size={12} aria-hidden="true" /> Undo
                              </button>
                            )}
                          </>
                        )}
                        {d.undoneAt && (
                          <span className="tint-text hue-amber">undone</span>
                        )}
                      </div>
                    );
                  })}
                  {g.recent.length === 0 && (
                    <span className="adm-note">
                      Nothing yet — the sweep decides as listings get triaged
                      and their repo checked.
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
