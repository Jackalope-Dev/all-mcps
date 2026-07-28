import { getActiveServers } from '@/lib/servers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.toLowerCase().trim() || '';
  const category = searchParams.get('category')?.toLowerCase().trim() || '';
  const limitParam = parseInt(searchParams.get('limit') || '20', 10);
  const limit = Math.min(Math.max(1, limitParam), 100);

  let servers = await getActiveServers();

  if (category) {
    servers = servers.filter((s) => s.category.toLowerCase() === category);
  }

  if (query) {
    servers = servers.filter((s) =>
      s.name.toLowerCase().includes(query) ||
      s.description.toLowerCase().includes(query) ||
      s.category.toLowerCase().includes(query)
    );
  }

  const results = servers.slice(0, limit).map((server) => {
    const installName = server.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return {
      id: server.id,
      name: server.name,
      description: server.description,
      category: server.category,
      url: server.url,
      isOfficial: server.isOfficial,
      isVerifiedActive: server.isVerifiedActive,
      upvotes: server.upvotes || 0,
      installName,
      claudeConfigSnippet: {
        mcpServers: {
          [installName]: {
            command: 'npx',
            args: ['-y', installName],
          },
        },
      },
      detailUrl: `https://allmcps.com/mcp/${server.id}`,
      markdownUrl: `https://allmcps.com/mcp/${server.id}.md`,
    };
  });

  return Response.json(
    {
      total: results.length,
      query: query || null,
      category: category || null,
      servers: results,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
