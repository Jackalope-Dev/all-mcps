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

  const ownedById = new Map(ownedRows.map((r) => [r.id, r]));

  if (serverId) {
    // Detail view for a single server — premium is per-listing (Stripe checkout
    // targets one serverId), so gate on *this* server's status, not whether the
    // caller owns some other premium listing.
    const owned = ownedById.get(serverId);
    if (!owned) {
      return NextResponse.json({ error: 'Not your server' }, { status: 403 });
    }
    if (!owned.isPremium) {
      return NextResponse.json({ error: 'Premium required for detailed analytics' }, { status: 403 });
    }

    const analytics = await getServerAnalytics(db, serverId, days);

    return NextResponse.json({
      serverId,
      isPremium: true,
      analytics,
    });
  }

  // Batch view for all owned servers — detailed summaries only for premium listings.
  const serverIds = Array.from(ownedById.keys());
  if (serverIds.length === 0) {
    return NextResponse.json({ servers: [] });
  }

  const premiumIds = serverIds.filter((id) => ownedById.get(id)!.isPremium);
  const summaries = premiumIds.length > 0 ? await getServerAnalyticsBatch(db, premiumIds, days) : {};

  return NextResponse.json({
    servers: serverIds.map((id) => ({
      id,
      isPremium: ownedById.get(id)!.isPremium,
      analytics: ownedById.get(id)!.isPremium ? summaries[id] : null,
    })),
  });
}
