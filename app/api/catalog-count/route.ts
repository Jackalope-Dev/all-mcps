import { NextResponse } from 'next/server';
import { getCatalogCount } from '../../../lib/catalogCount';

// The site-wide listing count for client components on static pages (the
// config generator), which can't read D1 at build. Same source and cache as
// every server-rendered count.
export const dynamic = 'force-dynamic';

export async function GET() {
  const catalog = await getCatalogCount();
  if (!catalog) {
    return NextResponse.json(
      { error: 'catalog_count_unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return NextResponse.json(catalog, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=900',
    },
  });
}
