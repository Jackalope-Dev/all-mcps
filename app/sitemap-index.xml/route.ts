import { NextResponse } from 'next/server';
import {
  getSitemapServers,
  maxServerLastMod,
  STATIC_PAGE_LASTMOD,
  safeDateISO,
} from '../../lib/sitemapHelpers';

// Lives at /sitemap-index.xml (not /sitemap.xml) because a route folder
// literally named "sitemap.xml" collides with the app/sitemap.ts metadata
// convention's reserved route slot, even though generateSitemaps() only
// serves content at /sitemap/[id].xml. next.config.ts rewrites the public
// /sitemap.xml URL to this route so the external contract (robots.txt, GSC
// submission) is unaffected.
export async function GET() {
  const servers = await getSitemapServers();
  const coreLastMod = safeDateISO(STATIC_PAGE_LASTMOD['/'] ?? '2026-08-01');
  const listingsLastMod = maxServerLastMod(servers);
  const secondaryLastMod = listingsLastMod;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://allmcps.com/sitemap/core.xml</loc>
    <lastmod>${coreLastMod}</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://allmcps.com/sitemap/listings.xml</loc>
    <lastmod>${listingsLastMod}</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://allmcps.com/sitemap/secondary.xml</loc>
    <lastmod>${secondaryLastMod}</lastmod>
  </sitemap>
</sitemapindex>
`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
