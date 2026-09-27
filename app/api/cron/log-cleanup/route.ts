import { getCloudflareContext } from '@opennextjs/cloudflare';
import { lt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { apiAccessLogs, impressionLogs } from '../../../../db/schema';
import { isCronAuthorized } from '../../../../lib/cronAuth';

/**
 * 45-day retention cleanup for high-volume append-only log tables
 * (impression_logs and api_access_logs).
 *
 * Owner analytics only query a 30-day window (see lib/analytics.ts and lib/siteStats.ts).
 * Without retention, these tables grow indefinitely with 3+ indexes each, driving up
 * D1 table storage, WAL/Time-Travel history storage ($0.75/GB-mo), and index write overhead.
 * Runs daily at 03:00 UTC (see custom-worker.ts SLOW_JOBS).
 */
const RETENTION_DAYS = 45;

export async function POST(req: Request) {
  try {
    if (!(await isCronAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    let env: CloudflareEnv | undefined;
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
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    await Promise.all([
      db.delete(impressionLogs).where(lt(impressionLogs.createdAt, cutoff)),
      db.delete(apiAccessLogs).where(lt(apiAccessLogs.createdAt, cutoff)),
    ]);

    return NextResponse.json({
      success: true,
      retentionDays: RETENTION_DAYS,
      cutoff: cutoff.toISOString(),
      message: `Pruned log rows older than ${RETENTION_DAYS} days.`,
    });
  } catch (error) {
    console.error('[log-cleanup] cron failed:', error);
    return NextResponse.json({ error: 'Log cleanup failed.' }, { status: 500 });
  }
}
