import { getCloudflareContext } from '@opennextjs/cloudflare';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { agentTokens } from '@/db/schema';
import { resolveAgentAuth } from '@/lib/agentAuth';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(req: Request) {
  try {
    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      return NextResponse.json(
        { error: 'Database unavailable' },
        { status: 500, headers: CORS_HEADERS },
      );
    }

    if (!env?.DB) {
      return NextResponse.json(
        { error: 'Database binding not found' },
        { status: 500, headers: CORS_HEADERS },
      );
    }

    const db = drizzle(env.DB as any);

    const authHeader = req.headers.get('Authorization');
    const agent = await resolveAgentAuth(db, authHeader);

    if (!agent) {
      return NextResponse.json(
        {
          error: 'unauthorized',
          message: 'Valid Agent Bearer token required in Authorization header.',
        },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    await db
      .update(agentTokens)
      .set({ revokedAt: new Date() })
      .where(eq(agentTokens.tokenHash, agent.tokenHash));

    return NextResponse.json(
      {
        success: true,
        message: 'Agent bearer token revoked successfully.',
      },
      { status: 200, headers: CORS_HEADERS },
    );
  } catch (e: any) {
    console.error('Agent revoke error:', e);
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
        'Send POST request with Authorization: Bearer <token> to revoke your agent bearer token.',
      docs: 'https://allmcps.com/auth.md',
    },
    { status: 200, headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
