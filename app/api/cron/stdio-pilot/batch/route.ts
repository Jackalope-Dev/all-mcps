import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { and, desc, eq, isNotNull, notInArray } from 'drizzle-orm';
import { servers, stdioVerificationPilot } from '../../../../../db/schema';
import { isAdminAuthorized } from '../../../../../lib/adminAuth';
import { parseArgsJson } from '../../../../../lib/installConfig';

/**
 * Hands the E2B stdio-verification pilot (GitHub Actions runner — E2B's SDK
 * doesn't work inside the Workers runtime, see lib/mcpIntrospect.ts's remote-only
 * scope) a batch of stdio listings with a usable cached install hint that
 * haven't been through the pilot yet. Read-only claim — the pilot POSTs
 * results back to /api/cron/stdio-pilot/result, which is what actually
 * records progress, so a batch can be safely re-requested if a run fails
 * partway through.
 */
const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 100;

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
