import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { autoDecisions, servers } from '@/db/schema';
import { getAuthorizedAdminEmail } from '@/lib/adminAuth';
import {
  GATE_COPY,
  GATES,
  getGateModes,
  getGateStats,
  getRecentDecisions,
  INGEST_BAR,
  SUBMISSION_BAR,
  setGateMode,
} from '@/lib/autoDecision';
import { refreshListingPageInBackground } from '@/lib/listingPageRefresh';

/**
 * Admin control for the automation gates (lib/autoDecision.ts): their modes,
 * how often they agreed with the admin, what they decided recently, and undo
 * for a live approval.
 */

async function getDb() {
  const ctx = await getCloudflareContext();
  const env = ctx.env as any;
  if (!env?.DB) throw new Error('Database binding not found');
  return drizzle(env.DB as any);
}

export async function GET() {
  try {
    if (!(await getAuthorizedAdminEmail())) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const db = await getDb();
    const [modes, stats] = await Promise.all([
      getGateModes(db),
      getGateStats(db),
    ]);
    const recent = Object.fromEntries(
      await Promise.all(
        GATES.map(async (g) => [g, await getRecentDecisions(db, g)] as const),
      ),
    );
    const ids = [
      ...new Set(
        Object.values(recent).flatMap((r) => r.map((d) => d.serverId)),
      ),
    ];
    // Names and current status for the decision list. Rejected submissions
    // were deleted, so a missing row is expected.
    const names = new Map<string, { name: string; status: string }>();
    for (let i = 0; i < ids.length; i += 90) {
      const rows = await db
        .select({ id: servers.id, name: servers.name, status: servers.status })
        .from(servers)
        .where(inArray(servers.id, ids.slice(i, i + 90)));
      for (const r of rows) names.set(r.id, { name: r.name, status: r.status });
    }
    return NextResponse.json({
      gates: GATES.map((g) => ({
        gate: g,
        ...GATE_COPY[g],
        mode: modes[g],
        bar: g === 'submission' ? SUBMISSION_BAR : INGEST_BAR,
        stats: stats.find((s) => s.gate === g),
        recent: recent[g].map((d) => ({
          id: d.id,
          serverId: d.serverId,
          name: names.get(d.serverId)?.name ?? null,
          currentStatus: names.get(d.serverId)?.status ?? 'deleted',
          decision: d.decision,
          reason: d.reason,
          mode: d.mode,
          actedAt: d.actedAt,
          humanDecision: d.humanDecision,
          undoneAt: d.undoneAt,
          createdAt: d.createdAt,
        })),
      })),
    });
  } catch (error: any) {
    console.error('admin automation GET error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}

const postSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('set_mode'),
    gate: z.enum(GATES),
    mode: z.enum(['off', 'shadow', 'live']),
  }),
  z.object({
    action: z.literal('undo'),
    gate: z.enum(GATES),
    serverId: z.string().min(1),
  }),
]);

export async function POST(req: Request) {
  try {
    const admin = await getAuthorizedAdminEmail();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const parsed = postSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
    const db = await getDb();
    const body = parsed.data;

    if (body.action === 'set_mode') {
      await setGateMode(db, body.gate, body.mode, admin);
      return NextResponse.json({ success: true, mode: body.mode });
    }

    // Undo a live approval: back to pending, where it reappears in the triage
    // queue. A live reject deleted the row, so there is nothing to restore.
    const [d] = await db
      .select()
      .from(autoDecisions)
      .where(
        and(
          eq(autoDecisions.gate, body.gate),
          eq(autoDecisions.serverId, body.serverId),
          isNotNull(autoDecisions.actedAt),
          isNull(autoDecisions.undoneAt),
        ),
      )
      .limit(1);
    if (!d) {
      return NextResponse.json(
        { error: 'No live decision to undo.' },
        { status: 404 },
      );
    }
    if (d.decision !== 'approve') {
      return NextResponse.json(
        {
          error:
            'A rejected submission was deleted and emailed; it cannot be restored here.',
        },
        { status: 400 },
      );
    }
    const reverted = await db
      .update(servers)
      .set({ status: 'pending' })
      .where(and(eq(servers.id, body.serverId), eq(servers.status, 'active')))
      .returning({ id: servers.id });
    await db
      .update(autoDecisions)
      .set({
        undoneAt: new Date(),
        humanDecision: 'reject',
        humanAt: new Date(),
      })
      .where(eq(autoDecisions.id, d.id));
    if (reverted.length > 0) refreshListingPageInBackground(body.serverId);
    return NextResponse.json({
      success: true,
      message:
        reverted.length > 0
          ? 'Moved back to pending.'
          : 'Marked undone; the listing was no longer active.',
    });
  } catch (error: any) {
    console.error('admin automation POST error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
