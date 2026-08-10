import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';
import { agentRegistrationCodes } from '@/db/schema';
import {
  generateRegistrationCode,
  sha256Hex,
  REGISTRATION_CODE_TTL_MS,
} from '@/lib/agentAuth';
import { sendNotificationEmail } from '@/lib/notify';

const registerSchema = z.object({
  email: z.string().email('Provide a valid email address'),
  agentName: z.string().optional().or(z.literal('')),
  agent_name: z.string().optional().or(z.literal('')),
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid registration payload', details: result.error.issues },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const email = result.data.email.trim().toLowerCase();
    const agentName = (result.data.agentName || result.data.agent_name || '').trim();

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

    const rawCode = generateRegistrationCode();
    const codeHash = await sha256Hex(rawCode);
    const expiresAt = new Date(Date.now() + REGISTRATION_CODE_TTL_MS);

    await db
      .insert(agentRegistrationCodes)
      .values({
        email,
        codeHash,
        agentName: agentName || null,
        attempts: 0,
        createdAt: new Date(),
        expiresAt,
      })
      .onConflictDoUpdate({
        target: agentRegistrationCodes.email,
        set: {
          codeHash,
          agentName: agentName || null,
          attempts: 0,
          createdAt: new Date(),
          expiresAt,
        },
      });

    await sendNotificationEmail({
      to: email,
      heading: 'AllMCPs Agent Registration Code',
      message: `Your confirmation code for AllMCPs Agent API registration is: ${rawCode}\n\nSubmit this code along with your email to POST /api/v1/agent/register/confirm to obtain your bearer token. This code expires in 15 minutes.`,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Confirmation code sent to email. Call POST /api/v1/agent/register/confirm with email and code to receive your bearer token.',
        email,
        expiresAt: expiresAt.toISOString(),
        confirm_url: 'https://allmcps.com/api/v1/agent/register/confirm',
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (e: any) {
    console.error('Agent registration error:', e);
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function GET() {
  return NextResponse.json(
    {
      message: 'Send a POST request with {"email": "your-email@domain.com", "agentName": "YourAgent"} to request a registration confirmation code.',
      confirm_endpoint: 'https://allmcps.com/api/v1/agent/register/confirm',
      docs: 'https://allmcps.com/auth.md',
    },
    { status: 200, headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
