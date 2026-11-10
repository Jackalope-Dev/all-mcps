import { getCatalogCount } from '@/lib/catalogCount';
import { exportUnavailable } from '@/lib/exportUnavailable';
import { type CatalogIndexRow, getCatalogIndexRows } from '@/lib/servers';

/**
 * Public, structured export of the whole directory — a single clean pull for
 * agents, crawlers, and answer engines that want the catalog as data rather than
 * scraping HTML. Advertised via Dataset JSON-LD on the homepage and linked from
 * llms.txt so it's discoverable as a citable source.
 */
export async function GET() {
  let servers: CatalogIndexRow[];
  let catalog: Awaited<ReturnType<typeof getCatalogCount>>;
  try {
    [servers, catalog] = await Promise.all([
      getCatalogIndexRows(),
      getCatalogCount(),
    ]);
  } catch (err) {
    return exportUnavailable('json', err);
  }

  const payload = {
    name: 'AllMCPs — Model Context Protocol Server Directory',
    description:
      'Structured export of every active MCP (Model Context Protocol) server listed on AllMCPs, including categories, descriptions, install identifiers, and directory links.',
    url: 'https://allmcps.com',
    documentation: 'https://allmcps.com/llms.txt',
    license: 'https://allmcps.com/terms',
    generatedAt: new Date().toISOString(),
    // Rows in this export. catalogCount is the site-wide count every page
    // shows (lib/catalogCount.ts); they differ only by listings that changed
    // between the two reads.
    count: servers.length,
    catalogCount: catalog?.count ?? servers.length,
    catalogCountAsOf: catalog?.asOf ?? null,
    servers: servers.map((s) => {
      const installName = s.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category,
        repository: s.url,
        detailUrl: `https://allmcps.com/mcp/${s.id}`,
        markdownUrl: `https://allmcps.com/mcp/${s.id}.md`,
        installName,
      };
    }),
  };

  return Response.json(payload, {
    headers: {
      'Cache-Control': 'public, max-age=900, s-maxage=900',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
