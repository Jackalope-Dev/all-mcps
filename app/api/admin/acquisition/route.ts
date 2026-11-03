import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { getAuthorizedAdminEmail } from '@/lib/adminAuth';
import { buildAcquisitionReport, loadConversions } from '@/lib/conversions';

const ALLOWED_DAYS = new Set([7, 30, 90, 365]);

/** Submissions, purchases and revenue by acquisition source (admin Acquisition tab). */
export async function GET(req: Request) {
  try {
    if (!(await getAuthorizedAdminEmail())) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const requested = Number(new URL(req.url).searchParams.get('days'));
    const days = ALLOWED_DAYS.has(requested) ? requested : 30;

    const { env } = await getCloudflareContext();
    if (!env?.DB) throw new Error('Database binding not found');
    const db = drizzle(env.DB as any);

    const rows = await loadConversions(db, days);
    return NextResponse.json(buildAcquisitionReport(rows, days));
  } catch (error) {
    console.error('Admin acquisition error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
