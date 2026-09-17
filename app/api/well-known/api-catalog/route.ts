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
