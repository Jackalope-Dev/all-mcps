import { NextResponse } from 'next/server';
import { AGENT_SCOPES, AGENT_SCOPE_DETAILS } from '@/lib/agentAuth';

export async function GET() {
  const protectedResource = {
    resource: 'https://allmcps.com/api/v1',
    authorization_servers: ['https://allmcps.com'],
    // Kept in sync with lib/agentAuth.ts AGENT_SCOPES/AGENT_SCOPE_DETAILS —
    // the scopes an agent token can actually be minted with and be checked
    // against. Read endpoints (search, servers, categories, markdown) are
    // unscoped/public; only listing-mutating actions require a scope.
    scopes_supported: AGENT_SCOPES,
    // Non-standard extension (RFC 9728 defines scopes_supported as a bare
    // list) spelling out exactly what each scope grants and which
    // endpoint(s) enforce it, so scope granularity is unambiguous without
    // cross-referencing the OpenAPI spec or auth.md.
    scope_details: AGENT_SCOPE_DETAILS,
    bearer_methods_supported: ['header'],
    resource_documentation: 'https://allmcps.com/docs/api',
    registration_endpoint: 'https://allmcps.com/api/v1/agent/register',
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
