import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { and, desc, eq, isNotNull, lt, notInArray } from 'drizzle-orm';
import { servers, stdioVerificationPilot } from '../../../../../db/schema';
import { isAdminAuthorized } from '../../../../../lib/adminAuth';
import { parseArgsJson } from '../../../../../lib/installConfig';

/**
 * Hands the E2B stdio-verification pilot (GitHub Actions runner — E2B's SDK
 * doesn't work inside the Workers runtime, see lib/mcpIntrospect.ts's remote-only
 * scope) a batch of stdio listings with a usable cached install hint that
 * haven't been through the pilot yet.
 *
 * Atomically claims what it hands out by inserting a `pending` row per
 * listing before returning — without this, concurrent workers can refetch a
 * page while an earlier worker is still mid-flight on a slow/timing-out
 * listing (nothing in the table excludes it yet) and get handed the same
 * listing twice. Same shape as the atomic-claim pattern in
 * /api/cron/ai-content. /result finalizes the pending row it claimed; a
 * pending row older than PENDING_STALE_MS is treated as an abandoned run
 * (crashed job, killed workflow) and released back into the pool.
 */
const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 100;
const PENDING_STALE_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  try {
    if (!(await isAdminAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const url = new URL(req.url);
    const parsedSize = Number.parseInt(url.searchParams.get('batch_size') ?? '', 10);
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
      .delete(stdioVerificationPilot)
      .where(and(eq(stdioVerificationPilot.status, 'pending'), lt(stdioVerificationPilot.checkedAt, new Date(Date.now() - PENDING_STALE_MS))));

    const rows = await db
      .select({
        id: servers.id,
        name: servers.name,
        installCommand: servers.installCommand,
        installArgs: servers.installArgs,
        installPackage: servers.installPackage,
      })
      .from(servers)
      .where(
        and(
          eq(servers.status, 'active'),
          eq(servers.installKind, 'stdio'),
          isNotNull(servers.installCommand),
          isNotNull(servers.installPackage),
          notInArray(
            servers.id,
            db.select({ id: stdioVerificationPilot.serverId }).from(stdioVerificationPilot)
          )
        )
      )
      .orderBy(desc(servers.views), desc(servers.upvotes))
      .limit(batchSize);

    if (rows.length === 0) {
      return NextResponse.json({ success: true, batch: [], count: 0 });
    }

    const now = new Date();
    await db.insert(stdioVerificationPilot).values(
      rows.map((r) => ({ serverId: r.id, status: 'pending', checkedAt: now }))
    );

    const batch = rows.map((r) => ({
      id: r.id,
      name: r.name,
      installCommand: r.installCommand as string,
      installArgs: parseArgsJson(r.installArgs) ?? [],
      installPackage: r.installPackage as string,
    }));

    return NextResponse.json({ success: true, batch, count: batch.length });
  } catch (error: any) {
    console.error('stdio-pilot batch error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
