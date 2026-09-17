import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { servers, stdioVerifications } from '../../../../../db/schema';
import { isCronAuthorized } from '../../../../../lib/cronAuth';
import { isPackageInstallable } from '../../../../../lib/listingEnrich';
import { decideGuessRetirement } from '../../../../../lib/stdioVerification';
import { formatZodError } from '../../../../../lib/zodError';

/**
 * Records E2B stdio verification outcomes to the standalone
 * `stdio_verifications` table (success-rate/timing/cost history), and —
 * now that the approach is validated (sendStdin race fixed, uvx bootstrapped,
 * claim atomicity fixed, sequenced behind the LLM install validator; see the
 * clean 291-listing run with 0 opaque errors that graduated this) — also
 * promotes 'ok' results into servers.tools/tools_source, the same
 * 'introspected' tier the health cron's live remote handshake writes (see
 * app/api/cron/health/route.ts): a completed stdio tools/list in a real
 * sandbox is just as authoritative as a live HTTP handshake, not a guess.
 *
 * Finalizes the `pending` claim row /batch inserted for this listing rather
 * than inserting a fresh row — keeps one row per attempt and is what makes
 * the batch endpoint's "exclude anything already in this table" claim logic
 * correct. Falls back to inserting if no pending row is found (e.g. the
 * claim was already reclaimed as stale) so a result is never silently lost.
 */
const STATUSES = [
  'ok',
  'install_failed',
  'handshake_failed',
  'timeout',
  'error',
] as const;

const toolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  parameters: z.unknown().optional(),
});

const resultSchema = z.object({
  serverId: z.string().min(1),
  status: z.enum(STATUSES),
  tools: z.array(toolSchema).optional(),
  error: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

const bodySchema = z.union([
  resultSchema,
  z.object({ results: z.array(resultSchema).min(1) }),
]);

export async function POST(req: Request) {
  try {
    if (!(await isCronAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 },
      );
    }
    const results =
      'results' in parsed.data ? parsed.data.results : [parsed.data];

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
    let cleared = 0;
    let needsConfig = 0;
    let discardedStale = 0;

    for (const r of results) {
      // State as it stands *before* this result lands: the consecutive-failure
      // count, the package this attempt was told to install, and whether the
      // listing's install config is an LLM-confirmed value or a heuristic guess.
      const [prior] = await db
        .select({
          failures: stdioVerifications.installFailures,
          testedPackage: stdioVerifications.testedPackage,
          installExtractedAt: servers.installExtractedAt,
          installCommand: servers.installCommand,
          installPackage: servers.installPackage,
        })
        .from(servers)
        .leftJoin(
          stdioVerifications,
          eq(stdioVerifications.serverId, servers.id),
        )
        .where(eq(servers.id, r.serverId))
        .limit(1);

      // Consecutive install failures, reset by any other outcome. A single
      // failure is never enough to retire a guess (registry outage, rate limit,
      // private package all produce one).
      const nextFailures =
        r.status === 'install_failed' ? (prior?.failures ?? 0) + 1 : 0;

      const updated = await db
        .update(stdioVerifications)
        .set({
          status: r.status,
          toolCount: r.tools?.length ?? null,
          tools: r.tools && r.tools.length > 0 ? JSON.stringify(r.tools) : null,
          error: r.error ? r.error.slice(0, 500) : null,
          durationMs: r.durationMs ?? null,
          installFailures: nextFailures,
          checkedAt: now,
        })
        .where(
          and(
            eq(stdioVerifications.serverId, r.serverId),
            eq(stdioVerifications.status, 'pending'),
          ),
        )
        .returning({ id: stdioVerifications.id });

      if (updated.length === 0) {
        // No pending row found (claim was reclaimed as stale, or this is a
        // late/duplicate result from an abandoned run) — upsert on the
        // server_id unique constraint instead of a blind insert, which would
        // otherwise throw if some row for this listing already exists.
        const values = {
          serverId: r.serverId,
          status: r.status,
          toolCount: r.tools?.length ?? null,
          tools: r.tools && r.tools.length > 0 ? JSON.stringify(r.tools) : null,
          error: r.error ? r.error.slice(0, 500) : null,
          durationMs: r.durationMs ?? null,
          checkedAt: now,
        };
        await db.insert(stdioVerifications).values(values).onConflictDoUpdate({
          target: stdioVerifications.serverId,
          set: values,
        });
      }

      if (r.status === 'ok' && r.tools && r.tools.length > 0) {
        await db
          .update(servers)
          .set({
            tools: JSON.stringify(r.tools),
            toolsSource: 'introspected',
            toolsCheckedAt: now,
            toolsError: null,
          })
          .where(eq(servers.id, r.serverId));
      }

      // Installed cleanly, never finished the handshake. That is a statement
      // about configuration (missing API key, required path argument), not
      // about the install command — which just proved itself by installing.
      // Recorded as a positive signal so nothing downstream reads it as a bad
      // install.
      if (r.status === 'handshake_failed') {
        await db
          .update(servers)
          .set({ installNeedsConfig: now })
          .where(eq(servers.id, r.serverId));
        needsConfig++;
      }

      if (r.status !== 'install_failed' || !prior) continue;

      // Everything below is a *deletion*, so the decision itself lives in
      // lib/stdioVerification.ts as a pure function with its own tests. Only
      // ask the registry once the cheap disqualifiers have passed — it is a
      // network call per listing.
      const cheapVerdict = decideGuessRetirement({
        status: r.status,
        installExtractedAt: prior.installExtractedAt,
        testedPackage: prior.testedPackage,
        currentPackage: prior.installPackage,
        failures: nextFailures,
        packageMissing: false,
      });
      if (!cheapVerdict.retire && cheapVerdict.reason === 'stale-result') {
        discardedStale++;
        continue;
      }
      if (
        !cheapVerdict.retire &&
        cheapVerdict.reason !== 'insufficient-evidence'
      ) {
        continue;
      }

      const packageMissing = !(await isPackageInstallable(
        prior.installCommand,
        prior.installPackage,
      ));
      const verdict = decideGuessRetirement({
        status: r.status,
        installExtractedAt: prior.installExtractedAt,
        testedPackage: prior.testedPackage,
        currentPackage: prior.installPackage,
        failures: nextFailures,
        packageMissing,
      });
      if (!verdict.retire) continue;

      await db
        .update(servers)
        .set({
          installKind: null,
          installCommand: null,
          installArgs: null,
          installPackage: null,
          installConfidence: null,
        })
        .where(
          and(
            eq(servers.id, r.serverId),
            // Re-assert both conditions at write time: another request may have
            // confirmed or rewritten this install between the read above and
            // here, and the guess we decided to retire would no longer be what
            // we are deleting.
            isNull(servers.installExtractedAt),
            eq(servers.installPackage, prior.installPackage as string),
          ),
        );
      // The guess is gone; the counter describes a value that no longer exists.
      await db
        .update(stdioVerifications)
        .set({ installFailures: 0, testedPackage: null })
        .where(eq(stdioVerifications.serverId, r.serverId));
      cleared++;
    }

    return NextResponse.json({
      success: true,
      recorded: results.length,
      clearedGuesses: cleared,
      needsConfig,
      discardedStale,
    });
  } catch (error: any) {
    console.error('stdio-verify result error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
