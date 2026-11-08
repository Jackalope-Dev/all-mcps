import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { servers } from '../../../../db/schema';
import { isCronAuthorized } from '../../../../lib/cronAuth';
import { getGithubToken } from '../../../../lib/githubAuth';
import { serializeSetupSteps } from '../../../../lib/setupSteps';
import {
  fetchSetupSource,
  type PickOutcome,
  pickSetupSteps,
} from '../../../../lib/setupStepsExtract';

/**
 * Setup-steps pass: for active listings with no install config we can
 * generate, copy the project's own setup commands out of its README or docs
 * page (lib/setupSteps.ts, lib/setupStepsExtract.ts). Jev picks which code
 * blocks are setup steps; it never writes a command, so what's stored is
 * verbatim from the source.
 *
 * Claims from idx_servers_setup_due (active, install_kind NULL,
 * setup_extracted_at NULL), most viewed first. Every claimed row is stamped,
 * steps or not, so a listing is looked at once; owner/admin steps carry a
 * stamp too, so they never come back here. Jev unavailable releases the
 * claim and stops the run rather than guessing.
 *
 * ?dryRun=1 reads candidates without claiming and returns what it would
 * store, writing nothing (with ?id=<listing> to try one listing).
 */

const DEFAULT_BATCH_SIZE = 6;
const MAX_BATCH_SIZE = 24;
/** README + docs fetches + one Jev call each; bounded per wave for isolate memory. */
const CONCURRENCY = 6;

type Row = {
  id: string;
  name: string;
  url: string;
  description: string;
  websiteUrl: string | null;
  supportUrl: string | null;
};

const rowColumns = {
  id: servers.id,
  name: servers.name,
  url: servers.url,
  description: servers.description,
  websiteUrl: servers.websiteUrl,
  supportUrl: servers.supportUrl,
};

/** Matches idx_servers_setup_due's predicate, so the planner walks that index. */
const dueWhere = and(
  eq(servers.status, 'active'),
  isNull(servers.installKind),
  isNull(servers.setupExtractedAt),
  isNull(servers.staleFlaggedAt),
);

type Result = {
  row: Row;
  outcome: PickOutcome;
  sourceUrl: string | null;
};

export async function POST(req: Request) {
  try {
    if (!(await isCronAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const { env } = await getCloudflareContext();
    if (!(env as any)?.DB) throw new Error('Database binding not found');
    const db = drizzle((env as any).DB);
    const githubToken = getGithubToken(env);

    const url = new URL(req.url);
    const requested = Number(url.searchParams.get('batchSize'));
    const batchSize =
      Number.isFinite(requested) && requested > 0
        ? Math.min(Math.floor(requested), MAX_BATCH_SIZE)
        : DEFAULT_BATCH_SIZE;
    const dryRun = url.searchParams.get('dryRun') === '1';
    const onlyId = url.searchParams.get('id');

    let rows: Row[];
    const claimTime = new Date();
    if (dryRun) {
      rows = await db
        .select(rowColumns)
        .from(servers)
        .where(onlyId ? eq(servers.id, onlyId) : dueWhere)
        .orderBy(desc(servers.views))
        .limit(batchSize);
    } else {
      const ids = (
        await db
          .select({ id: servers.id })
          .from(servers)
          .where(dueWhere)
          .orderBy(desc(servers.views))
          .limit(batchSize)
      ).map((r) => r.id);
      // The UPDATE re-checks the stamp, so overlapping runs can't both claim a row.
      rows =
        ids.length === 0
          ? []
          : await db
              .update(servers)
              .set({ setupExtractedAt: claimTime })
              .where(
                and(inArray(servers.id, ids), isNull(servers.setupExtractedAt)),
              )
              .returning(rowColumns);
    }

    const results: Result[] = [];
    let unavailable = false;
    for (let i = 0; i < rows.length && !unavailable; i += CONCURRENCY) {
      const wave = await Promise.all(
        rows.slice(i, i + CONCURRENCY).map(async (row): Promise<Result> => {
          const source = await fetchSetupSource(row, githubToken);
          if (!source)
            return { row, outcome: { status: 'none' }, sourceUrl: null };
          const outcome = await pickSetupSteps({
            name: row.name,
            url: row.url,
            description: row.description,
            source,
          });
          return { row, outcome, sourceUrl: source.url };
        }),
      );
      results.push(...wave);
      if (wave.some((r) => r.outcome.status === 'unavailable'))
        unavailable = true;
    }

    const found = results.filter((r) => r.outcome.status === 'ok');
    const none = results.filter((r) => r.outcome.status === 'none');
    const done = new Set(results.map((r) => r.row.id));
    // Jev down, or left unprocessed after it went down: back in the queue.
    const release = rows
      .filter(
        (r) =>
          !done.has(r.id) ||
          results.some(
            (x) => x.row.id === r.id && x.outcome.status === 'unavailable',
          ),
      )
      .map((r) => r.id);

    if (!dryRun) {
      for (const r of found) {
        if (r.outcome.status !== 'ok') continue;
        await db
          .update(servers)
          .set({
            setupSteps: serializeSetupSteps(r.outcome.steps),
            setupSourceUrl: r.sourceUrl,
            setupSource: 'extracted',
            setupNote: null,
          })
          .where(
            and(
              eq(servers.id, r.row.id),
              // An owner or admin may have saved steps since the claim.
              or(
                isNull(servers.setupSource),
                eq(servers.setupSource, 'extracted'),
              ),
            ),
          );
      }
      if (release.length > 0) {
        await db
          .update(servers)
          .set({ setupExtractedAt: null })
          .where(
            and(
              inArray(servers.id, release),
              eq(servers.setupExtractedAt, claimTime),
            ),
          );
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      claimed: rows.length,
      found: found.length,
      none: none.length,
      released: release.length,
      jevUnavailable: unavailable,
      // A short batch means the backlog is empty (CronJob.drainable); a Jev
      // outage also stops the tick's remaining runs.
      drained: rows.length < batchSize || unavailable,
      ...(dryRun
        ? {
            results: results.map((r) => ({
              id: r.row.id,
              source: r.sourceUrl,
              status: r.outcome.status,
              steps: r.outcome.status === 'ok' ? r.outcome.steps : undefined,
            })),
          }
        : {}),
      message: `Setup steps: found ${found.length} of ${rows.length} claimed, none ${none.length}, released ${release.length}${unavailable ? ' (Jev unavailable)' : ''}.`,
    });
  } catch (error: any) {
    console.error(
      'Setup steps cron error:',
      error,
      error?.cause?.message ?? '',
    );
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
