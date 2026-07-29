import { NextResponse } from 'next/server';

export async function GET() {
  const oidcConfig = {
    issuer: 'https://allmcps.com',
    authorization_endpoint: 'https://allmcps.com/api/auth/signin',
    token_endpoint: 'https://allmcps.com/api/auth/token',
    jwks_uri: 'https://allmcps.com/.well-known/jwks.json',
    response_types_supported: ['code', 'token'],
    grant_types_supported: [
      'authorization_code',
      'client_credentials',
      'urn:ietf:params:oauth:grant-type:token-exchange',
    ],
    scopes_supported: ['openid', 'profile', 'email', 'mcp:read', 'mcp:write', 'mcp:search'],
    code_challenge_methods_supported: ['S256'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    agent_auth: {
      register_uri: 'https://allmcps.com/api/v1/agent/register',
      supported_identity_types: ['ephemeral_session', 'did', 'oauth_client'],
      credential_types: ['bearer_token', 'jwt'],
      claim_url: 'https://allmcps.com/api/v1/agent/claim',
      revocation_url: 'https://allmcps.com/api/v1/agent/revoke',
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
