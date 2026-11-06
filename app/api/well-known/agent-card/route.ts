import { buildAgentCard } from '@/lib/a2a';
import { MCP_TOOLS } from '@/lib/mcpTools';

export const dynamic = 'force-dynamic';

/** /.well-known/agent-card.json — the A2A Agent Card (RFC 8615 well-known URI). */
export async function GET() {
  return Response.json(buildAgentCard(MCP_TOOLS), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
