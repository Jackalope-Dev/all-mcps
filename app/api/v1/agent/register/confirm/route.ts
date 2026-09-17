import { NextResponse } from 'next/server';
import { confirmAgentRegistration } from '@/lib/agentConfirm';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const outcome = await confirmAgentRegistration(body);
    return NextResponse.json(outcome.body, {
      status: outcome.status,
      headers: CORS_HEADERS,
    });
  } catch (e: any) {
    console.error('Agent confirm error:', e);
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
        'Send a POST request with {"email": "your-email@domain.com", "code": "123456"} to verify your email and mint a bearer token.',
      docs: 'https://allmcps.com/auth.md',
    },
    { status: 200, headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
