import { getActiveServersForScoring } from '@/lib/servers';

/**
 * Public, structured export of the whole directory — a single clean pull for
 * agents, crawlers, and answer engines that want the catalog as data rather than
 * scraping HTML. Advertised via Dataset JSON-LD on the homepage and linked from
 * llms.txt so it's discoverable as a citable source.
 */
export async function GET() {
  const servers = await getActiveServersForScoring();

  const payload = {
    name: 'AllMCPs — Model Context Protocol Server Directory',
    description:
      'Structured export of every active MCP (Model Context Protocol) server listed on AllMCPs, including categories, descriptions, install identifiers, and directory links.',
    url: 'https://allmcps.com',
    documentation: 'https://allmcps.com/llms.txt',
    license: 'https://allmcps.com/terms',
    generatedAt: new Date().toISOString(),
    count: servers.length,
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
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
