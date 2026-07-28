import { getActiveServers, getServerById, formatServerAsMarkdown } from '@/lib/servers';
import { logApiAccess, extractRequestMeta } from '@/lib/accessLog';

const SERVER_INFO = {
  name: 'AllMCPs Directory Server',
  version: '1.0.0',
};

const TOOLS = [
  {
    name: 'search_mcp_servers',
    description: 'Search the AllMCPs directory for Model Context Protocol (MCP) servers by keyword or category.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term (e.g., "github", "postgres", "slack", "database")' },
        category: { type: 'string', description: 'Optional category name to filter by' },
        limit: { type: 'number', description: 'Max number of results to return (default: 10)' },
      },
    },
  },
  {
    name: 'get_mcp_install_config',
    description: 'Get the exact claude_desktop_config.json setup snippet and documentation for a specific MCP server by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The server ID (e.g. "github-mcp", "sqlite-mcp")' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_mcp_categories',
    description: 'List all categories available in the AllMCPs directory along with server counts.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET() {
  return Response.json(
    {
      status: 'active',
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
      mcpEndpoint: 'https://allmcps.com/api/mcp',
      description: 'Model Context Protocol Remote Server endpoint. Send POST JSON-RPC 2.0 requests to query tools.',
      tools: TOOLS.map((t) => t.name),
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
}

export async function POST(request: Request) {
  async function logMcp(serverId: string | null, tool: string) {
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const cfCtx = await getCloudflareContext();
      if (cfCtx?.env && (cfCtx.env as any).DB) {
        const logDb = (await import('drizzle-orm/d1')).drizzle((cfCtx.env as any).DB);
        const meta = extractRequestMeta(request);
        cfCtx.ctx.waitUntil(logApiAccess(logDb, {
          serverId,
          endpoint: 'mcp_jsonrpc',
          methodOrTool: tool,
          userAgent: meta.userAgent,
          ipCountry: meta.ipCountry,
        }));
      }
    } catch { /* best-effort */ }
  }

  try {
    const body = (await request.json()) as any;
    const { jsonrpc, id, method, params } = body || {};

    if (jsonrpc !== '2.0') {
      return Response.json(
        { jsonrpc: '2.0', id: id || null, error: { code: -32600, message: 'Invalid Request: jsonrpc must be 2.0' } },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Handle MCP initialize request
    if (method === 'initialize') {
      const clientName = params?.clientInfo?.name;
      const methodOrTool = clientName ? `initialize (${clientName})` : 'initialize';
      await logMcp(null, methodOrTool);
      return Response.json(
        {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: SERVER_INFO,
          },
        },
        { headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Handle MCP notifications/initialized
    if (method === 'notifications/initialized') {
      return Response.json(
        { jsonrpc: '2.0', id: null, result: {} },
        { headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Handle MCP tools/list
    if (method === 'tools/list') {
      return Response.json(
        {
          jsonrpc: '2.0',
          id,
          result: {
            tools: TOOLS,
          },
        },
        { headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Handle MCP tools/call
    if (method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};

      if (toolName === 'search_mcp_servers') {
        const query = (args.query || '').toLowerCase().trim();
        const category = (args.category || '').toLowerCase().trim();
        const limit = Math.min(Math.max(1, args.limit || 10), 50);

        let servers = await getActiveServers();

        if (category) {
          servers = servers.filter((s) => s.category.toLowerCase() === category);
        }

        if (query) {
          servers = servers.filter(
            (s) =>
              s.name.toLowerCase().includes(query) ||
              s.description.toLowerCase().includes(query) ||
              s.category.toLowerCase().includes(query)
          );
        }

        const results = servers.slice(0, limit);
        const textOutput = results.length > 0
          ? results.map((s) => formatServerAsMarkdown(s)).join('\n---\n\n')
          : `No MCP servers found matching query: "${query}"`;

        await logMcp(null, `search_mcp_servers${query ? ` query: ${query}` : ''}`);
        return Response.json(
          {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: textOutput }],
            },
          },
          { headers: { 'Access-Control-Allow-Origin': '*' } }
        );
      }

      if (toolName === 'get_mcp_install_config') {
        const serverId = args.id;
        const server = await getServerById(serverId);

        if (!server) {
          return Response.json(
            {
              jsonrpc: '2.0',
              id,
              result: {
                content: [{ type: 'text', text: `Server with ID "${serverId}" not found in AllMCPs directory.` }],
                isError: true,
              },
            },
            { headers: { 'Access-Control-Allow-Origin': '*' } }
          );
        }

        const textOutput = formatServerAsMarkdown(server);
        await logMcp(serverId, 'get_mcp_install_config');
        return Response.json(
          {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: textOutput }],
            },
          },
          { headers: { 'Access-Control-Allow-Origin': '*' } }
        );
      }

      if (toolName === 'list_mcp_categories') {
        const servers = await getActiveServers();
        const counts: Record<string, number> = {};
        for (const s of servers) {
          counts[s.category] = (counts[s.category] || 0) + 1;
        }

        let md = `# AllMCPs Categories\n\n`;
        for (const [cat, count] of Object.entries(counts)) {
          md += `- **${cat}**: ${count} servers\n`;
        }

        await logMcp(null, 'list_mcp_categories');
        return Response.json(
          {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: md }],
            },
          },
          { headers: { 'Access-Control-Allow-Origin': '*' } }
        );
      }

      return Response.json(
        { jsonrpc: '2.0', id, error: { code: -32601, message: `Tool not found: ${toolName}` } },
        { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    return Response.json(
      { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } },
      { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (e: any) {
    return Response.json(
      { jsonrpc: '2.0', id: null, error: { code: -32603, message: e?.message || 'Internal error' } },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
