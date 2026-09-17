import { getCloudflareContext } from '@opennextjs/cloudflare';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';
import { agentRegistrationCodes, agentTokens, users } from '@/db/schema';
import {
  AGENT_TOKEN_TTL_MS,
  generateAgentToken,
  MAX_CODE_ATTEMPTS,
  parseAgentScopes,
  sha256Hex,
} from '@/lib/agentAuth';
import { formatZodError } from './zodError';

const confirmSchema = z.object({
  email: z.string().email('Provide a valid email address'),
  code: z.string().min(1, 'Confirmation code is required'),
});

export type AgentConfirmOutcome =
  | {
      ok: true;
      status: 200;
      body: {
        success: true;
        message: string;
        token: string;
        tokenType: 'Bearer';
        scopes: string[];
        expiresAt: string;
        docs: Record<string, string>;
      };
    }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Core "confirm registration code, mint bearer token" logic, shared by
 * `POST /api/v1/agent/register/confirm` and the `confirm_mcp_agent` MCP tool.
 * Same in-process pattern as lib/submitListing.ts.
 */
export async function confirmAgentRegistration(
  rawBody: unknown,
): Promise<AgentConfirmOutcome> {
  const result = confirmSchema.safeParse(rawBody);
  if (!result.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'Invalid confirmation payload',
        details: formatZodError(result.error),
      },
    };
  }

  const email = result.data.email.trim().toLowerCase();
  const code = result.data.code.trim();

  let env: any;
  try {
    const ctx = await getCloudflareContext();
    env = ctx.env;
  } catch {
    return { ok: false, status: 500, body: { error: 'Database unavailable' } };
  }

  if (!env?.DB) {
    return {
      ok: false,
      status: 500,
      body: { error: 'Database binding not found' },
    };
  }

  const db = drizzle(env.DB as any);

  const pending = await db
    .select()
    .from(agentRegistrationCodes)
    .where(eq(agentRegistrationCodes.email, email))
    .limit(1);

  const reg = pending[0];
  if (!reg) {
    return {
      ok: false,
      status: 400,
      body: {
        error:
          'No pending registration found for this email. Request a new code first.',
      },
    };
  }

  if (new Date(reg.expiresAt).getTime() < Date.now()) {
    await db
      .delete(agentRegistrationCodes)
      .where(eq(agentRegistrationCodes.email, email));
    return {
      ok: false,
      status: 400,
      body: { error: 'Confirmation code has expired. Request a new code.' },
    };
  }

  if (reg.attempts >= MAX_CODE_ATTEMPTS) {
    await db
      .delete(agentRegistrationCodes)
      .where(eq(agentRegistrationCodes.email, email));
    return {
      ok: false,
      status: 400,
      body: {
        error: 'Too many incorrect attempts. Request a new code.',
      },
    };
  }

  const inputHash = await sha256Hex(code);
  if (inputHash !== reg.codeHash) {
    await db
      .update(agentRegistrationCodes)
      .set({ attempts: reg.attempts + 1 })
      .where(eq(agentRegistrationCodes.email, email));

    return {
      ok: false,
      status: 400,
      body: {
        error: 'Incorrect confirmation code.',
        attemptsRemaining: MAX_CODE_ATTEMPTS - (reg.attempts + 1),
      },
    };
  }

  // Code is valid! Find or create user row
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
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

  await db
    .delete(agentRegistrationCodes)
    .where(eq(agentRegistrationCodes.email, email));

  return {
    ok: true,
    status: 200,
    body: {
      success: true,
      message:
        'Agent registered successfully. Use this token in the Authorization header: Authorization: Bearer <token>',
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
  };
}
