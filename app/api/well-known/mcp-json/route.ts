import { NextResponse } from 'next/server';
import { SUPPORTED_PROTOCOL_VERSIONS } from '@/lib/mcpProtocol';

export async function GET() {
  const mcpManifest = {
    name: 'AllMCPs Directory Server',
    description:
      'The definitive open directory of Model Context Protocol (MCP) servers, tools, and client configurations.',
    version: '1.5.0',
    websiteUrl: 'https://allmcps.com',
    mcpEndpoint: 'https://allmcps.com/api/mcp',
    // Streamable HTTP: one endpoint taking POSTed JSON-RPC. Responses are
    // plain JSON (a valid case of the transport). Dual-era: modern clients
    // send the version per request; legacy clients use initialize.
    transport: 'streamable-http',
    protocolVersion: SUPPORTED_PROTOCOL_VERSIONS[0],
    protocolVersions: SUPPORTED_PROTOCOL_VERSIONS,
    wellKnownHandshake: 'https://allmcps.com/.well-known/mcp',
    capabilities: {
      tools: {
        search_mcp_servers: {
          description:
            'Search the AllMCPs directory for MCP servers by query or category',
        },
        get_mcp_install_config: {
          description:
            'Setup configs for one server in 13 MCP clients (Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, Cline, Zed, Codex, Gemini CLI, JetBrains, Roo Code, Continue, LM Studio)',
        },
        get_mcp_alternatives: {
          description: 'Alternative servers to a given server, same category',
        },
        compare_mcp_servers: {
          description:
            'Side-by-side comparison of 2 to 4 servers: install, evidence, tools, health, stars',
        },
        recommend_mcp_stack: {
          description: 'A small stack of complementary servers for a role',
        },
        get_boost_status: {
          description: 'Boost and verified-badge status for a listing',
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
            'Verify maintainer ownership via README badge, site badge, or DNS TXT. Pass agentToken (see register_mcp_agent/confirm_mcp_agent) for unattended use with no sign-in.',
        },
        register_mcp_agent: {
          description:
            'Start unattended-agent registration by emailing a confirmation code',
        },
        confirm_mcp_agent: {
          description:
            'Exchange an emailed confirmation code for a bearer token (agentToken)',
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
