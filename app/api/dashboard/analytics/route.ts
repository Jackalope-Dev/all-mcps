import { getCloudflareContext } from '@opennextjs/cloudflare';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { servers } from '@/db/schema';
import { getServerAnalytics, getServerAnalyticsBatch } from '@/lib/analytics';
import { auth } from '@/lib/auth';

import { isFeaturedListing } from '@/lib/featuredStatus';

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
  const days = Math.min(
    Math.max(parseInt(searchParams.get('days') || '30', 10), 1),
    90,
  );

  let ctx: Awaited<ReturnType<typeof getCloudflareContext>> | undefined;
  try {
    ctx = await getCloudflareContext();
  } catch {
    return NextResponse.json(
      { error: 'Could not get Cloudflare context' },
      { status: 500 },
    );
  }

  if (!ctx?.env || !(ctx.env as any).DB) {
    return NextResponse.json(
      { error: 'Database not available' },
      { status: 500 },
    );
  }

  const db = drizzle((ctx.env as any).DB);

  // Verify the user owns the requested server(s)
  const ownedRows = await db
    .select({
      id: servers.id,
      isPremium: servers.isPremium,
      featuredUntil: servers.featuredUntil,
      categorySponsorUntil: servers.categorySponsorUntil,
    })
    .from(servers)
    .where(eq(servers.ownerUserId, session.user.id));

  const ownedById = new Map(ownedRows.map((r) => [r.id, r]));

  if (serverId) {
    // Detail view for a single server — allowed if premium OR currently boosted
    const owned = ownedById.get(serverId);
    if (!owned) {
      return NextResponse.json({ error: 'Not your server' }, { status: 403 });
    }

    const hasAccess = isFeaturedListing(owned);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Premium or active Boost required for detailed analytics' },
        { status: 403 },
      );
    }

    const analytics = await getServerAnalytics(db, serverId, days);
    const hasActiveBoost = !owned.isPremium && isFeaturedListing(owned);

    return NextResponse.json({
      serverId,
      isPremium: owned.isPremium,
      hasActiveBoost,
      featuredUntil: owned.featuredUntil
        ? owned.featuredUntil.toISOString()
        : null,
      analytics,
    });
  }

  // Batch view for all owned servers — detailed summaries for premium/boosted listings.
  const serverIds = Array.from(ownedById.keys());
  if (serverIds.length === 0) {
    return NextResponse.json({ servers: [] });
  }

  const allowedIds = serverIds.filter((id) =>
    isFeaturedListing(ownedById.get(id)!),
  );
  const summaries =
    allowedIds.length > 0
      ? await getServerAnalyticsBatch(db, allowedIds, days)
      : {};

  return NextResponse.json({
    servers: serverIds.map((id) => {
      const row = ownedById.get(id)!;
      const access = isFeaturedListing(row);
      return {
        id,
        isPremium: row.isPremium,
        hasActiveBoost: !row.isPremium && access,
        analytics: access ? summaries[id] : null,
      };
    }),
  });
}
