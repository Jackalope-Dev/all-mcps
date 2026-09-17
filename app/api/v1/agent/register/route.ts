import { NextResponse } from 'next/server';
import { AGENT_SCOPES } from '@/lib/agentAuth';
import { registerAgent } from '@/lib/agentRegister';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const outcome = await registerAgent(body);
    return NextResponse.json(outcome.body, {
      status: outcome.status,
      headers: CORS_HEADERS,
    });
  } catch (e: any) {
    console.error('Agent registration error:', e);
    return NextResponse.json(
      { error: e?.message || 'Internal Server Error' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      message:
        'Send a POST request with {"email": "your-email@domain.com", "agentName": "YourAgent", "scopes": ["listings:claim"]} to request a registration confirmation code. `scopes` is optional and defaults to the full supported set.',
      scopesSupported: AGENT_SCOPES,
      confirm_endpoint: 'https://allmcps.com/api/v1/agent/register/confirm',
      docs: 'https://allmcps.com/auth.md',
    },
    { status: 200, headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
