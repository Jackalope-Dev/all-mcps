import { getServerById, fetchServerReadme } from '@/lib/servers';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const server = await getServerById(id);

  if (!server) {
    return Response.json(
      { error: 'Server not found' },
      { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const readme = await fetchServerReadme(server.url);
  const installName = server.name.toLowerCase().replace(/[^a-z0-9]/g, '-');

  return Response.json(
    {
      server: {
        ...server,
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
        readme,
      },
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=600, s-maxage=3600',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
