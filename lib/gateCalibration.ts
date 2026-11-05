import { and, eq, isNotNull } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { autoDecisions } from '../db/schema';
import { type AutoDecision, decideSubmissionFromStored } from './autoDecision';

/**
 * The admin's own track record against the submission gate, so a review card
 * can say "you approved 39 of 54 like this" instead of a bare "Your call".
 *
 * Every past decision is re-run through the gate as it is *now*, from the
 * evidence stored at the time (auto_decisions.evidence), and bucketed by that
 * call and Jev's verdict. A bucket's rate then reads directly as "how often
 * the admin agreed with this kind of recommendation", even after the gate's
 * rules change. One small query: auto_decisions holds one row per listing
 * the gate saw, a few hundred for submissions.
 */

type Db = DrizzleD1Database<any>;

type Counts = { approved: number; rejected: number };

/** Keyed by bucketKey(); counts of the admin's approve / reject in that bucket. */
export type GateCalibration = Record<string, Counts>;

export function bucketKey(
  decision: AutoDecision,
  jevVerdict: string | null,
): string {
  return `${decision}|${jevVerdict ?? 'none'}`;
}

/** Fewer decided listings than this and a rate says nothing. */
const MIN_SAMPLE = 8;
/** A hold leans one way once the admin went that way this often. */
const LEAN_AT = 0.75;

export type CalibrationNote = {
  /** e.g. "You approved 39 of 54 like this (72%)". */
  text: string;
  /** Which way the admin's own calls on this kind of listing lean, if clearly. */
  lean: 'approve' | 'reject' | null;
};

export function calibrationNote(
  cal: GateCalibration,
  decision: AutoDecision,
  jevVerdict: string | null,
): CalibrationNote | null {
  const c = cal[bucketKey(decision, jevVerdict)];
  const n = c ? c.approved + c.rejected : 0;
  if (!c || n < MIN_SAMPLE) return null;
  const rate = c.approved / n;
  const lean =
    rate >= LEAN_AT ? 'approve' : 1 - rate >= LEAN_AT ? 'reject' : null;
  const verb = lean === 'reject' ? 'rejected' : 'approved';
  const k = lean === 'reject' ? c.rejected : c.approved;
  return {
    text: `You ${verb} ${k} of ${n} like this (${Math.round((k / n) * 100)}%)`,
    lean,
  };
}

/** Pure, so the bucketing is tested without a database. */
export function buildCalibration(
  rows: { evidence: string | null; humanDecision: string | null }[],
): GateCalibration {
  const out: GateCalibration = {};
  for (const r of rows) {
    if (r.humanDecision !== 'approve' && r.humanDecision !== 'reject') continue;
    const now = decideSubmissionFromStored(r.evidence);
    if (!now) continue;
    let jev: string | null = null;
    try {
      jev = (JSON.parse(r.evidence as string).triageVerdict as string) ?? null;
    } catch {}
    const key = bucketKey(now.decision, jev);
    out[key] ??= { approved: 0, rejected: 0 };
    if (r.humanDecision === 'approve') out[key].approved++;
    else out[key].rejected++;
  }
  return out;
}

/** Never throws: a calibration failure must not break the admin page. */
export async function getGateCalibration(db: Db): Promise<GateCalibration> {
  try {
    const rows = await db
      .select({
        evidence: autoDecisions.evidence,
        humanDecision: autoDecisions.humanDecision,
      })
      .from(autoDecisions)
      .where(
        and(
          eq(autoDecisions.gate, 'submission'),
          isNotNull(autoDecisions.humanDecision),
        ),
      );
    return buildCalibration(rows);
  } catch (e) {
    console.error('gate calibration failed:', e);
    return {};
  }
}
