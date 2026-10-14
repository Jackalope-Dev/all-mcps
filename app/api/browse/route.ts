import { browseCatalog } from '@/lib/browse';
import { parseBrowseParams } from '@/lib/browseParams';

/**
 * Search, filter, sort and page the directory for the /browse grid — see
 * lib/browse.ts. On-site UI only (not the public /api/v1 contract), so it is
 * unversioned and not logged as external API access. Responses are short-lived
 * at the edge; lib/browse.ts also caches the ranked page ids for 5 minutes.
 */
export async function GET(request: Request) {
  const params = parseBrowseParams(new URL(request.url).searchParams);
  const result = await browseCatalog(params);
  return Response.json(result, {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=300',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
