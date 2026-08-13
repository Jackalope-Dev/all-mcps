import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { and, asc, eq, isNotNull, or } from 'drizzle-orm';
import { servers } from '../../../../db/schema';
import { isAdminAuthorized } from '../../../../lib/adminAuth';
import { mapToOsvEcosystem, osvQueryBatch, osvGetSeverity } from '../../../../lib/vulnScan';

/**
 * Supply-chain vulnerability signal — periodic OSV.dev scan of each listing's
 * install package. See components/ui/VulnSignalCard.tsx for the deliberately
 * calm, non-alarmist presentation this feeds, and lib/qualityScore.ts for how
 * lightly (and only for high/critical findings) it affects the quality score.
 *
 * Two-phase because OSV's batch endpoint only confirms *which* advisory ids
 * exist per package (no severity) — severity needs a follow-up per-id detail
 * call, and many listings share the same transitive-dependency CVEs, so the
 * unique-id detail fanout is usually much smaller than the listing count.
 */

// One querybatch call covers the whole batch regardless of size — the real
// cost driver is the detail-fetch fanout below, capped independently.
const BATCH_SIZE = 150;
// Per-tick cap on unique-advisory detail fetches. A listing whose full id set
// can't be resolved within this cap is left unscanned this tick (vulnScannedAt
// stays untouched) and naturally rolls to the next tick via the oldest-first
// cursor, rather than being silently under-counted and looking falsely clean.
const MAX_DETAIL_FETCHES = 300;
const DETAIL_FETCH_CONCURRENCY = 10;

const MAPPABLE_INSTALL_COMMANDS = ['npx', 'bunx', 'npm', 'uvx', 'pip', 'pip3', 'python', 'python3'];

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function POST(req: Request) {
  try {
    if (!(await isAdminAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      throw new Error('Could not get Cloudflare context.');
    }
    if (!env?.DB) {
      throw new Error('Database binding not found');
    }
    const db = drizzle(env.DB as any);

    // Filtered at the SQL level to only installCommand values vuln scanning can
    // map to an OSV ecosystem — otherwise docker/remote-only listings (whose
    // vulnScannedAt stays null forever, since they're never scanned) would sort
    // first under asc(vulnScannedAt) on every tick and starve out real npm/PyPI
    // listings from ever being reached.
    const batch = await db
      .select()
      .from(servers)
      .where(
        and(
          eq(servers.status, 'active'),
          isNotNull(servers.installPackage),
          or(...MAPPABLE_INSTALL_COMMANDS.map((c) => eq(servers.installCommand, c)))
        )
      )
      .orderBy(asc(servers.vulnScannedAt))
      .limit(BATCH_SIZE);

    if (batch.length === 0) {
      return NextResponse.json({ success: true, message: 'No scannable listings.' });
    }

    const mapped = batch
      .map((s) => ({ server: s, eco: mapToOsvEcosystem(s) }))
      .filter((m): m is { server: (typeof batch)[number]; eco: NonNullable<ReturnType<typeof mapToOsvEcosystem>> } => m.eco != null);

    if (mapped.length === 0) {
      return NextResponse.json({ success: true, message: 'No scannable listings in this batch.' });
    }

    const osvResults = await osvQueryBatch(mapped.map((m) => m.eco));

    const idsByServer = mapped.map((m, i) => (osvResults[i]?.vulns || []).map((v) => v.id));
    const uniqueIds = [...new Set(idsByServer.flat())].sort();
    const idsToResolve = uniqueIds.slice(0, MAX_DETAIL_FETCHES);
    const resolvedSet = new Set(idsToResolve);

    const severities = await mapWithConcurrency(idsToResolve, DETAIL_FETCH_CONCURRENCY, osvGetSeverity);
    const severityById = new Map(idsToResolve.map((id, i) => [id, severities[i]]));

    const now = new Date();
    let scanned = 0;
    let deferred = 0;

    for (let i = 0; i < mapped.length; i++) {
      const { server, eco } = mapped[i];
      const ids = idsByServer[i];

      // If any of this listing's advisory ids fell outside this tick's detail-
      // fetch cap, don't mark it scanned — pick it up again next tick instead
      // of publishing an incomplete (falsely lower) count.
      const allResolved = ids.every((id) => resolvedSet.has(id));
      if (!allResolved) {
        deferred++;
        continue;
      }

      const counts = { critical: 0, high: 0, medium: 0, low: 0 };
      for (const id of ids) {
        const sev = severityById.get(id) || 'low';
        counts[sev]++;
      }

      await db
        .update(servers)
        .set({
          vulnEcosystem: eco.ecosystem,
          vulnCriticalCount: counts.critical,
          vulnHighCount: counts.high,
          vulnMediumCount: counts.medium,
          vulnLowCount: counts.low,
          vulnScannedAt: now,
        })
        .where(eq(servers.id, server.id));
      scanned++;
    }

    return NextResponse.json({
      success: true,
      processed: mapped.length,
      scanned,
      deferred,
      uniqueAdvisoriesSeen: uniqueIds.length,
      uniqueAdvisoriesResolved: idsToResolve.length,
    });
  } catch (error) {
    console.error('Vuln scan cron error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
