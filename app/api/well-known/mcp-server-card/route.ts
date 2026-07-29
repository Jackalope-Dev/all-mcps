import { NextResponse } from 'next/server';

export async function GET() {
  const serverCard = {
    $schema: 'https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/server-card.schema.json',
    serverInfo: {
      name: 'AllMCPs Directory & Discovery Server',
      version: '1.0.0',
      description: 'Comprehensive index and search engine for Model Context Protocol (MCP) servers and agent tools.',
      vendor: 'AllMCPs',
      homepage: 'https://allmcps.com',
    },
    transport: {
      type: 'http',
      endpoint: 'https://allmcps.com/api/mcp',
    },
    capabilities: {
      tools: {
        listChanged: true,
      },
      prompts: {
        listChanged: false,
      },
      resources: {
        subscribe: false,
        listChanged: true,
      },
    },
  };

  return new NextResponse(JSON.stringify(serverCard, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
