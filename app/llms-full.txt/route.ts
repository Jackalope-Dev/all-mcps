import { getActiveServers, formatServerAsMarkdown } from '@/lib/servers';

export async function GET() {
  const servers = await getActiveServers();

  let content = `# AllMCPs - Complete Catalog Export (LLM Format)\n\n`;
  content += `> Full database snapshot of all Model Context Protocol (MCP) servers listed on https://allmcps.com.\n`;
  content += `> Generated: ${new Date().toISOString()}\n\n`;

  for (const server of servers) {
    content += formatServerAsMarkdown(server);
    content += `\n---\n\n`;
  }

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
