import { getServerById, fetchServerReadme } from '@/lib/servers';
import { computeQualityScore } from '@/lib/qualityScore';

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
  const quality = computeQualityScore(server);

  return Response.json(
    {
      server: {
        ...server,
        installName,
        qualityScore: quality.score,
        qualityTier: quality.tier,
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
