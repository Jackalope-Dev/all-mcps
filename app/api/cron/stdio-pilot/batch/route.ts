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
 * Claims are sent as db.batch() — one INSERT statement per candidate,
 * bundled into a single round-trip — rather than one multi-row VALUES
 * insert. Confirmed in practice: D1 has a hard cap on bound variables per
 * statement well below what a batch of ~20-40 rows needs ("too many SQL
 * variables" from SQLite), so a single big multi-row insert fails outright
 * at this scale. batch() avoids that ceiling entirely since each statement
 * is small, while still executing as one D1 call.
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

    // Overselect a little — some candidates will lose the claim race under
    // concurrent requests, and we'd rather still return close to batchSize.
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
      .limit(Math.min(batchSize * 2, MAX_BATCH_SIZE * 2));

    if (rows.length === 0) {
      return NextResponse.json({ success: true, batch: [], count: 0 });
    }

    const now = new Date();
    const claimStatements = rows.map((r) =>
      db
        .insert(stdioVerificationPilot)
        .values({ serverId: r.id, status: 'pending', checkedAt: now })
        .onConflictDoNothing({ target: stdioVerificationPilot.serverId })
        .returning({ serverId: stdioVerificationPilot.serverId })
    );
    // db.batch() requires a non-empty tuple type that a dynamically-built
    // array can't structurally satisfy — rows.length > 0 is already
    // guaranteed above (empty-rows returns early).
    const claimResults = await db.batch(claimStatements as any);

    const claimedIds = new Set(
      claimResults.flatMap((r: any) => (Array.isArray(r) ? r.map((row) => row.serverId) : []))
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

    return NextResponse.json({ success: true, batch, count: batch.length });
  } catch (error: any) {
    console.error('stdio-pilot batch error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
