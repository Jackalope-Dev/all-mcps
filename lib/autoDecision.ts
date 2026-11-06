import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import {
  autoDecisions,
  automationGates,
  listingSignals,
  moderationDecisions,
  servers,
  stdioVerifications,
} from '../db/schema';
import {
  POLICY_FLAG_LABEL,
  type PolicyFlag,
  policyFlags,
} from './listingPolicy';
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

export const GATES = ['submission', 'ingest_promote', 'dedupe_retire'] as const;
export type Gate = (typeof GATES)[number];
/** Gates that decide pending listings (the stale sweep's phase 6). */
export const PENDING_GATES = ['submission', 'ingest_promote'] as const;
export type GateMode = 'off' | 'shadow' | 'live';
export type AutoDecision = 'approve' | 'reject' | 'hold';

export const GATE_COPY: Record<Gate, { label: string; detail: string }> = {
  submission: {
    label: 'Human submissions',
    detail:
      'Approves submissions Jev rates likely MCP and did not reject, with a live source or MCP endpoint. Low usage is not a bar (the trust tier shows it), but when Jev is unsure something must show the server runs. Holds resubmissions of rejected listings and policy flags; rejects only a confirmed-dead source or a Jev reject with no sign of use. Emails the submitter either way.',
  },
  ingest_promote: {
    label: 'Imported listings fast-track',
    detail:
      'Publishes imported listings Jev rates likely MCP and did not reject, with a live source, without the 7-day wait. Never rejects — the stale sweep handles dead ones.',
  },
  dedupe_retire: {
    label: 'Duplicate retirement',
    detail:
      'Retires a listing the weekly sweep finds pointing at exactly the same repo directory as a stronger listing (status removed, 308 to the keeper). In shadow it files a duplicate report instead. Undo restores the listing and stops it being retired again.',
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
  /**
   * The listing's hosted endpoint answered the MCP handshake (or an OAuth/API-key
   * challenge) the last time we asked: lib/tools/discoverRemoteEndpoint.ts at
   * intake and in its cron, the health cron once live. Hosted servers have no
   * package or stars, so without this "no sign of real use" held every one.
   */
  liveEndpoint: boolean;
  /**
   * Policy flags (lib/listingPolicy.ts): adult content, which isn't listed,
   * and kinds of listing a human should see before they go live (brochures,
   * lead-gen pages, evasion tools, directory links). Never auto-approved,
   * however strong the rest is.
   */
  policyFlags: PolicyFlag[];
  /**
   * An admin already rejected this listing and it came back (the submitter
   * resubmitted it, or a fixable reject kept the row). Holos33 went
   * "Recommend: approve" twice in Nov 2026 because the gate never knew.
   * Optional: only the submission gate's callers look it up.
   */
  priorRejection?: boolean;
  /**
   * How many submissions from this submitter's email are pending right now,
   * this one included. A templated network (Energy North: 13 near-identical
   * "directory" listings in one batch, all rejected) arrives this way, and
   * nothing else in the evidence tells it apart from a real new server.
   */
  sameSubmitterPending?: number;
};

export type GateResult = { decision: AutoDecision; reasons: string[] };

/**
 * Thresholds, exported so the admin panel can show the exact bar.
 *
 * Jev's triage verdict is only a veto here, not the approval signal. It almost
 * never says approve: its 3-level rubric pulls an unsure answer to the middle
 * (needs_review) at low confidence, so a bar on "approve at ≥ 80% confidence"
 * held every listing. Jev's MCP probability is what separates the admin's own
 * calls — in Oct 2026 every reviewed listing at ≥ 0.6 was approved and 69 of 71
 * at ≤ 0.5 were rejected.
 */
export const SUBMISSION_BAR = {
  mcpProbability: 0.6,
  stars: 5,
  /** Pending submissions from one email at once before a human looks. */
  batch: 5,
} as const;
export const INGEST_BAR = {
  mcpProbability: 0.6,
  stars: 5,
} as const;

/**
 * Null while evidence is still being gathered — the gate waits rather than
 * guessing. A hosted product often has no repo for the source check to read,
 * and its live endpoint is the stronger evidence anyway.
 */
function evidenceReady(e: GateEvidence): boolean {
  return e.triageVerdict !== null && (e.repoStatus !== null || e.liveEndpoint);
}

/** The server was seen running, so a text-only judgment can't reject it. */
function provenRunning(e: GateEvidence): boolean {
  return (
    e.liveEndpoint ||
    e.sandboxStatus === 'ok' ||
    e.sandboxStatus === 'needs_credentials'
  );
}

const ENDPOINT_PROOF = 'hosted endpoint answers MCP';

function proofOfUse(e: GateEvidence, minStars: number): string | null {
  if (e.sandboxStatus === 'ok') return 'ran in our sandbox';
  if (e.sandboxStatus === 'needs_credentials')
    return 'started in our sandbox (needs keys)';
  if (e.liveEndpoint) return ENDPOINT_PROOF;
  if (e.packageAlive) return 'package published';
  if ((e.stars ?? 0) >= minStars) return `${e.stars} GitHub stars`;
  return null;
}

function policyHold(e: GateEvidence): GateResult | null {
  if (e.policyFlags.length === 0) return null;
  return {
    decision: 'hold',
    reasons: e.policyFlags.map((f) => POLICY_FLAG_LABEL[f]),
  };
}

function pct(n: number | null): string {
  return n === null ? '?' : `${Math.round(n * 100)}%`;
}

/** Shown on an approve with no usage signal: users see the trust tier, so it isn't a bar. */
export const NO_USAGE_YET = 'no usage signal yet (listed as unverified)';

/**
 * Backtested on the 140 submissions an admin decided 2026-10-13..23: the 49
 * Jev rejects the admin also rejected all had no sign of real use, and the 3
 * the admin overrode were hosted products with a live endpoint. So a Jev
 * reject rejects only when nothing (stars, package, sandbox, endpoint) says
 * the server is used; on its own it still holds. A live endpoint also stands
 * in for the is-MCP bar and the source check: a completed handshake is better
 * evidence than either, and a hosted product's root URL often 404s.
 *
 * Low usage is not a reason to hold (admin policy, 2026-11-05): the directory
 * is also for discovering new servers, and the listing's trust tier already
 * tells users how proven it is. So a real MCP server Jev approves goes
 * through with no stars, package or sandbox run. What still needs a human is
 * Jev being unsure when nothing beyond the listing's own word (or a bare open
 * endpoint) shows the server is what it says.
 */
export function decideSubmission(e: GateEvidence): GateResult | null {
  const held = policyHold(e);
  if (held) return held;
  if (e.priorRejection) {
    return {
      decision: 'hold',
      reasons: ['you rejected this listing before (resubmitted)'],
    };
  }
  if ((e.sameSubmitterPending ?? 0) >= SUBMISSION_BAR.batch) {
    return {
      decision: 'hold',
      reasons: [
        `${e.sameSubmitterPending} submissions pending from this submitter at once`,
      ],
    };
  }
  const proven = provenRunning(e);
  if (e.repoGoneConfirmed && !proven) {
    return {
      decision: 'reject',
      reasons: ['source repo gone (404 twice, a day apart)'],
    };
  }
  if (!evidenceReady(e)) return null;

  const proof = proofOfUse(e, SUBMISSION_BAR.stars);
  if (e.triageVerdict === 'reject' && !proof) {
    return {
      decision: 'reject',
      reasons: [
        'Jev said reject',
        `MCP ${pct(e.mcpProbability)}`,
        'no sign of real use',
      ],
    };
  }

  const missing: string[] = [];
  if (e.triageVerdict === 'reject') missing.push('Jev said reject');
  if (
    !e.liveEndpoint &&
    (e.mcpProbability ?? 0) < SUBMISSION_BAR.mcpProbability
  )
    missing.push(`MCP ${pct(e.mcpProbability)}`);
  if (e.repoStatus !== 'ok' && !e.liveEndpoint)
    missing.push(`source ${e.repoStatus}`);
  // The intake flag is a one-off text guess made at submission that this
  // isn't an MCP server (or has useless copy). A live handshake answers the
  // first half, and a later triage approve (which reads the README) replaces
  // the guess: 19 of the holds the admin approved were only this flag.
  if (e.reviewFlagged && !e.liveEndpoint && e.triageVerdict !== 'approve')
    missing.push('flagged at intake');
  // An open endpoint proves an MCP server exists, not that it belongs here.
  // Every approve the admin overturned in the shadow run (6 of 72, Oct–Nov
  // 2026) had an open endpoint as its only proof, and the two Jev was unsure
  // about (look closer) were among them. So when the endpoint (or nothing) is
  // all there is, Jev must actually say approve, which needs legit and
  // belongs to clear their bars.
  const independentProof = proofOfUse(
    { ...e, liveEndpoint: false },
    SUBMISSION_BAR.stars,
  );
  if (
    !independentProof &&
    e.triageVerdict !== 'approve' &&
    !missing.includes('Jev said reject')
  )
    missing.push(
      proof === ENDPOINT_PROOF
        ? 'endpoint is the only proof and Jev is unsure'
        : 'Jev is unsure and nothing shows it runs',
    );

  if (missing.length > 0) return { decision: 'hold', reasons: missing };
  return {
    decision: 'approve',
    reasons: [
      `Jev ${e.triageVerdict === 'approve' ? 'approve' : 'no objection'}`,
      `MCP ${pct(e.mcpProbability)}`,
      e.repoStatus === 'ok' ? 'source live' : 'endpoint live',
      proof ?? NO_USAGE_YET,
    ],
  };
}

/**
 * Re-run on the evidence a past decision stored, so the admin's track record
 * can be read against the gate as it is now (lib/gateCalibration.ts).
 */
export function decideSubmissionFromStored(json: string | null) {
  if (!json) return null;
  try {
    const e = JSON.parse(json) as Partial<GateEvidence>;
    return decideSubmission({
      triageVerdict: e.triageVerdict ?? null,
      triageConfidence: e.triageConfidence ?? null,
      mcpProbability: e.mcpProbability ?? null,
      repoStatus: e.repoStatus ?? null,
      repoGoneConfirmed: e.repoGoneConfirmed ?? false,
      stars: e.stars ?? null,
      reviewFlagged: e.reviewFlagged ?? false,
      sandboxStatus: e.sandboxStatus ?? null,
      packageAlive: e.packageAlive ?? false,
      liveEndpoint: e.liveEndpoint ?? false,
      policyFlags: e.policyFlags ?? [],
      priorRejection: e.priorRejection ?? false,
      sameSubmitterPending: e.sameSubmitterPending ?? 0,
    });
  } catch {
    return null;
  }
}

export function decideIngestPromote(e: GateEvidence): GateResult | null {
  const held = policyHold(e);
  if (held) return held;
  if (!evidenceReady(e)) return null;

  const missing: string[] = [];
  if (e.repoGoneConfirmed) missing.push('source repo gone');
  // Possible duplicate Jev couldn't rule out at import, or a repo unrelated
  // to the name (scripts/ingest-sources.mjs).
  if (e.reviewFlagged) missing.push('flagged at import (possible duplicate)');
  if (e.triageVerdict === 'reject') missing.push('Jev said reject');
  if ((e.mcpProbability ?? 0) < INGEST_BAR.mcpProbability)
    missing.push(`MCP ${pct(e.mcpProbability)}`);
  if (e.repoStatus !== 'ok' && e.repoStatus !== 'site_only')
    missing.push(`source ${e.repoStatus}`);
  // A private repo with a live website is plausible but thin, so it needs
  // proof that doesn't come from the repo itself.
  const proof =
    e.repoStatus === 'site_only'
      ? e.packageAlive || e.sandboxStatus === 'ok' || e.liveEndpoint
        ? proofOfUse(e, Number.POSITIVE_INFINITY)
        : null
      : proofOfUse(e, INGEST_BAR.stars);
  if (!proof) missing.push('no sign of real use');

  if (missing.length > 0) return { decision: 'hold', reasons: missing };
  return {
    decision: 'approve',
    reasons: [
      `Jev ${e.triageVerdict === 'approve' ? 'approve' : 'no objection'}`,
      `MCP ${pct(e.mcpProbability)}`,
      e.repoStatus === 'ok' ? 'source live' : 'website live',
      proof as string,
    ],
  };
}

/** The columns gateEvidenceFromRow reads — see GATE_EVIDENCE_COLUMNS. */
export type GateEvidenceRow = {
  name: string;
  description: string | null;
  url: string;
  websiteUrl: string | null;
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
  remoteEndpointUrl: string | null;
  remoteEndpointHealthy: boolean | null;
  tools: string | null;
  /** From submitterSignals(); left out where nobody looked them up. */
  priorRejection?: boolean;
  sameSubmitterPending?: number;
};

export function gateEvidenceFromRow(
  row: GateEvidenceRow,
  now: Date,
): GateEvidence {
  return {
    priorRejection: row.priorRejection ?? false,
    sameSubmitterPending: row.sameSubmitterPending ?? 0,
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
    liveEndpoint:
      Boolean(row.remoteEndpointUrl) && row.remoteEndpointHealthy === true,
    policyFlags: policyFlags(row),
  };
}

export const GATE_EVIDENCE_COLUMNS = {
  name: servers.name,
  description: servers.description,
  url: servers.url,
  websiteUrl: servers.websiteUrl,
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
  remoteEndpointUrl: servers.remoteEndpointUrl,
  remoteEndpointHealthy: servers.remoteEndpointHealthy,
  tools: servers.tools,
};

/**
 * Which of these listings an admin has rejected before: a reject in the
 * moderation log, or an admin reject written next to a gate decision (that
 * covers rejects from before the log existed, 2026-11-03). Both tables are
 * indexed on server_id; IN lists are chunked under D1's bound-parameter cap.
 */
async function priorRejections(db: Db, ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    const [a, b] = await Promise.all([
      db
        .select({ id: moderationDecisions.serverId })
        .from(moderationDecisions)
        .where(
          and(
            inArray(moderationDecisions.serverId, chunk),
            eq(moderationDecisions.action, 'reject'),
          ),
        ),
      db
        .select({ id: autoDecisions.serverId })
        .from(autoDecisions)
        .where(
          and(
            inArray(autoDecisions.serverId, chunk),
            eq(autoDecisions.humanDecision, 'reject'),
          ),
        ),
    ]);
    for (const r of [...a, ...b]) out.add(r.id);
  }
  return out;
}

export type SubmitterSignals = {
  priorRejection: boolean;
  sameSubmitterPending: number;
};

/**
 * The submission gate's track-record evidence for these listings: was it
 * rejected before, and how many submissions are pending from the same email.
 * Indexed lookups only (status, server_id); never a scan of the catalog.
 */
export async function submitterSignals(
  db: Db,
  ids: string[],
): Promise<Map<string, SubmitterSignals>> {
  const out = new Map<string, SubmitterSignals>();
  if (ids.length === 0) return out;
  const emails = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 90) {
    const rows = await db
      .select({ id: servers.id, email: servers.submitterEmail })
      .from(servers)
      .where(inArray(servers.id, ids.slice(i, i + 90)));
    for (const r of rows) if (r.email) emails.set(r.id, r.email.toLowerCase());
  }
  const uniq = [...new Set(emails.values())];
  const pendingBy = new Map<string, number>();
  for (let i = 0; i < uniq.length; i += 90) {
    const rows = await db
      .select({
        email: sql<string>`lower(${servers.submitterEmail})`,
        n: sql<number>`count(*)`,
      })
      .from(servers)
      .where(
        and(
          eq(servers.status, 'pending'),
          inArray(sql`lower(${servers.submitterEmail})`, uniq.slice(i, i + 90)),
        ),
      )
      .groupBy(sql`lower(${servers.submitterEmail})`);
    for (const r of rows) pendingBy.set(r.email, Number(r.n));
  }
  const rejected = await priorRejections(db, ids);
  for (const id of ids) {
    const email = emails.get(id);
    out.set(id, {
      priorRejection: rejected.has(id),
      sameSubmitterPending: email ? (pendingBy.get(email) ?? 0) : 0,
    });
  }
  return out;
}

export type PendingRecommendation = {
  decision: AutoDecision;
  reasons: string[];
  /** Why the card says "Needs a look", or null when it isn't flagged. */
  flagReason: string | null;
};

const INTAKE_GUESS =
  'intake text check: may not be an MCP server, or thin copy';

/**
 * Why a listing carries review_flagged. The flag itself stores no reason, so
 * a card said "Needs a look" on listings (AIBIMTool, Paperzilla) whose live
 * endpoint and Jev approve had already answered it. Policy flags are read
 * live; anything else was the one-off text guess at intake.
 */
export function flagReason(e: GateEvidence): string | null {
  if (!e.reviewFlagged) return null;
  if (e.policyFlags.length > 0)
    return e.policyFlags.map((f) => POLICY_FLAG_LABEL[f]).join('; ');
  if (e.liveEndpoint && e.triageVerdict === 'approve')
    return `${INTAKE_GUESS} (since answered: endpoint live, Jev approves)`;
  return INTAKE_GUESS;
}

/**
 * What the gate would do with a pending listing right now, so a review card
 * shows the combined call (Jev plus hard evidence) and not Jev alone.
 */
export function recommendPending(
  row: GateEvidenceRow & { submitterEmail: string | null },
  now: Date,
): PendingRecommendation {
  const evidence = gateEvidenceFromRow(
    { ...row, repoGoneCount: row.repoGoneCount ?? 0 },
    now,
  );
  const result = row.submitterEmail
    ? decideSubmission(evidence)
    : decideIngestPromote(evidence);
  return {
    ...(result
      ? { decision: result.decision, reasons: result.reasons }
      : { decision: 'hold', reasons: ['still gathering evidence'] }),
    flagReason: flagReason(evidence),
  };
}

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
    const signals =
      gate === 'submission'
        ? (await submitterSignals(db, [serverId])).get(serverId)
        : undefined;
    const evidence = gateEvidenceFromRow(
      { ...row, repoGoneCount: row.repoGoneCount ?? 0, ...signals },
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
