import { NextResponse } from 'next/server';

export async function GET() {
  const catalog = {
    linkset: [
      {
        anchor: 'https://allmcps.com/api/v1',
        'service-desc': [
          {
            href: 'https://allmcps.com/api/v1/openapi.json',
            type: 'application/json',
            title: 'AllMCPs REST API OpenAPI Specification',
          },
        ],
        'service-doc': [
          {
            href: 'https://allmcps.com/docs/api',
            type: 'text/html',
            title: 'AllMCPs API Documentation',
          },
        ],
        status: [
          {
            href: 'https://allmcps.com/api/v1/health',
            type: 'application/json',
            title: 'AllMCPs Service Health Endpoint',
          },
        ],
      },
      {
        anchor: 'https://allmcps.com/api/a2a',
        'service-desc': [
          {
            href: 'https://allmcps.com/.well-known/agent-card.json',
            type: 'application/json',
            title: 'AllMCPs A2A Agent Card (JSON-RPC, A2A 1.0 and 0.3)',
          },
        ],
      },
    ],
  };

  return new NextResponse(JSON.stringify(catalog, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/linkset+json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
