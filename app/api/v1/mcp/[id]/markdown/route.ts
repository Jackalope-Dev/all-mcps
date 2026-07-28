import { getServerById, fetchServerReadme, formatServerAsMarkdown } from '@/lib/servers';

export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let { id } = await params;

  // Strip .md extension if present in id parameter
  if (id.endsWith('.md')) {
    id = id.slice(0, -3);
  }

  const server = await getServerById(id);

  if (!server) {
    return new Response('# 404 - MCP Server Not Found\n', {
      status: 404,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  }

  const readme = await fetchServerReadme(server.url);
  const markdown = formatServerAsMarkdown(server, readme);

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
