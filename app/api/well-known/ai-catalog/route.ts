/**
 * /.well-known/ai-catalog.json — Agentic Resource Discovery (ARD) manifest:
 * one fetch that points agents and registries at every agent-facing surface
 * this domain offers. Each entry links to the real artifact (`url`), never a
 * copy, so it can't drift from the source document.
 */
const ORIGIN = 'https://allmcps.com';

const catalog = {
  specVersion: '1.0',
  host: {
    displayName: 'AllMCPs',
    identifier: 'did:web:allmcps.com',
    documentationUrl: `${ORIGIN}/docs/api`,
  },
  entries: [
    {
      identifier: 'urn:air:allmcps.com:server:directory',
      displayName: 'AllMCPs Directory MCP Server',
      type: 'application/mcp-server-card+json',
      url: `${ORIGIN}/.well-known/mcp/server-card.json`,
      description:
        'Remote MCP server for the AllMCPs directory: search MCP servers, get per-client install configs, compare alternatives and claim listings.',
      tags: ['mcp', 'directory', 'search'],
    },
    {
      identifier: 'urn:air:allmcps.com:agent:directory',
      displayName: 'AllMCPs Directory Agent (A2A)',
      type: 'application/a2a-agent-card+json',
      url: `${ORIGIN}/.well-known/agent-card.json`,
      description:
        'A2A agent that answers questions about MCP servers using the AllMCPs catalog.',
      tags: ['a2a', 'mcp', 'directory'],
    },
    {
      identifier: 'urn:air:allmcps.com:api:rest',
      displayName: 'AllMCPs REST API',
      type: 'application/openapi+json',
      url: `${ORIGIN}/api/v1/openapi.json`,
      description:
        'Public read API for MCP server listings, search and categories, plus agent registration and listing claims.',
      tags: ['openapi', 'rest', 'mcp'],
    },
    {
      identifier: 'urn:air:allmcps.com:skills:index',
      displayName: 'AllMCPs Agent Skills',
      type: 'application/json',
      url: `${ORIGIN}/.well-known/agent-skills/index.json`,
      description:
        'Agent Skills index: how to find, install, submit and monetize MCP servers through AllMCPs.',
      tags: ['agent-skills'],
    },
  ],
};

export async function GET() {
  return new Response(JSON.stringify(catalog, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/ai-catalog+json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
