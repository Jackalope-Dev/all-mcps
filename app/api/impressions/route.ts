import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { logImpressions, type ImpressionSurface } from '@/lib/impressionLog';

const VALID_SURFACES: Set<string> = new Set([
  'homepage_featured',
  'homepage_marquee',
  'browse_list',
  'browse_grid',
  'search_results',
  'detail_sidebar',
  'category_page',
]);

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as any;
    const { impressions, sessionHash } = body || {};

    if (!Array.isArray(impressions) || impressions.length === 0) {
      return NextResponse.json(
        { error: 'impressions must be a non-empty array' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    if (impressions.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 impressions per batch' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Validate and filter
    const valid = impressions.filter(
      (imp: any) =>
        typeof imp.serverId === 'string' &&
        imp.serverId.length > 0 &&
        typeof imp.surface === 'string' &&
        VALID_SURFACES.has(imp.surface)
    );

    if (valid.length === 0) {
      return NextResponse.json(
        { error: 'No valid impressions in batch' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const ctx = await getCloudflareContext();
    if (!ctx?.env || !(ctx.env as any).DB) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const db = drizzle((ctx.env as any).DB);
    const hash = typeof sessionHash === 'string' ? sessionHash.slice(0, 64) : null;

    // Fire-and-forget via waitUntil
    ctx.ctx.waitUntil(
      logImpressions(
        db,
        valid.map((imp: any) => ({
          serverId: imp.serverId,
          surface: imp.surface as ImpressionSurface,
          sessionHash: hash,
        }))
      )
    );

    return NextResponse.json(
      { ok: true, logged: valid.length },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (err: any) {
    console.error('[impressions] Error:', err?.message);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
