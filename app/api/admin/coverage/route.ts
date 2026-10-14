import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { getAuthorizedAdminEmail } from '@/lib/adminAuth';
import { getCatalogCoverage, getDemandGaps } from '@/lib/catalogCoverage';

/** Catalog field coverage and top missed searches for the admin dashboard. */
export async function GET() {
  try {
    if (!(await getAuthorizedAdminEmail())) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const { env } = await getCloudflareContext();
    if (!env?.DB) throw new Error('Database binding not found');
    const db = drizzle(env.DB as any);
    const [coverage, demandGaps] = await Promise.all([
      getCatalogCoverage(db),
      // search_misses arrives in a migration; a database that has not run it
      // yet still gets its coverage numbers.
      getDemandGaps(db).catch(() => []),
    ]);
    return NextResponse.json({ coverage, demandGaps });
  } catch (error) {
    console.error('Admin coverage error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
