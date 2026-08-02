import { NextResponse } from 'next/server';

const BODY = {
  error: 'agent_revoke_not_implemented',
  message:
    'Agent token revocation is not available because agent registration tokens are not issued yet.',
  status: 501,
  docs: {
    auth: 'https://allmcps.com/auth.md',
    api: 'https://allmcps.com/docs/api',
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
