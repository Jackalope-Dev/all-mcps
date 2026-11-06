import { buildAgentCard, handleA2aRequest } from '@/lib/a2a';
import { mcpToolCaller } from '@/lib/mcpInProcess';
import { MCP_TOOLS } from '@/lib/mcpTools';

export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
};

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, A2A-Version, A2A-Extensions',
    },
  });
}

/** A browser or curl hitting the endpoint gets the card it belongs to. */
export async function GET() {
  return Response.json(buildAgentCard(MCP_TOOLS), {
    headers: { ...CORS, 'Cache-Control': 'public, max-age=300' },
  });
}

/** A2A JSON-RPC binding (1.0 and 0.3). */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const versionHeader =
    req.headers.get('A2A-Version') ?? url.searchParams.get('A2A-Version');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error: body must be JSON' },
      },
      { headers: CORS },
    );
  }

  const result = await handleA2aRequest(
    body,
    versionHeader,
    mcpToolCaller(req),
    new Set(MCP_TOOLS.map((t) => t.name)),
  );
  return Response.json(result, {
    headers: {
      ...CORS,
      'Cache-Control': 'no-store',
    },
  });
}
