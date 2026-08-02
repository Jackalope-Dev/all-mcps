import { NextResponse } from 'next/server';

/**
 * Agent registration is not implemented as a token-minting API yet.
 * Public directory read/search/submit paths work without agent registration.
 * Returning a clear 501 (instead of a soft 404) keeps discovery docs honest.
 */
const BODY = {
  error: 'agent_registration_not_implemented',
  message:
    'AllMCPs does not mint agent access tokens yet. Public search, listing metadata, markdown, and free submit work without registration.',
  status: 501,
  docs: {
    auth: 'https://allmcps.com/auth.md',
    api: 'https://allmcps.com/docs/api',
    search: 'https://allmcps.com/api/v1/search?q=',
    submit: 'https://allmcps.com/api/v1/submit',
    humanClaim: 'https://allmcps.com/browse',
  },
  promoCode: 'AGENTREADY',
};

export async function POST() {
  return NextResponse.json(BODY, {
    status: 501,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

export async function GET() {
  return POST();
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
