import { NextResponse } from 'next/server';

export async function GET() {
  const mcpManifest = {
    name: 'AllMCPs Directory Server',
    description:
      'The definitive open directory of Model Context Protocol (MCP) servers, tools, and client configurations.',
    version: '1.3.0',
    websiteUrl: 'https://allmcps.com',
    mcpEndpoint: 'https://allmcps.com/api/mcp',
    // "Streamable HTTP" is the official MCP transport name (spec revision
    // 2024-11-05+) for a single HTTP endpoint that accepts POSTed JSON-RPC
    // and returns either a plain JSON response or an SSE stream. This server
    // returns plain JSON today (no streaming responses yet) — a valid,
    // spec-compliant degenerate case of Streamable HTTP, not a separate
    // "http-jsonrpc" transport.
    transport: 'streamable-http',
    protocolVersion: '2024-11-05',
    wellKnownHandshake: 'https://allmcps.com/.well-known/mcp',
    capabilities: {
      tools: {
        search_mcp_servers: {
          description:
            'Search the AllMCPs directory for MCP servers by query or category',
        },
        get_mcp_install_config: {
          description:
            'Get client JSON configurations for specific MCP servers',
        },
        list_mcp_categories: {
          description: 'List directory categories with server counts',
        },
        get_boost_pricing: {
          description:
            'Get pricing and features for boosting an MCP server on AllMCPs.com',
        },
        boost_mcp_server: {
          description:
            'Initiate a server boost order via Stripe or x402 protocol',
        },
        submit_mcp_server: {
          description:
            'Programmatically submit a new MCP repository to AllMCPs.com',
        },
        verify_mcp_claim: {
          description:
            'Verify maintainer ownership via README badge, site badge, or DNS TXT',
        },
      },
    },
    documentation: 'https://allmcps.com/docs/api',
    llmsTxt: 'https://allmcps.com/llms.txt',
    openApiSpec: 'https://allmcps.com/openapi.json',
  };

  return new NextResponse(JSON.stringify(mcpManifest, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
