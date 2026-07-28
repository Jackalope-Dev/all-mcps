import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { getAuthorizedAdminEmail } from '@/lib/accessAuth';
import { getAdminStats } from '@/lib/adminStats';

export async function GET(req: Request) {
  try {
    if (!(await getAuthorizedAdminEmail(req.headers))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    let env;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch (e) {
      throw new Error('Could not get Cloudflare context.');
    }

    if (!env || !env.DB) {
      throw new Error('Database binding not found');
    }

    const db = drizzle(env.DB as any);
    const stats = await getAdminStats(db);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
