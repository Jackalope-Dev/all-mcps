import { desc, eq, gte } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { autoDecisions, moderationDecisions } from '../db/schema';
import { isModerationReason, type ModerationReason } from './moderationReasons';

type Db = DrizzleD1Database<any>;

/** The servers columns a snapshot keeps; any servers row satisfies it. */
type ListingRow = {
  id: string;
  name: string;
  description: string | null;
  url: string;
  websiteUrl: string | null;
  remoteEndpointUrl: string | null;
  category: string;
  submitterEmail: string | null;
  tools: string | null;
};

function toolNames(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed
          .map((t) => (typeof t?.name === 'string' ? t.name : null))
          .filter((n): n is string => Boolean(n))
          .slice(0, 60)
      : [];
  } catch {
    return [];
  }
}

function listingSnapshot(row: ListingRow) {
  return {
    name: row.name,
    description: row.description,
    url: row.url,
    websiteUrl: row.websiteUrl,
    remoteEndpointUrl: row.remoteEndpointUrl,
    category: row.category,
    submitterEmail: row.submitterEmail,
    toolNames: toolNames(row.tools),
  };
}

/**
 * Record an admin reject or unpublish. Never throws: a bookkeeping failure
 * must not fail the admin's action (same rule as recordHumanDecision).
 */
export async function recordModeration(
  db: Db,
  input: {
    row: ListingRow;
    action: 'reject' | 'unpublish';
    reasons: ModerationReason[];
    note?: string | null;
    /** Reject only: the text emailed to the submitter. */
    feedback?: string | null;
    source: 'modal' | 'triage' | 'listings' | 'gate';
    decidedBy: string | null;
  },
): Promise<void> {
  try {
    const [gate] = await db
      .select({ decision: autoDecisions.decision })
      .from(autoDecisions)
      .where(eq(autoDecisions.serverId, input.row.id))
      .orderBy(desc(autoDecisions.createdAt))
      .limit(1);
    await db.insert(moderationDecisions).values({
      serverId: input.row.id,
      action: input.action,
      reasons: JSON.stringify([...new Set(input.reasons)]),
      note: input.note?.trim() || null,
      feedback: input.feedback ?? null,
      source: input.source,
      snapshot: JSON.stringify(listingSnapshot(input.row)),
      gateDecision: gate?.decision ?? null,
      decidedBy: input.decidedBy,
      createdAt: new Date(),
    });
  } catch (e) {
    console.error('recordModeration failed:', e);
  }
}

export type ReasonStats = {
  days: number;
  total: number;
  /** Decisions with no reason given (bulk triage). */
  unlabeled: number;
  byReason: { reason: ModerationReason; count: number }[];
  /** Rejects of listings a gate had said approve: what the gate misses, by reason. */
  gateMissed: { reason: ModerationReason; count: number }[];
};

/** Reason counts over the last `days`, for the automation panel. */
export async function getReasonStats(db: Db, days = 30): Promise<ReasonStats> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db
    .select({
      reasons: moderationDecisions.reasons,
      gateDecision: moderationDecisions.gateDecision,
    })
    .from(moderationDecisions)
    .where(gte(moderationDecisions.createdAt, since));
  const by = new Map<ModerationReason, number>();
  const missed = new Map<ModerationReason, number>();
  let unlabeled = 0;
  for (const r of rows) {
    let codes: ModerationReason[] = [];
    try {
      codes = (JSON.parse(r.reasons) as unknown[]).filter(isModerationReason);
    } catch {}
    if (codes.length === 0) unlabeled++;
    for (const c of codes) {
      by.set(c, (by.get(c) ?? 0) + 1);
      if (r.gateDecision === 'approve') missed.set(c, (missed.get(c) ?? 0) + 1);
    }
  }
  const sorted = (m: Map<ModerationReason, number>) =>
    [...m.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  return {
    days,
    total: rows.length,
    unlabeled,
    byReason: sorted(by),
    gateMissed: sorted(missed),
  };
}
