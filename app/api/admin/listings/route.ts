import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { and, count, desc, eq, gt, like, or } from 'drizzle-orm';
import { servers } from '@/db/schema';
import { getAuthorizedAdminEmail } from '@/lib/accessAuth';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

export async function GET(req: Request) {
  try {
    if (!(await getAuthorizedAdminEmail(req.headers))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const url = new URL(req.url);
    const search = (url.searchParams.get('search') || '').trim();
    const status = url.searchParams.get('status') || 'all';
    const premium = url.searchParams.get('premium');
    const featured = url.searchParams.get('featured');
    const health = url.searchParams.get('health');
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(url.searchParams.get('limit')) || DEFAULT_LIMIT)
    );

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

    const conditions = [];
    if (status !== 'all') {
      conditions.push(eq(servers.status, status));
    }
    if (search) {
      conditions.push(or(like(servers.name, `%${search}%`), like(servers.url, `%${search}%`)));
    }
    if (premium === 'true' || premium === 'false') {
      conditions.push(eq(servers.isPremium, premium === 'true'));
    }
    if (featured === 'true') {
      conditions.push(gt(servers.featuredUntil, new Date()));
    }
    if (health) {
      conditions.push(eq(servers.healthStatus, health));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalRows] = await Promise.all([
      db.select().from(servers).where(where).orderBy(desc(servers.createdAt)).limit(limit).offset(offset),
      db.select({ total: count() }).from(servers).where(where),
    ]);

    return NextResponse.json({
      items: items.map((s: typeof items[number]) => ({
        ...s,
        createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
        featuredUntil: s.featuredUntil instanceof Date ? s.featuredUntil.toISOString() : s.featuredUntil,
      })),
      total: totalRows[0]?.total ?? 0,
    });
  } catch (error) {
    console.error('Admin listings error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
