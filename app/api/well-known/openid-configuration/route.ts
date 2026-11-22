import { NextResponse } from 'next/server';

export async function GET() {
  const oidcConfig = {
    issuer: 'https://allmcps.com',
    authorization_endpoint: 'https://allmcps.com/api/auth/signin',
    token_endpoint: 'https://allmcps.com/api/auth/token',
    registration_endpoint: 'https://allmcps.com/api/v1/agent/register',
    jwks_uri: 'https://allmcps.com/.well-known/jwks.json',
    response_types_supported: ['code', 'token'],
    grant_types_supported: [
      'authorization_code',
      'client_credentials',
      'urn:ietf:params:oauth:grant-type:token-exchange',
    ],
    scopes_supported: [
      'openid',
      'profile',
      'email',
      'mcp:read',
      'mcp:write',
      'mcp:search',
    ],
    code_challenge_methods_supported: ['S256'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    // auth.md agent registration (https://github.com/workos/auth.md).
    // The one registration path is email-verified: the agent sends the
    // user's email (`login_hint`), we mail a 6-digit code, and the confirm
    // call returns an opaque `amcp_` bearer token. That is the spec's
    // `service_auth` shape; anonymous and ID-JAG registration are not offered.
    agent_auth: {
      skill: 'https://allmcps.com/auth.md',
      identity_endpoint: 'https://allmcps.com/api/v1/agent/register',
      claim_endpoint: 'https://allmcps.com/api/v1/agent/register/confirm',
      identity_types_supported: ['service_auth'],
      service_auth: {
        login_hint_types_supported: ['email'],
        claim_methods_supported: ['email_code'],
      },
      credential_types_supported: ['bearer_token'],
      revocation_endpoint: 'https://allmcps.com/api/v1/agent/revoke',
      // Names from the earlier draft of this block, kept for agents that
      // already read them.
      register_uri: 'https://allmcps.com/api/v1/agent/register',
      register_confirm_uri: 'https://allmcps.com/api/v1/agent/register/confirm',
      revocation_url: 'https://allmcps.com/api/v1/agent/revoke',
      // Not part of auth.md: claims an MCP listing with an agent token.
      listing_claim_endpoint: 'https://allmcps.com/api/v1/agent/claim',
    },
  };

  return new NextResponse(JSON.stringify(oidcConfig, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
