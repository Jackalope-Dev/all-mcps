import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listingSignals, servers, stdioVerifications } from '@/db/schema';
import { getAuthorizedAdminEmail } from '@/lib/adminAuth';
import { getGithubToken } from '@/lib/githubAuth';
import {
  reviewColumns,
  toolNamesFromJson,
  triageListing,
} from '@/lib/listingReview';
import { checkRepo, type RepoStatus } from '@/lib/repoCheck';
import { upsertSignals } from '@/lib/signalStore';
import { parseStaleReasons } from '@/lib/staleness';
import { computeTrustTier } from '@/lib/trustTier';

/**
 * The admin triage queue: every listing that needs a curator decision, with
 * the evidence for it on one row so a decision takes a keystroke.
 *
 *   pending  submitted or ingested listings awaiting approval
 *   stale    active listings the stale sweep flagged (noindexed; auto-removed
 *            after the grace period if every reason is a hard signal)
 *
 * Approve / reject / unpublish go through /api/admin/action like everywhere
 * else in /admin, so emails, audit and revalidation stay in one place. This
 * route only adds what is specific to triage: re-asking Jev, and "keep".
 */

const QUEUES = ['pending', 'stale'] as const;
const VERDICT_FILTERS = [
  'all',
  'approve',
  'needs_review',
  'reject',
  'none',
] as const;
const PAGE_SIZE = 50;

async function getDb() {
  const ctx = await getCloudflareContext();
  const env = ctx.env as any;
  if (!env?.DB) throw new Error('Database binding not found');
  return { db: drizzle(env.DB as any), env };
}

export async function GET(req: Request) {
  try {
    if (!(await getAuthorizedAdminEmail())) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const url = new URL(req.url);
    const queue = QUEUES.includes(url.searchParams.get('queue') as any)
      ? (url.searchParams.get('queue') as (typeof QUEUES)[number])
      : 'pending';
    const verdict = VERDICT_FILTERS.includes(
      url.searchParams.get('verdict') as any,
    )
      ? (url.searchParams.get('verdict') as (typeof VERDICT_FILTERS)[number])
      : 'all';
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

    const { db } = await getDb();
    const queueWhere =
      queue === 'pending'
        ? eq(servers.status, 'pending')
        : and(eq(servers.status, 'active'), isNotNull(servers.staleFlaggedAt));
    const verdictWhere =
      verdict === 'all'
        ? undefined
        : verdict === 'none'
          ? isNull(listingSignals.triageVerdict)
          : eq(listingSignals.triageVerdict, verdict);
    const where = and(queueWhere, verdictWhere);

    const rows = await db
      .select({
        id: servers.id,
        name: servers.name,
        url: servers.url,
        websiteUrl: servers.websiteUrl,
        description: servers.description,
        aiSummary: servers.aiSummary,
        category: servers.category,
        status: servers.status,
        createdAt: servers.createdAt,
        submitterEmail: servers.submitterEmail,
        reviewPriority: servers.reviewPriority,
        reviewFlagged: servers.reviewFlagged,
        githubStars: servers.githubStars,
        npmDownloads: servers.npmDownloads,
        lastCommitAt: servers.lastCommitAt,
        repoForkOf: listingSignals.repoForkOf,
        repoStatus: listingSignals.repoStatus,
        repoGoneCount: listingSignals.repoGoneCount,
        repoCheckedAt: listingSignals.repoCheckedAt,
        healthStatus: servers.healthStatus,
        mcpProbability: listingSignals.mcpProbability,
        listingQuality: listingSignals.listingQuality,
        triageVerdict: listingSignals.triageVerdict,
        triageReason: listingSignals.triageReason,
        reviewedAt: listingSignals.reviewedAt,
        staleFlaggedAt: servers.staleFlaggedAt,
        staleReasons: listingSignals.staleReasons,
        packageDeprecated: listingSignals.packageDeprecated,
        packageMissingAt: listingSignals.packageMissingAt,
        toolsSource: servers.toolsSource,
        installNeedsConfig: servers.installNeedsConfig,
        remoteEndpointHealthy: servers.remoteEndpointHealthy,
        installKind: servers.installKind,
        installCommand: servers.installCommand,
        installPackage: servers.installPackage,
        sandboxStatus: stdioVerifications.status,
        sandboxError: stdioVerifications.error,
        sandboxStderr: stdioVerifications.stderr,
        sandboxToolCount: stdioVerifications.toolCount,
        sandboxCheckedAt: stdioVerifications.checkedAt,
      })
      .from(servers)
      .leftJoin(listingSignals, eq(listingSignals.serverId, servers.id))
      .leftJoin(stdioVerifications, eq(stdioVerifications.serverId, servers.id))
      .where(where)
      // Paid priority first; then the decisions Jev is surest about, so bulk
      // approve/reject clears the easy part of the queue first.
      .orderBy(
        desc(servers.reviewPriority),
        sql`CASE ${listingSignals.triageVerdict} WHEN 'reject' THEN 0 WHEN 'approve' THEN 1 WHEN 'needs_review' THEN 2 ELSE 3 END`,
        asc(servers.createdAt),
      )
      .limit(PAGE_SIZE)
      .offset(offset);

    const counts = await db
      .select({
        verdict: listingSignals.triageVerdict,
        n: sql<number>`count(*)`,
      })
      .from(servers)
      .leftJoin(listingSignals, eq(listingSignals.serverId, servers.id))
      .where(queueWhere)
      .groupBy(listingSignals.triageVerdict);

    return NextResponse.json({
      queue,
      verdict,
      offset,
      pageSize: PAGE_SIZE,
      counts: Object.fromEntries(
        counts.map((c) => [c.verdict ?? 'none', Number(c.n)]),
      ),
      items: rows.map((r) => ({
        ...r,
        staleReasons: parseStaleReasons(r.staleReasons),
        trustTier: computeTrustTier(r),
        sandboxStderr: r.sandboxStderr ? r.sandboxStderr.slice(-600) : null,
      })),
    });
  } catch (error: any) {
    console.error('admin triage GET error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}

const postSchema = z.object({
  id: z.string().min(1),
  action: z.enum(['retriage', 'keep']),
});

export async function POST(req: Request) {
  try {
    if (!(await getAuthorizedAdminEmail())) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const parsed = postSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
    const { id, action } = parsed.data;
    const { db, env } = await getDb();
    const now = new Date();

    if (action === 'keep') {
      // Vouched for by a human: unflag and stop the sweep from flagging again.
      await upsertSignals(db, id, { curatorKeptAt: now, staleReasons: null });
      await db
        .update(servers)
        .set({ staleFlaggedAt: null })
        .where(eq(servers.id, id));
      return NextResponse.json({ success: true, message: 'Kept.' });
    }

    const [r] = await db
      .select({
        name: servers.name,
        description: servers.description,
        url: servers.url,
        websiteUrl: servers.websiteUrl,
        aiOverview: servers.aiOverview,
        tools: servers.tools,
        installKind: servers.installKind,
        installCommand: servers.installCommand,
        installPackage: servers.installPackage,
        remoteEndpointUrl: servers.remoteEndpointUrl,
        githubStars: servers.githubStars,
        npmDownloads: servers.npmDownloads,
        lastCommitAt: servers.lastCommitAt,
        repoForkOf: listingSignals.repoForkOf,
        staleReasons: listingSignals.staleReasons,
        repoStatus: listingSignals.repoStatus,
        repoGoneCount: listingSignals.repoGoneCount,
        repoFirstGoneAt: listingSignals.repoFirstGoneAt,
        sandboxStatus: stdioVerifications.status,
        toolCount: stdioVerifications.toolCount,
      })
      .from(servers)
      .leftJoin(listingSignals, eq(listingSignals.serverId, servers.id))
      .leftJoin(stdioVerifications, eq(stdioVerifications.serverId, servers.id))
      .where(eq(servers.id, id))
      .limit(1);
    if (!r) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }
    // A fresh repo check first, so the answer reflects the source as it is
    // now — the same streak bookkeeping as the sweep's repo phase.
    const { status: repoStatus, stars: repoStars } = await checkRepo(
      r.url,
      getGithubToken(env),
      r.websiteUrl,
    );
    if (repoStatus !== 'unknown') {
      const isGone = repoStatus === 'gone';
      await upsertSignals(db, id, {
        repoStatus,
        repoCheckedAt: now,
        ...(repoStars !== null ? { repoStars } : {}),
        repoGoneCount: isGone ? (r.repoGoneCount ?? 0) + 1 : 0,
        repoFirstGoneAt: isGone ? (r.repoFirstGoneAt ?? now) : null,
      });
    }
    const triage = await triageListing(
      { name: r.name, description: r.description, url: r.url },
      {
        sandboxStatus:
          r.sandboxStatus && r.sandboxStatus !== 'pending'
            ? r.sandboxStatus
            : null,
        toolCount: r.toolCount,
        toolNames: toolNamesFromJson(r.tools),
        websiteUrl: r.websiteUrl,
        installKind: r.installKind,
        installCommand: r.installCommand,
        installPackage: r.installPackage,
        remoteEndpointUrl: r.remoteEndpointUrl,
        githubStars: r.githubStars ?? repoStars,
        npmDownloads: r.npmDownloads,
        lastCommitAt: r.lastCommitAt,
        repoForkOf: r.repoForkOf,
        staleReasons: parseStaleReasons(r.staleReasons),
        readme: r.aiOverview,
        repoStatus:
          repoStatus !== 'unknown'
            ? repoStatus
            : (r.repoStatus as RepoStatus | null),
      },
    );
    if (triage.verdict === null) {
      return NextResponse.json(
        { error: 'Jev did not answer — try again shortly.' },
        { status: 503 },
      );
    }
    await upsertSignals(db, id, {
      ...reviewColumns(triage, now),
      triageVerdict: triage.verdict,
      triageReason: triage.reason,
      triageConfidence: triage.verdictConfidence,
    });
    return NextResponse.json({
      success: true,
      verdict: triage.verdict,
      reason: triage.reason,
      mcpProbability: triage.mcpServerProbability,
      repoStatus,
    });
  } catch (error: any) {
    console.error('admin triage POST error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
