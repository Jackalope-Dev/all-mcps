import { NextResponse } from 'next/server';

export async function GET() {
  const acpConfig = {
    protocol: {
      name: 'acp',
      version: '1.0',
    },
    api_base_url: 'https://allmcps.com/api/v1/boost',
    transports: ['http', 'mcp'],
    capabilities: {
      services: [
        {
          name: 'server_boosting',
          description: 'Feature and boost MCP servers in AllMCPs directory',
          checkout_url: 'https://allmcps.com/api/v1/boost/checkout',
          pricing_url: 'https://allmcps.com/api/v1/boost/pricing',
        },
      ],
    },
  };

  return new NextResponse(JSON.stringify(acpConfig, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
