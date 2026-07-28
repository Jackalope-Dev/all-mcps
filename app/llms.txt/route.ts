import { getActiveServers } from '@/lib/servers';

export const runtime = 'edge';

export async function GET() {
  const servers = await getActiveServers();

  // Group servers by category
  const categoriesMap: Record<string, typeof servers> = {};
  for (const s of servers) {
    const cat = s.category || 'Uncategorized';
    if (!categoriesMap[cat]) categoriesMap[cat] = [];
    categoriesMap[cat].push(s);
  }

  let content = `# AllMCPs - The Definitive Model Context Protocol Directory\n\n`;
  content += `> AllMCPs (https://allmcps.com) is the open directory of Model Context Protocol (MCP) servers, tools, and integrations for AI agents, Claude Desktop, Cursor, and custom LLMs.\n\n`;

  content += `## Directory Overview\n`;
  content += `- **Total MCP Servers:** ${servers.length}\n`;
  content += `- **Categories:** ${Object.keys(categoriesMap).join(', ')}\n`;
  content += `- **Full Catalog Export:** https://allmcps.com/llms-full.txt\n`;
  content += `- **Agent Search API:** https://allmcps.com/api/v1/search?q={query}\n`;
  content += `- **Remote MCP Server Tool:** https://allmcps.com/api/mcp\n\n`;

  content += `## Categories & Featured Servers\n\n`;

  for (const [category, catServers] of Object.entries(categoriesMap)) {
    content += `### ${category}\n`;
    for (const server of catServers.slice(0, 10)) {
      const installName = server.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      content += `- [${server.name}](https://allmcps.com/mcp/${server.id}): ${server.description} (Package: \`${installName}\`)\n`;
    }
    content += `\n`;
  }

  content += `## Quick Setup Instructions for Agents\n`;
  content += `To install any server in Claude Desktop or compatible AI clients:\n`;
  content += `1. Open your \`claude_desktop_config.json\`.\n`;
  content += `2. Add \`"server-name": { "command": "npx", "args": ["-y", "package-name"] }\` under \`mcpServers\`.\n\n`;

  content += `## Useful Links\n`;
  content += `- Directory Homepage: https://allmcps.com\n`;
  content += `- Categories: https://allmcps.com/categories\n`;
  content += `- MCP Guide: https://allmcps.com/guide\n`;
  content += `- What is MCP: https://allmcps.com/what-is-mcp\n`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
