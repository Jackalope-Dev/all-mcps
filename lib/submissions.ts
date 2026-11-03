import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import { listingSignals, moderationDecisions, servers } from '../db/schema';
import { MAX_SUBMISSION_REJECTIONS } from './listingApproval';
import { policyFlags } from './listingPolicy';
import {
  isModerationReason,
  MODERATION_REASON_LABEL,
} from './moderationReasons';
import { isPlaceholderUrl } from './placeholderUrl';
import { isRepositoryUrl } from './repoUrl';
import { REJECTED_STATUS } from './servability';
import { findExistingListingByUrl } from './urlDedup';
import { isSafeSubmissionUrl, normalizeUrl } from './urlSafety';

/**
 * A submitter's own submissions that aren't live yet, for their dashboard:
 * pending ones to watch, and rejected ones (lib/listingApproval.ts keeps a
 * fixable rejection) to edit and send back for review. Matched on the email
 * they submitted with, which is the address they sign in with.
 */

type Db = ReturnType<typeof drizzle>;

export type MySubmission = {
  id: string;
  name: string;
  description: string;
  url: string;
  websiteUrl: string | null;
  remoteEndpointUrl: string | null;
  status: 'pending' | 'rejected';
  /** Latest rejection: what we emailed and the reason labels. */
  feedback: string | null;
  reasons: string[];
  rejections: number;
  /** False once it has used its last allowed rejection. */
  canResubmit: boolean;
};

export async function getMySubmissions(
  db: Db,
  email: string | null | undefined,
): Promise<MySubmission[]> {
  const e = email?.trim().toLowerCase();
  if (!e) return [];
  const rows = await db
    .select({
      id: servers.id,
      name: servers.name,
      description: servers.description,
      url: servers.url,
      websiteUrl: servers.websiteUrl,
      remoteEndpointUrl: servers.remoteEndpointUrl,
      status: servers.status,
    })
    .from(servers)
    .where(
      and(
        sql`lower(${servers.submitterEmail}) = ${e}`,
        inArray(servers.status, ['pending', REJECTED_STATUS]),
      ),
    )
    .orderBy(desc(servers.createdAt))
    .limit(50);
  if (rows.length === 0) return [];

  const decisions = await db
    .select({
      serverId: moderationDecisions.serverId,
      reasons: moderationDecisions.reasons,
      feedback: moderationDecisions.feedback,
    })
    .from(moderationDecisions)
    .where(
      and(
        inArray(
          moderationDecisions.serverId,
          rows.map((r) => r.id),
        ),
        eq(moderationDecisions.action, 'reject'),
      ),
    )
    .orderBy(desc(moderationDecisions.createdAt));
  const latest = new Map<string, (typeof decisions)[number]>();
  const counts = new Map<string, number>();
  for (const d of decisions) {
    if (!latest.has(d.serverId)) latest.set(d.serverId, d);
    counts.set(d.serverId, (counts.get(d.serverId) ?? 0) + 1);
  }

  return rows.map((r) => {
    const d = latest.get(r.id);
    let reasons: string[] = [];
    try {
      reasons = (JSON.parse(d?.reasons ?? '[]') as unknown[])
        .filter(isModerationReason)
        .map((c) => MODERATION_REASON_LABEL[c]);
    } catch {}
    const rejections = counts.get(r.id) ?? 0;
    return {
      ...r,
      status: r.status === REJECTED_STATUS ? 'rejected' : 'pending',
      feedback: d?.feedback ?? null,
      reasons,
      rejections,
      canResubmit:
        r.status === REJECTED_STATUS && rejections < MAX_SUBMISSION_REJECTIONS,
    };
  });
}

export type ResubmitFields = {
  name: string;
  description: string;
  url: string;
  websiteUrl?: string | null;
  remoteEndpointUrl?: string | null;
};

type ResubmitResult =
  | { ok: true; id: string; name: string; url: string }
  | { ok: false; status: number; error: string };

/**
 * Apply the submitter's edits to their rejected submission and put it back
 * in the review queue. URL rules match intake (lib/listingIntake.ts). The
 * triage verdict is cleared so it is re-read with the new text; the gate's
 * earlier decision stays, so a resubmission always reaches a human.
 */
export async function resubmitSubmission(
  db: Db,
  email: string,
  id: string,
  fields: ResubmitFields,
): Promise<ResubmitResult> {
  const e = email.trim().toLowerCase();
  const [row] = await db
    .select({ id: servers.id, status: servers.status })
    .from(servers)
    .where(
      and(eq(servers.id, id), sql`lower(${servers.submitterEmail}) = ${e}`),
    )
    .limit(1);
  if (!row) return { ok: false, status: 404, error: 'Submission not found.' };
  if (row.status !== REJECTED_STATUS)
    return {
      ok: false,
      status: 409,
      error: 'This submission is not waiting on changes.',
    };
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(moderationDecisions)
    .where(
      and(
        eq(moderationDecisions.serverId, id),
        eq(moderationDecisions.action, 'reject'),
      ),
    );
  if (Number(n) >= MAX_SUBMISSION_REJECTIONS)
    return {
      ok: false,
      status: 409,
      error:
        'This submission has been reviewed the maximum number of times. Please contact us if you think we got it wrong.',
    };

  const name = fields.name.trim();
  const description = fields.description.trim();
  if (!name || name.length > 200)
    return { ok: false, status: 400, error: 'Name must be 1–200 characters.' };
  if (description.length < 20 || description.length > 2000)
    return {
      ok: false,
      status: 400,
      error: 'Description must be 20–2000 characters.',
    };

  let url = normalizeUrl(fields.url || '');
  let websiteUrl = normalizeUrl(fields.websiteUrl || '');
  if (isPlaceholderUrl(websiteUrl)) websiteUrl = '';
  if (!url && websiteUrl) url = websiteUrl;
  if (!websiteUrl && url && !isRepositoryUrl(url)) websiteUrl = url;
  if (!url || !isSafeSubmissionUrl(url))
    return {
      ok: false,
      status: 400,
      error: 'Repository or website URL must be a public http(s) address.',
    };
  if (websiteUrl && !isSafeSubmissionUrl(websiteUrl))
    return {
      ok: false,
      status: 400,
      error: 'Website URL must be a public http(s) address.',
    };
  const remoteEndpointUrl = normalizeUrl(fields.remoteEndpointUrl || '');
  if (
    remoteEndpointUrl &&
    (!isSafeSubmissionUrl(remoteEndpointUrl) ||
      isPlaceholderUrl(remoteEndpointUrl))
  )
    return {
      ok: false,
      status: 400,
      error: 'MCP endpoint URL must be a public http(s) address.',
    };

  const existing = await findExistingListingByUrl(db, url);
  if (existing && existing.id !== id)
    return {
      ok: false,
      status: 409,
      error: `That URL is already listed as "${existing.name}". You can claim the existing listing instead.`,
    };

  const flagged =
    policyFlags({ name, description, url, websiteUrl: websiteUrl || null })
      .length > 0;
  const [updated] = await db
    .update(servers)
    .set({
      name,
      description,
      url,
      websiteUrl: websiteUrl || null,
      remoteEndpointUrl: remoteEndpointUrl || null,
      status: 'pending',
      reviewFlagged: flagged,
    })
    .where(and(eq(servers.id, id), eq(servers.status, REJECTED_STATUS)))
    .returning({ id: servers.id, name: servers.name, url: servers.url });
  if (!updated)
    return {
      ok: false,
      status: 409,
      error: 'This submission is not waiting on changes.',
    };

  await db
    .update(listingSignals)
    .set({
      triageVerdict: null,
      triageReason: null,
      triageConfidence: null,
      triageAttemptedAt: null,
      reviewedAt: null,
    })
    .where(eq(listingSignals.serverId, id));
  return { ok: true, ...updated };
}

/** How long a rejected submission waits for its submitter's edit. */
const REJECTED_TTL_DAYS = 90;

/**
 * Delete rejected submissions nobody edited within REJECTED_TTL_DAYS of the
 * latest rejection. The moderation_decisions row (reasons and a snapshot)
 * stays. Returns how many were deleted.
 */
export async function expireRejectedSubmissions(
  db: Db,
  now = new Date(),
): Promise<number> {
  const cutoff = Math.floor(
    (now.getTime() - REJECTED_TTL_DAYS * 86_400_000) / 1000,
  );
  const gone = await db
    .delete(servers)
    .where(
      and(
        eq(servers.status, REJECTED_STATUS),
        sql`${servers.id} IN (SELECT ${moderationDecisions.serverId} FROM ${moderationDecisions} WHERE ${moderationDecisions.action} = 'reject' GROUP BY ${moderationDecisions.serverId} HAVING max(${moderationDecisions.createdAt}) < ${cutoff})`,
      ),
    )
    .returning({ id: servers.id });
  return gone.length;
}
