import { NextResponse } from 'next/server';

export async function GET() {
  const protectedResource = {
    resource: 'https://allmcps.com/api/v1',
    authorization_servers: ['https://allmcps.com'],
    scopes_supported: ['mcp:read', 'mcp:write', 'mcp:search'],
    bearer_methods_supported: ['header'],
    resource_documentation: 'https://allmcps.com/docs/api',
  };

  return new NextResponse(JSON.stringify(protectedResource, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
