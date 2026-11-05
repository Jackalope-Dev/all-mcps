import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';
import { x402Status } from '@/lib/x402';

// Reads secrets at request time: x402 is only advertised once it's configured.
export const dynamic = 'force-dynamic';

export async function GET() {
  const { env } = await getCloudflareContext();
  const x402 = x402Status(env);
  const serverCard = {
    $schema:
      'https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/server-card.schema.json',
    serverInfo: {
      name: 'AllMCPs Directory & Discovery Server',
      version: '1.1.0',
      description:
        'Comprehensive index, search engine, and agentic commerce server for Model Context Protocol (MCP) servers and tools.',
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
      payments: {
        supported: true,
        protocol: x402.enabled
          ? ['x402', 'stripe_checkout']
          : ['stripe_checkout'],
        pricingEndpoint: 'https://allmcps.com/api/v1/boost/pricing',
        checkoutEndpoint: 'https://allmcps.com/api/v1/boost/checkout',
        ...(x402.enabled ? { x402 } : {}),
      },
    },
  };

  return new NextResponse(JSON.stringify(serverCard, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
