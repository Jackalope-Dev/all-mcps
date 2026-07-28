import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { servers } from '@/db/schema';
import { auth } from '@/lib/auth';
import { getServerAnalytics, getServerAnalyticsBatch } from '@/lib/analytics';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/analytics?serverId=xxx
 *
 * If `serverId` is provided, returns detailed analytics for that server.
 * If omitted, returns batch summaries for all servers owned by the user.
 *
 * Requires authentication + the user must own the server(s).
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const serverId = searchParams.get('serverId');
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10), 1), 90);

  let ctx;
  try {
    ctx = await getCloudflareContext();
  } catch {
    return NextResponse.json({ error: 'Could not get Cloudflare context' }, { status: 500 });
  }

  if (!ctx?.env || !(ctx.env as any).DB) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 });
  }

  const db = drizzle((ctx.env as any).DB);

  // Verify the user owns the requested server(s)
  const ownedRows = await db
    .select({ id: servers.id, isPremium: servers.isPremium })
    .from(servers)
    .where(eq(servers.ownerUserId, session.user.id));

  const ownedIds = new Set(ownedRows.map((r) => r.id));
  const isPremiumOwner = ownedRows.some((r) => r.isPremium);

  if (serverId) {
    // Detail view for a single server
    if (!ownedIds.has(serverId)) {
      return NextResponse.json({ error: 'Not your server' }, { status: 403 });
    }

    const analytics = await getServerAnalytics(db, serverId, days);

    return NextResponse.json({
      serverId,
      isPremium: isPremiumOwner,
      analytics,
    });
  }

  // Batch view for all owned servers
  const serverIds = Array.from(ownedIds);
  if (serverIds.length === 0) {
    return NextResponse.json({ servers: [], isPremium: isPremiumOwner });
  }

  const summaries = await getServerAnalyticsBatch(db, serverIds, days);

  return NextResponse.json({
    isPremium: isPremiumOwner,
    servers: serverIds.map((id) => ({
      id,
      analytics: summaries[id],
    })),
  });
}
