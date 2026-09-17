import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  and,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { servers, stdioVerifications } from '../../../../../db/schema';
import { isCronAuthorized } from '../../../../../lib/cronAuth';
import { parseArgsJson } from '../../../../../lib/installConfig';

/**
 * Hands the E2B stdio verification run (GitHub Actions runner — E2B's SDK
 * doesn't work inside the Workers runtime, see lib/mcpIntrospect.ts's remote-only
 * scope) a batch of stdio listings with a usable cached install hint: either
 * never tested, or due for a retest (see RETEST_STALE_MS below).
 *
 * Claims what it hands out via INSERT ... ON CONFLICT (server_id) DO NOTHING
 * RETURNING, relying on the unique index on server_id — not a SELECT-then-
 * INSERT sequence. That gap was tried first and confirmed broken in practice:
 * two overlapping requests to this route can both run their SELECT before
 * either commits an INSERT, so both "claim" the same listing. A DB-level
 * uniqueness constraint is the only thing that closes that window reliably;
 * ON CONFLICT DO NOTHING RETURNING tells each request exactly which of the
 * rows it proposed actually became its own (silently drops the rest, no
 * error, no separate check needed).
 *
 * /result finalizes the pending row it claimed. A pending row older than
 * PENDING_STALE_MS is treated as an abandoned run (crashed job, killed
 * workflow) and released back into the pool.
 *
 * Claims are sent as db.batch() — one INSERT (never-tested) or UPDATE
 * (retest) statement per candidate, bundled into a single round-trip —
 * rather than one multi-row VALUES insert. Confirmed in practice: D1 has a
 * hard cap on bound variables per statement well below what a batch of
 * ~20-40 rows needs ("too many SQL variables" from SQLite), so a single big
 * multi-row insert fails outright at this scale. batch() avoids that
 * ceiling entirely since each statement is small, while still executing as
 * one D1 call.
 *
 * A listing isn't excluded forever just because it has a verification row —
 * eligible for retest when either the LLM install validator re-confirmed
 * its install config since the last check (a real signal something may
 * have changed, not a guess) or the last check is old enough that the
 * package itself could have changed upstream even without our data
 * changing. Both are deliberately conservative (retest, not "assume
 * broken") — see RETEST_STALE_MS.
 */
const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 100;
const PENDING_STALE_MS = 10 * 60 * 1000;
/** Safety-net retest window for listings whose install config hasn't visibly changed. */
const RETEST_STALE_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * Retest window for heuristic guesses, which are retested to *disprove* them
 * rather than to re-confirm a known-good value. Shorter than RETEST_STALE_MS
 * because clearing a wrong guess needs two failures on separate runs, and 30
 * days per attempt would leave a bad install command on the page for two
 * months. Still long enough that the two attempts can't share one bad night at
 * a package registry.
 */
const GUESS_RETEST_STALE_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    if (!(await isCronAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const url = new URL(req.url);
    const parsedSize = Number.parseInt(
      url.searchParams.get('batch_size') ?? '',
      10,
    );
    const batchSize = Number.isFinite(parsedSize)
      ? Math.min(Math.max(parsedSize, 1), MAX_BATCH_SIZE)
      : DEFAULT_BATCH_SIZE;

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      throw new Error('Could not get Cloudflare context.');
    }
    if (!env?.DB) throw new Error('Database binding not found');

    const db = drizzle(env.DB as any);

    // Release abandoned claims (worker/job died before posting a result) so
    // they're eligible for selection again instead of being stuck forever.
    await db
      .delete(stdioVerifications)
      .where(
        and(
          eq(stdioVerifications.status, 'pending'),
          lt(
            stdioVerifications.checkedAt,
            new Date(Date.now() - PENDING_STALE_MS),
          ),
        ),
      );

    // Overselect a little — some candidates will lose the claim race under
    // concurrent requests, and we'd rather still return close to batchSize.
    // LEFT JOIN (not the old notInArray exclusion) so a listing's verification
    // history is visible per-row for the retest-eligibility check below,
    // instead of just being a blanket "already has a row, skip forever".
    const retestCutoff = new Date(Date.now() - RETEST_STALE_MS);
    const guessRetestCutoff = new Date(Date.now() - GUESS_RETEST_STALE_MS);
    const rows = await db
      .select({
        id: servers.id,
        name: servers.name,
        installCommand: servers.installCommand,
        installArgs: servers.installArgs,
        installPackage: servers.installPackage,
        verifyStatus: stdioVerifications.status,
      })
      .from(servers)
      .leftJoin(stdioVerifications, eq(stdioVerifications.serverId, servers.id))
      .where(
        and(
          eq(servers.status, 'active'),
          eq(servers.installKind, 'stdio'),
          isNotNull(servers.installCommand),
          isNotNull(servers.installPackage),
          // Two tiers, ordered below so LLM-confirmed installs always go first:
          //
          //  1. installExtractedAt set — the LLM validator (lib/aiContent.ts)
          //     confirmed this install config. Testing these proves tools.
          //  2. installExtractedAt null — a heuristic guess. Testing these
          //     disproves bad ones: repeated install_failed is what retires a
          //     guess nothing else would ever catch (see ../result).
          //
          // Tier 2 used to be excluded outright, because the validator rewrites
          // and nulls guesses on its own 4h cron and was discarding rows out
          // from under a slow sandbox run — 80% of one verification batch had
          // already gone null in servers by the time results came back. The fix
          // is not to avoid testing them but to record which package was tested
          // (tested_package below) so a stale verdict is dropped on arrival
          // rather than acted on.
          or(
            isNull(stdioVerifications.id), // never tested
            and(
              // Never reclaim a row another worker/run currently has claimed —
              // PENDING_STALE_MS above already handles abandoned claims.
              ne(stdioVerifications.status, 'pending'),
              or(
                gt(servers.installExtractedAt, stdioVerifications.checkedAt),
                lt(stdioVerifications.checkedAt, retestCutoff),
                // Guesses come back around faster, and only while they still
                // look wrong — an 'ok' result is left alone on the slow window.
                and(
                  isNull(servers.installExtractedAt),
                  eq(stdioVerifications.status, 'install_failed'),
                  lt(stdioVerifications.checkedAt, guessRetestCutoff),
                ),
              ),
            ),
          ),
        ),
      )
      // LLM-confirmed installs before heuristic guesses, so a finite sandbox
      // budget always buys proven tools before it buys speculative cleanup.
      // Within each tier, never-tested first (nothing beats first-time
      // coverage), then by popularity.
      .orderBy(
        sql`CASE WHEN ${servers.installExtractedAt} IS NULL THEN 1 ELSE 0 END`,
        sql`CASE WHEN ${stdioVerifications.id} IS NULL THEN 0 ELSE 1 END`,
        desc(servers.views),
        desc(servers.upvotes),
      )
      .limit(Math.min(batchSize * 2, MAX_BATCH_SIZE * 2));

    if (rows.length === 0) {
      return NextResponse.json({ success: true, batch: [], count: 0 });
    }

    const now = new Date();
    const claimStatements = rows.map((r) =>
      r.verifyStatus == null
        ? db
            .insert(stdioVerifications)
            .values({
              serverId: r.id,
              status: 'pending',
              checkedAt: now,
              // What this attempt is actually about to install. The result
              // endpoint compares it against the listing's current value and
              // discards the verdict if the validator moved it meanwhile.
              testedPackage: r.installPackage,
            })
            .onConflictDoNothing({ target: stdioVerifications.serverId })
            .returning({ serverId: stdioVerifications.serverId })
        : // Retest: atomically flip the existing row back to 'pending' only if
          // no one else already has — same race-safety property as the INSERT's
          // ON CONFLICT DO NOTHING above (whichever request's UPDATE commits
          // first wins; the other's WHERE no longer matches and returns 0 rows).
          db
            .update(stdioVerifications)
            .set({
              status: 'pending',
              checkedAt: now,
              testedPackage: r.installPackage,
            })
            .where(
              and(
                eq(stdioVerifications.serverId, r.id),
                ne(stdioVerifications.status, 'pending'),
              ),
            )
            .returning({ serverId: stdioVerifications.serverId }),
    );
    // db.batch() requires a non-empty tuple type that a dynamically-built
    // array can't structurally satisfy — rows.length > 0 is already
    // guaranteed above (empty-rows returns early).
    const claimResults = await db.batch(claimStatements as any);

    const claimedIds = new Set(
      claimResults.flatMap((r: any) =>
        Array.isArray(r) ? r.map((row) => row.serverId) : [],
      ),
    );
    const batch = rows
      .filter((r) => claimedIds.has(r.id))
      .slice(0, batchSize)
      .map((r) => ({
        id: r.id,
        name: r.name,
        installCommand: r.installCommand as string,
        installArgs: parseArgsJson(r.installArgs) ?? [],
        installPackage: r.installPackage as string,
      }));

    // The overselect above claims up to batchSize*2 candidates for claim-race
    // headroom, but only batchSize are ever handed to a caller — the rest sat
    // 'pending' and unreachable until PENDING_STALE_MS next got them released
    // (confirmed in practice: a single-page request stranded 100 rows this
    // way). Release them immediately instead of leaving that gap.
    //
    // For a stranded retest candidate this deletes its prior result rather
    // than restoring it — the listing just looks "never tested" again until
    // it's reselected, which only costs one extra sandbox run, not a
    // correctness problem (servers.tools was already promoted independently
    // on any prior 'ok'). Not worth the added complexity of tracking/
    // restoring each row's pre-claim status for a self-healing edge case.
    //
    // One DELETE per row via db.batch(), not a single inArray(...) — D1 hard-
    // caps bound parameters at 100/query (see 588406c, same limit that broke
    // the claim insert originally). Up to ~100 stranded ids in one inArray
    // reliably hit that cap again here, 500ing the whole response and
    // stranding the claims with no batch ever reaching a caller (confirmed in
    // practice: 200 claimed, 0 processed, release never ran).
    const returnedIds = new Set(batch.map((b) => b.id));
    const strandedIds = [...claimedIds].filter(
      (id) => !returnedIds.has(id as string),
    );
    if (strandedIds.length > 0) {
      const releaseStatements = strandedIds.map((id) =>
        db
          .delete(stdioVerifications)
          .where(
            and(
              eq(stdioVerifications.serverId, id as string),
              eq(stdioVerifications.status, 'pending'),
            ),
          ),
      );
      await db.batch(releaseStatements as any);
    }

    return NextResponse.json({ success: true, batch, count: batch.length });
  } catch (error: any) {
    console.error('stdio-verify batch error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
