import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import {
  listingSignals,
  servers,
  stdioVerifications,
} from '../../../../db/schema';
import { isCronAuthorized } from '../../../../lib/cronAuth';
import { reviewColumns, triageListing } from '../../../../lib/listingReview';
import { checkRegistry } from '../../../../lib/packageRegistry';
import { upsertSignals } from '../../../../lib/signalStore';
import {
  assessStaleness,
  parseStaleReasons,
  shouldAutoRemove,
} from '../../../../lib/staleness';

/**
 * Keeps dead, abandoned and fake listings out of the catalog, in stages — see
 * lib/staleness.ts for the rules and why removal is never immediate.
 *
 * Three bounded phases per tick, cheapest first so a slow registry or Jev
 * never starves the assessment that does the actual work:
 *
 *   1. registry   ask npm/PyPI whether a batch of install packages are
 *                 deprecated or gone (round-robin on registryCheckedAt)
 *   2. assess     re-run the stale rules over a batch of active listings
 *                 (round-robin on staleCheckedAt), flag / unflag, and remove
 *                 listings whose auto-removable reasons outlived the grace period
 *   3. triage     ask Jev for a curator recommendation on pending listings and
 *                 freshly flagged ones, for the admin triage queue
 */

const REGISTRY_BATCH = 60;
const REGISTRY_CONCURRENCY = 8;
const REGISTRY_RECHECK_MS = 14 * 24 * 60 * 60 * 1000;
const ASSESS_BATCH = 400;
const TRIAGE_BATCH = 24;
const TRIAGE_CONCURRENCY = 6;
/** Statements per db.batch — each is a single-row update with a handful of params. */
const WRITE_CHUNK = 50;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

async function runChunked(db: any, statements: unknown[]): Promise<void> {
  for (let i = 0; i < statements.length; i += WRITE_CHUNK) {
    const chunk = statements.slice(i, i + WRITE_CHUNK);
    if (chunk.length > 0) await db.batch(chunk as any);
  }
}

export async function POST(req: Request) {
  try {
    if (!(await isCronAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      throw new Error('Could not get Cloudflare context.');
    }
    if (!env?.DB) throw new Error('Database binding not found');
    const db = drizzle(env.DB as any);
    const now = new Date();

    // ── 1. Registry ────────────────────────────────────────────────────────
    // NULL registry_checked_at (never checked, or no signals row) sorts first.
    const registryRows = await db
      .select({
        id: servers.id,
        installCommand: servers.installCommand,
        installPackage: servers.installPackage,
        packageMissingAt: listingSignals.packageMissingAt,
      })
      .from(servers)
      .leftJoin(listingSignals, eq(listingSignals.serverId, servers.id))
      .where(
        and(
          eq(servers.status, 'active'),
          isNotNull(servers.installPackage),
          inArray(servers.installCommand, [
            'npx',
            'bunx',
            'npm',
            'uvx',
            'pip',
            'pipx',
            'pip3',
          ]),
          or(
            isNull(listingSignals.registryCheckedAt),
            lt(
              listingSignals.registryCheckedAt,
              new Date(now.getTime() - REGISTRY_RECHECK_MS),
            ),
          ),
        ),
      )
      .orderBy(asc(listingSignals.registryCheckedAt))
      .limit(REGISTRY_BATCH);

    const registryResults = await mapWithConcurrency(
      registryRows,
      REGISTRY_CONCURRENCY,
      async (r) => ({
        row: r,
        status: await checkRegistry(r.installCommand, r.installPackage),
      }),
    );
    const registryCounts = { deprecated: 0, missing: 0, unknown: 0 };
    await runChunked(
      db,
      registryResults.map(({ row, status }) => {
        if (status.kind === 'unknown') {
          registryCounts.unknown++;
          // Only advance the cursor; an inconclusive answer must not clear
          // or set either signal.
          return upsertSignals(db, row.id, { registryCheckedAt: now });
        }
        if (status.kind === 'deprecated') registryCounts.deprecated++;
        if (status.kind === 'missing') registryCounts.missing++;
        return upsertSignals(db, row.id, {
          registryCheckedAt: now,
          packageDeprecated:
            status.kind === 'deprecated' ? status.message : null,
          // Keep the first-seen date while it stays missing.
          packageMissingAt:
            status.kind === 'missing' ? (row.packageMissingAt ?? now) : null,
        });
      }),
    );

    // ── 2. Assess ──────────────────────────────────────────────────────────
    const assessRows = await db
      .select({
        id: servers.id,
        isPremium: servers.isPremium,
        isOfficial: servers.isOfficial,
        featuredUntil: servers.featuredUntil,
        ownerUserId: servers.ownerUserId,
        lastCommitAt: servers.lastCommitAt,
        githubStars: servers.githubStars,
        npmDownloads: servers.npmDownloads,
        toolsSource: servers.toolsSource,
        installNeedsConfig: servers.installNeedsConfig,
        remoteEndpointHealthy: servers.remoteEndpointHealthy,
        installKind: servers.installKind,
        staleFlaggedAt: servers.staleFlaggedAt,
        curatorKeptAt: listingSignals.curatorKeptAt,
        packageDeprecated: listingSignals.packageDeprecated,
        packageMissingAt: listingSignals.packageMissingAt,
        repoForkOf: listingSignals.repoForkOf,
        mcpProbability: listingSignals.mcpProbability,
        staleReasons: listingSignals.staleReasons,
        installFailures: stdioVerifications.installFailures,
      })
      .from(servers)
      .leftJoin(listingSignals, eq(listingSignals.serverId, servers.id))
      .leftJoin(stdioVerifications, eq(stdioVerifications.serverId, servers.id))
      .where(eq(servers.status, 'active'))
      .orderBy(asc(listingSignals.staleCheckedAt))
      .limit(ASSESS_BATCH);

    let flagged = 0;
    let unflagged = 0;
    let removed = 0;
    const assessStatements: unknown[] = [];
    for (const r of assessRows) {
      const reasons = assessStaleness({
        now,
        isPremium: r.isPremium,
        isOfficial: r.isOfficial,
        featuredUntil: r.featuredUntil,
        ownerUserId: r.ownerUserId,
        curatorKeptAt: r.curatorKeptAt,
        lastCommitAt: r.lastCommitAt,
        githubStars: r.githubStars,
        npmDownloads: r.npmDownloads,
        toolsSource: r.toolsSource,
        installNeedsConfig: r.installNeedsConfig,
        remoteEndpointHealthy: r.remoteEndpointHealthy,
        installKind: r.installKind,
        packageDeprecated: r.packageDeprecated,
        packageMissing: r.packageMissingAt != null,
        installFailures: r.installFailures,
        repoForkOf: r.repoForkOf,
        mcpProbability: r.mcpProbability,
      });

      if (reasons.length === 0) {
        assessStatements.push(
          upsertSignals(db, r.id, { staleCheckedAt: now, staleReasons: null }),
        );
        if (r.staleFlaggedAt) {
          unflagged++;
          assessStatements.push(
            db
              .update(servers)
              .set({ staleFlaggedAt: null })
              .where(eq(servers.id, r.id)),
          );
        }
        continue;
      }

      // Keep the original flag date while the listing keeps matching — the
      // grace period runs from the first sighting, not the latest.
      const flaggedAt = r.staleFlaggedAt ?? now;
      const remove = shouldAutoRemove(reasons, flaggedAt, now);
      const changedReasons =
        parseStaleReasons(r.staleReasons).join(',') !== reasons.join(',');
      assessStatements.push(
        upsertSignals(db, r.id, {
          staleCheckedAt: now,
          staleReasons: reasons.join(','),
          // New evidence means Jev's earlier recommendation is out of date.
          ...(changedReasons
            ? { triageVerdict: null, triageReason: null }
            : {}),
        }),
      );
      if (!r.staleFlaggedAt || remove) {
        if (!r.staleFlaggedAt) flagged++;
        if (remove) removed++;
        assessStatements.push(
          db
            .update(servers)
            .set({
              staleFlaggedAt: flaggedAt,
              ...(remove ? { status: 'removed' } : {}),
            })
            .where(and(eq(servers.id, r.id), eq(servers.status, 'active'))),
        );
      }
    }
    await runChunked(db, assessStatements);

    // ── 3. Triage ──────────────────────────────────────────────────────────
    // Pending listings and flagged active ones without a current Jev verdict.
    // Paid review priority first, then oldest.
    const triageRows = await db
      .select({
        id: servers.id,
        name: servers.name,
        description: servers.description,
        url: servers.url,
        aiOverview: servers.aiOverview,
        githubStars: servers.githubStars,
        npmDownloads: servers.npmDownloads,
        lastCommitAt: servers.lastCommitAt,
        repoForkOf: listingSignals.repoForkOf,
        staleReasons: listingSignals.staleReasons,
        sandboxStatus: stdioVerifications.status,
        toolCount: stdioVerifications.toolCount,
      })
      .from(servers)
      .leftJoin(listingSignals, eq(listingSignals.serverId, servers.id))
      .leftJoin(stdioVerifications, eq(stdioVerifications.serverId, servers.id))
      .where(
        and(
          isNull(listingSignals.triageVerdict),
          or(
            eq(servers.status, 'pending'),
            and(
              eq(servers.status, 'active'),
              isNotNull(servers.staleFlaggedAt),
            ),
          ),
        ),
      )
      .orderBy(desc(servers.reviewPriority), asc(servers.createdAt))
      .limit(TRIAGE_BATCH);

    const triaged = await mapWithConcurrency(
      triageRows,
      TRIAGE_CONCURRENCY,
      async (r) => ({
        id: r.id,
        triage: await triageListing(
          { name: r.name, description: r.description, url: r.url },
          {
            sandboxStatus:
              r.sandboxStatus && r.sandboxStatus !== 'pending'
                ? r.sandboxStatus
                : null,
            toolCount: r.toolCount,
            githubStars: r.githubStars,
            npmDownloads: r.npmDownloads,
            lastCommitAt: r.lastCommitAt,
            repoForkOf: r.repoForkOf,
            staleReasons: parseStaleReasons(r.staleReasons),
            readme: r.aiOverview,
          },
        ),
      }),
    );
    const answered = triaged.filter((t) => t.triage.verdict !== null);
    await runChunked(
      db,
      answered.map(({ id, triage }) =>
        upsertSignals(db, id, {
          ...reviewColumns(triage, now),
          triageVerdict: triage.verdict,
          triageReason: triage.reason,
        }),
      ),
    );

    return NextResponse.json({
      success: true,
      registry: { checked: registryRows.length, ...registryCounts },
      assess: { checked: assessRows.length, flagged, unflagged, removed },
      triage: { attempted: triageRows.length, answered: answered.length },
    });
  } catch (error: any) {
    console.error('stale-sweep error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
