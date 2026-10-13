import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import {
  autoDecisions,
  automationGates,
  listingSignals,
  servers,
  stdioVerifications,
} from '../db/schema';
import { isRepoGoneConfirmed, type RepoStatus } from './repoCheck';

/**
 * Automation gates: decisions an admin used to make by hand, made from
 * evidence instead — but only trusted once they have shown they agree with
 * the admin.
 *
 * Every gate starts in 'shadow': it records what it *would* do on each
 * listing, acts on nothing, and the admin's own later approve/reject on the
 * same listing is written next to it. The agreement rate between the two is
 * shown in /admin → Triage, and the admin switches a gate to 'live' once it
 * has earned it. 'hold' means "leave it for a human" and is never acted on.
 *
 * The rules are pure functions so the thresholds are tested, and every rule
 * lists its reasons so a decision explains itself.
 */

type Db = DrizzleD1Database<any>;

export const GATES = ['submission', 'ingest_promote'] as const;
export type Gate = (typeof GATES)[number];
export type GateMode = 'off' | 'shadow' | 'live';
export type AutoDecision = 'approve' | 'reject' | 'hold';

export const GATE_COPY: Record<Gate, { label: string; detail: string }> = {
  submission: {
    label: 'Human submissions',
    detail:
      'Approves submissions with a confident Jev approve, a live source repo and a sign of real use; rejects only a confirmed-dead source. Emails the submitter either way.',
  },
  ingest_promote: {
    label: 'Imported listings fast-track',
    detail:
      'Publishes imported listings with a confident Jev approve and a live source without the 7-day wait. Never rejects — the stale sweep handles dead ones.',
  },
};

export type GateEvidence = {
  triageVerdict: string | null;
  triageConfidence: number | null;
  mcpProbability: number | null;
  repoStatus: RepoStatus | null;
  repoGoneConfirmed: boolean;
  /** GitHub stars from the repo check or the health cron. */
  stars: number | null;
  /** Intake flagged it as likely non-MCP, low quality or a possible duplicate. */
  reviewFlagged: boolean;
  /** stdio_verifications status, if it was ever sandboxed. */
  sandboxStatus: string | null;
  /** The registry says the install package exists and isn't deprecated. */
  packageAlive: boolean;
};

export type GateResult = { decision: AutoDecision; reasons: string[] };

/** Thresholds, exported so the admin panel can show the exact bar. */
export const SUBMISSION_BAR = {
  confidence: 0.85,
  mcpProbability: 0.6,
  stars: 5,
} as const;
export const INGEST_BAR = {
  confidence: 0.8,
  mcpProbability: 0.5,
  stars: 5,
} as const;

/** Null while evidence is still being gathered — the gate waits rather than guessing. */
function evidenceReady(e: GateEvidence): boolean {
  return e.triageVerdict !== null && e.repoStatus !== null;
}

function proofOfUse(e: GateEvidence, minStars: number): string | null {
  if (e.sandboxStatus === 'ok') return 'ran in our sandbox';
  if (e.sandboxStatus === 'needs_credentials')
    return 'started in our sandbox (needs keys)';
  if (e.packageAlive) return 'package published';
  if ((e.stars ?? 0) >= minStars) return `${e.stars} GitHub stars`;
  return null;
}

function pct(n: number | null): string {
  return n === null ? '?' : `${Math.round(n * 100)}%`;
}

export function decideSubmission(e: GateEvidence): GateResult | null {
  if (e.repoGoneConfirmed) {
    return {
      decision: 'reject',
      reasons: ['source repo gone (404 twice, a day apart)'],
    };
  }
  if (!evidenceReady(e)) return null;

  const missing: string[] = [];
  if (e.triageVerdict !== 'approve')
    missing.push(`Jev said ${e.triageVerdict}`);
  if ((e.triageConfidence ?? 0) < SUBMISSION_BAR.confidence)
    missing.push(`Jev confidence ${pct(e.triageConfidence)}`);
  if ((e.mcpProbability ?? 0) < SUBMISSION_BAR.mcpProbability)
    missing.push(`MCP ${pct(e.mcpProbability)}`);
  if (e.repoStatus !== 'ok') missing.push(`source ${e.repoStatus}`);
  if (e.reviewFlagged) missing.push('flagged at intake');
  const proof = proofOfUse(e, SUBMISSION_BAR.stars);
  if (!proof) missing.push('no sign of real use');

  if (missing.length > 0) return { decision: 'hold', reasons: missing };
  return {
    decision: 'approve',
    reasons: [
      `Jev approve ${pct(e.triageConfidence)}`,
      `MCP ${pct(e.mcpProbability)}`,
      'source live',
      proof as string,
    ],
  };
}

export function decideIngestPromote(e: GateEvidence): GateResult | null {
  if (!evidenceReady(e)) return null;

  const missing: string[] = [];
  if (e.repoGoneConfirmed) missing.push('source repo gone');
  // Possible duplicate Jev couldn't rule out at import, or a repo unrelated
  // to the name (scripts/ingest-sources.mjs).
  if (e.reviewFlagged) missing.push('flagged at import (possible duplicate)');
  if (e.triageVerdict !== 'approve')
    missing.push(`Jev said ${e.triageVerdict}`);
  if ((e.triageConfidence ?? 0) < INGEST_BAR.confidence)
    missing.push(`Jev confidence ${pct(e.triageConfidence)}`);
  if ((e.mcpProbability ?? 0) < INGEST_BAR.mcpProbability)
    missing.push(`MCP ${pct(e.mcpProbability)}`);
  if (e.repoStatus !== 'ok' && e.repoStatus !== 'site_only')
    missing.push(`source ${e.repoStatus}`);
  // A private repo with a live website is plausible but thin, so it needs
  // proof that doesn't come from the repo itself.
  const proof =
    e.repoStatus === 'site_only'
      ? e.packageAlive || e.sandboxStatus === 'ok'
        ? proofOfUse(e, Number.POSITIVE_INFINITY)
        : null
      : proofOfUse(e, INGEST_BAR.stars);
  if (!proof) missing.push('no sign of real use');

  if (missing.length > 0) return { decision: 'hold', reasons: missing };
  return {
    decision: 'approve',
    reasons: [
      `Jev approve ${pct(e.triageConfidence)}`,
      `MCP ${pct(e.mcpProbability)}`,
      e.repoStatus === 'ok' ? 'source live' : 'website live',
      proof as string,
    ],
  };
}

/** The columns gateEvidenceFromRow reads — see GATE_EVIDENCE_COLUMNS. */
export type GateEvidenceRow = {
  reviewFlagged: boolean;
  githubStars: number | null;
  triageVerdict: string | null;
  triageConfidence: number | null;
  mcpProbability: number | null;
  repoStatus: string | null;
  repoStars: number | null;
  repoGoneCount: number | null;
  repoFirstGoneAt: Date | null;
  registryCheckedAt: Date | null;
  packageMissingAt: Date | null;
  packageDeprecated: string | null;
  sandboxStatus: string | null;
};

export function gateEvidenceFromRow(
  row: GateEvidenceRow,
  now: Date,
): GateEvidence {
  return {
    triageVerdict: row.triageVerdict,
    triageConfidence: row.triageConfidence,
    mcpProbability: row.mcpProbability,
    repoStatus: row.repoStatus as RepoStatus | null,
    repoGoneConfirmed: isRepoGoneConfirmed(
      row.repoGoneCount,
      row.repoFirstGoneAt,
      now,
    ),
    // Pending listings get no health-cron stars; the repo check's count
    // stands in.
    stars: row.githubStars ?? row.repoStars,
    reviewFlagged: row.reviewFlagged,
    sandboxStatus:
      row.sandboxStatus && row.sandboxStatus !== 'pending'
        ? row.sandboxStatus
        : null,
    packageAlive:
      row.registryCheckedAt != null &&
      row.packageMissingAt == null &&
      !row.packageDeprecated,
  };
}

export const GATE_EVIDENCE_COLUMNS = {
  reviewFlagged: servers.reviewFlagged,
  githubStars: servers.githubStars,
  triageVerdict: listingSignals.triageVerdict,
  triageConfidence: listingSignals.triageConfidence,
  mcpProbability: listingSignals.mcpProbability,
  repoStatus: listingSignals.repoStatus,
  repoStars: listingSignals.repoStars,
  repoGoneCount: listingSignals.repoGoneCount,
  repoFirstGoneAt: listingSignals.repoFirstGoneAt,
  registryCheckedAt: listingSignals.registryCheckedAt,
  packageMissingAt: listingSignals.packageMissingAt,
  packageDeprecated: listingSignals.packageDeprecated,
  sandboxStatus: stdioVerifications.status,
};

/**
 * Called by the admin approve/reject route just *before* the admin's action
 * runs: records, in shadow, what the gate would have decided from the
 * evidence available at that moment, if it hadn't already. Without this an
 * admin who reviews faster than the sweep would leave the gate with nothing
 * to compare against. Never throws.
 */
export async function snapshotGateDecision(
  db: Db,
  serverId: string,
): Promise<void> {
  try {
    const [row] = await db
      .select({
        ...GATE_EVIDENCE_COLUMNS,
        status: servers.status,
        submitterEmail: servers.submitterEmail,
        triageReason: listingSignals.triageReason,
      })
      .from(servers)
      .leftJoin(listingSignals, eq(listingSignals.serverId, servers.id))
      .leftJoin(stdioVerifications, eq(stdioVerifications.serverId, servers.id))
      .where(eq(servers.id, serverId))
      .limit(1);
    if (row?.status !== 'pending') return;
    const gate: Gate = row.submitterEmail ? 'submission' : 'ingest_promote';
    const evidence = gateEvidenceFromRow(
      { ...row, repoGoneCount: row.repoGoneCount ?? 0 },
      new Date(),
    );
    const result =
      gate === 'submission'
        ? decideSubmission(evidence)
        : decideIngestPromote(evidence);
    // Not enough evidence yet: record a hold so the admin's decision still
    // shows up as work the gate would have left for a human.
    await db
      .insert(autoDecisions)
      .values({
        gate,
        serverId,
        decision: result?.decision ?? 'hold',
        reason: result
          ? result.reasons.join(' · ')
          : 'not enough evidence yet (repo not checked or not triaged)',
        evidence: JSON.stringify({
          ...evidence,
          triageReason: row.triageReason,
        }),
        mode: 'shadow',
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  } catch (e) {
    console.error('snapshotGateDecision failed:', e);
  }
}

// ── Storage ────────────────────────────────────────────────────────────────

export async function getGateModes(db: Db): Promise<Record<Gate, GateMode>> {
  const rows = await db.select().from(automationGates);
  const modes = Object.fromEntries(
    GATES.map((g) => [g, 'shadow' as GateMode]),
  ) as Record<Gate, GateMode>;
  for (const r of rows) {
    if ((GATES as readonly string[]).includes(r.gate))
      modes[r.gate as Gate] = r.mode as GateMode;
  }
  return modes;
}

export async function setGateMode(
  db: Db,
  gate: Gate,
  mode: GateMode,
  by: string,
): Promise<void> {
  const now = new Date();
  await db
    .insert(automationGates)
    .values({ gate, mode, updatedAt: now, updatedBy: by })
    .onConflictDoUpdate({
      target: automationGates.gate,
      set: { mode, updatedAt: now, updatedBy: by },
    });
}

/**
 * Record a gate's decision. A new decision only replaces an earlier 'hold'
 * (the evidence may have changed since); an approve/reject is final, so the
 * agreement numbers can't be rewritten after the fact.
 */
export async function recordDecision(
  db: Db,
  row: {
    gate: Gate;
    serverId: string;
    decision: AutoDecision;
    reason: string;
    evidence: unknown;
    mode: 'shadow' | 'live';
  },
): Promise<void> {
  const values = {
    ...row,
    evidence: JSON.stringify(row.evidence),
    createdAt: new Date(),
  };
  await db
    .insert(autoDecisions)
    .values(values)
    .onConflictDoUpdate({
      target: [autoDecisions.gate, autoDecisions.serverId],
      set: values,
      setWhere: eq(autoDecisions.decision, 'hold'),
    });
}

export async function markActed(
  db: Db,
  gate: Gate,
  serverId: string,
): Promise<void> {
  await db
    .update(autoDecisions)
    .set({ actedAt: new Date() })
    .where(
      and(eq(autoDecisions.gate, gate), eq(autoDecisions.serverId, serverId)),
    );
}

/**
 * Write an admin's approve/reject next to whatever the gates decided about
 * the same listing. Never throws — a bookkeeping failure must not fail the
 * admin's action.
 */
export async function recordHumanDecision(
  db: Db,
  serverId: string,
  decision: 'approve' | 'reject',
): Promise<void> {
  try {
    await db
      .update(autoDecisions)
      .set({ humanDecision: decision, humanAt: new Date() })
      .where(
        and(
          eq(autoDecisions.serverId, serverId),
          isNull(autoDecisions.humanDecision),
        ),
      );
  } catch (e) {
    console.error('recordHumanDecision failed:', e);
  }
}

export type GateStats = {
  gate: Gate;
  total: number;
  approve: number;
  reject: number;
  hold: number;
  /** Approve/reject decisions an admin also ruled on. */
  compared: number;
  agreed: number;
  /** Holds an admin later decided — the work the gate left for a human. */
  holdsDecided: number;
  acted: number;
  undone: number;
};

export async function getGateStats(db: Db): Promise<GateStats[]> {
  const rows = await db
    .select({
      gate: autoDecisions.gate,
      total: sql<number>`count(*)`,
      approve: sql<number>`sum(${autoDecisions.decision} = 'approve')`,
      reject: sql<number>`sum(${autoDecisions.decision} = 'reject')`,
      hold: sql<number>`sum(${autoDecisions.decision} = 'hold')`,
      compared: sql<number>`sum(${autoDecisions.decision} != 'hold' AND ${autoDecisions.humanDecision} IS NOT NULL)`,
      agreed: sql<number>`sum(${autoDecisions.decision} = ${autoDecisions.humanDecision})`,
      holdsDecided: sql<number>`sum(${autoDecisions.decision} = 'hold' AND ${autoDecisions.humanDecision} IS NOT NULL)`,
      acted: sql<number>`sum(${autoDecisions.actedAt} IS NOT NULL)`,
      undone: sql<number>`sum(${autoDecisions.undoneAt} IS NOT NULL)`,
    })
    .from(autoDecisions)
    .groupBy(autoDecisions.gate);
  return GATES.map((gate) => {
    const r = rows.find((x) => x.gate === gate);
    const n = (v: unknown) => Number(v ?? 0);
    return {
      gate,
      total: n(r?.total),
      approve: n(r?.approve),
      reject: n(r?.reject),
      hold: n(r?.hold),
      compared: n(r?.compared),
      agreed: n(r?.agreed),
      holdsDecided: n(r?.holdsDecided),
      acted: n(r?.acted),
      undone: n(r?.undone),
    };
  });
}

export async function getRecentDecisions(db: Db, gate: Gate, limit = 40) {
  return db
    .select()
    .from(autoDecisions)
    .where(eq(autoDecisions.gate, gate))
    .orderBy(desc(autoDecisions.createdAt))
    .limit(limit);
}
