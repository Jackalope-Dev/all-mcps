import { AGENT_SCOPE_DETAILS, AGENT_SCOPES } from '@/lib/agentAuth';

const ORIGIN = 'https://allmcps.com';

/**
 * RFC 9728 Protected Resource Metadata. The document at
 * /.well-known/oauth-protected-resource must name the origin itself as its
 * `resource` (validators reject a mismatch); a path-scoped resource gets its
 * own document at /.well-known/oauth-protected-resource/<path>.
 */
function protectedResourceMetadata(resourcePath = '') {
  return {
    resource: `${ORIGIN}${resourcePath}`,
    authorization_servers: [ORIGIN],
    // Kept in sync with lib/agentAuth.ts AGENT_SCOPES/AGENT_SCOPE_DETAILS —
    // the scopes an agent token can actually be minted with and be checked
    // against. Read endpoints (search, servers, categories, markdown) are
    // unscoped/public; only listing-mutating actions require a scope.
    scopes_supported: AGENT_SCOPES,
    // Non-standard extension (RFC 9728 defines scopes_supported as a bare
    // list) spelling out exactly what each scope grants and which
    // endpoint(s) enforce it.
    scope_details: AGENT_SCOPE_DETAILS,
    bearer_methods_supported: ['header'],
    resource_name: 'AllMCPs',
    resource_documentation: `${ORIGIN}/docs/api`,
    registration_endpoint: `${ORIGIN}/api/v1/agent/register`,
  };
}

export function protectedResourceResponse(resourcePath = '') {
  return new Response(
    JSON.stringify(protectedResourceMetadata(resourcePath), null, 2),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
}
