import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { agentRegistrationCodes, agentTokens, users } from '@/db/schema';
import {
  generateAgentToken,
  sha256Hex,
  AGENT_TOKEN_TTL_MS,
  MAX_CODE_ATTEMPTS,
  parseAgentScopes,
} from '@/lib/agentAuth';

const confirmSchema = z.object({
  email: z.string().email('Provide a valid email address'),
  code: z.string().min(1, 'Confirmation code is required'),
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const result = confirmSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid confirmation payload', details: result.error.issues },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const email = result.data.email.trim().toLowerCase();
    const code = result.data.code.trim();

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500, headers: CORS_HEADERS });
    }

    if (!env || !env.DB) {
      return NextResponse.json({ error: 'Database binding not found' }, { status: 500, headers: CORS_HEADERS });
    }

    const db = drizzle(env.DB as any);

    const pending = await db
      .select()
      .from(agentRegistrationCodes)
      .where(eq(agentRegistrationCodes.email, email))
      .limit(1);

    const reg = pending[0];
    if (!reg) {
      return NextResponse.json(
        { error: 'No pending registration found for this email. Request a new code at /api/v1/agent/register.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (new Date(reg.expiresAt).getTime() < Date.now()) {
      await db.delete(agentRegistrationCodes).where(eq(agentRegistrationCodes.email, email));
      return NextResponse.json(
        { error: 'Confirmation code has expired. Request a new code at /api/v1/agent/register.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (reg.attempts >= MAX_CODE_ATTEMPTS) {
      await db.delete(agentRegistrationCodes).where(eq(agentRegistrationCodes.email, email));
      return NextResponse.json(
        { error: 'Too many incorrect attempts. Request a new code at /api/v1/agent/register.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const inputHash = await sha256Hex(code);
    if (inputHash !== reg.codeHash) {
      await db
        .update(agentRegistrationCodes)
        .set({ attempts: reg.attempts + 1 })
        .where(eq(agentRegistrationCodes.email, email));

      return NextResponse.json(
        { error: 'Incorrect confirmation code.', attemptsRemaining: MAX_CODE_ATTEMPTS - (reg.attempts + 1) },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Code is valid! Find or create user row
    const existingUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);
    let userId: string;

    if (existingUsers[0]) {
      userId = existingUsers[0].id;
    } else {
      userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        email,
        name: reg.agentName || 'AI Agent',
      });
    }

    // Mint bearer token, carrying over the scopes requested at registration
    const rawToken = generateAgentToken();
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + AGENT_TOKEN_TTL_MS);
    const scopes = parseAgentScopes(reg.scopes);

    await db.insert(agentTokens).values({
      tokenHash,
      userId,
      agentName: reg.agentName || null,
      createdAt: new Date(),
      expiresAt,
      scopes: JSON.stringify(scopes),
    });

    // Delete used registration code
    await db.delete(agentRegistrationCodes).where(eq(agentRegistrationCodes.email, email));

    return NextResponse.json(
      {
        success: true,
        message: 'Agent registered successfully. Use this token in the Authorization header: Authorization: Bearer <token>',
        token: rawToken,
        tokenType: 'Bearer',
        scopes,
        expiresAt: expiresAt.toISOString(),
        docs: {
          claim: 'https://allmcps.com/api/v1/agent/claim',
          revoke: 'https://allmcps.com/api/v1/agent/revoke',
          authSpec: 'https://allmcps.com/auth.md',
        },
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (e: any) {
    console.error('Agent confirm error:', e);
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function GET() {
  return NextResponse.json(
    {
      message: 'Send a POST request with {"email": "your-email@domain.com", "code": "123456"} to verify your email and mint a bearer token.',
      docs: 'https://allmcps.com/auth.md',
    },
    { status: 200, headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
