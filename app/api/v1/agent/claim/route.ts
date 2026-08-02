import { NextResponse } from 'next/server';

/**
 * Programmatic agent claim is not implemented. Human claim flow:
 * sign in → /mcp/{id}/claim (badge / DNS / GitHub README).
 */
const BODY = {
  error: 'agent_claim_not_implemented',
  message:
    'Programmatic agent claim is not available. Claim listings as a signed-in human at /mcp/{id}/claim after verifying ownership (GitHub badge, site badge, or DNS TXT).',
  status: 501,
  docs: {
    auth: 'https://allmcps.com/auth.md',
    claimGuide: 'https://allmcps.com/blog/free-dofollow-backlink-claim-mcp-listing',
    browse: 'https://allmcps.com/browse',
  },
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
