import type { MetadataRoute } from 'next';
import { getSitemapSummary } from '../lib/sitemapHelpers';
import {
  buildCoreSitemap,
  buildListingsSitemap,
  buildSecondarySitemap,
} from '../lib/sitemapShards';

// Rendered per request, with the underlying D1 read cached for an hour in
// `getSitemapSummary` (see lib/sitemapHelpers.ts). This deliberately isn't ISR:
// a revalidate-based sitemap is prerendered at build time, where there's no D1
// binding, so every deploy froze a fallback-shaped sitemap into the cache until
// the first revalidation. Crawlers still don't re-scan D1 on each hit — the
// cache sits on the query rather than on the rendered XML.
export const dynamic = 'force-dynamic';

/** Named sitemap shards so GSC/Bing can prioritize core + listings first. */
export async function generateSitemaps() {
  return [{ id: 'core' }, { id: 'listings' }, { id: 'secondary' }];
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;
  const summary = await getSitemapSummary();

  if (id === 'core') return await buildCoreSitemap(summary);
  if (id === 'listings') return buildListingsSitemap(summary);
  if (id === 'secondary') return buildSecondarySitemap(summary);

  // Unknown shard — return empty rather than mixing priorities.
  return [];
}
