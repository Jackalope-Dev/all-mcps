import { getCloudflareContext } from '@opennextjs/cloudflare';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { servers } from '@/db/schema';
import { auth } from '@/lib/auth';

/**
 * Minimal listing lookup for the signed-in user — lets checkout (and anywhere else that
 * needs "which of my listings is this for?") skip the public directory search entirely.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  try {
    const ctx = await getCloudflareContext();
    const env = ctx?.env as any;
    if (!env?.DB) {
      return NextResponse.json({ listings: [] });
    }

    const db = drizzle(env.DB);
    const rows = await db
      .select({
        id: servers.id,
        name: servers.name,
        category: servers.category,
        status: servers.status,
      })
      .from(servers)
      .where(eq(servers.ownerUserId, userId));

    return NextResponse.json({ listings: rows });
  } catch (e) {
    console.error('Failed to load my-listings:', e);
    return NextResponse.json({ listings: [] });
  }
}
