import { NextResponse } from 'next/server';
import { getSiteStats } from '../../../lib/siteStats';

// Same root cause app/trust/page.tsx documents: D1 isn't reachable during the
// build-time prerender of an ISR page, so baking live stats straight into a
// `revalidate`-based page (like the homepage) freezes them to the zeroed
// build-time fallback until a background revalidation succeeds — and frequent
// deploys can reset the build id faster than the revalidate window elapses,
// so it may never happen. Unlike /trust, the homepage intentionally stays
// static (see app/page.tsx's revalidate=300 for CDN response times), so
// instead of force-dynamic on the whole page, StatsBanner fetches this route
// client-side on mount to self-correct without regressing that shell caching.
export const dynamic = 'force-dynamic';

export async function GET() {
  const stats = await getSiteStats();
  return NextResponse.json(stats, { headers: { 'Cache-Control': 'no-store' } });
}
