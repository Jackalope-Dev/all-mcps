import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';
import { acpDiscovery, getAcpConfig } from '@/lib/acp';

export const dynamic = 'force-dynamic';

/**
 * /.well-known/acp.json — Agentic Commerce Protocol discovery (rfc.discovery).
 * Only served while ACP checkout can actually take a payment.
 */
export async function GET() {
  const { env } = await getCloudflareContext();
  if (!getAcpConfig(env)) {
    return NextResponse.json(
      { error: 'ACP checkout is not enabled on this site yet.' },
      { status: 404, headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  }
  return NextResponse.json(acpDiscovery(), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
