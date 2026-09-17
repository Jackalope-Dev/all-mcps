import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';
import { agentRegistrationCodes } from '@/db/schema';
import {
  AGENT_SCOPES,
  DEFAULT_AGENT_SCOPES,
  generateRegistrationCode,
  isValidAgentScope,
  REGISTRATION_CODE_TTL_MS,
  serializeAgentScopes,
  sha256Hex,
} from '@/lib/agentAuth';
import { sendNotificationEmail } from '@/lib/notify';
import { formatZodError } from './zodError';

const registerSchema = z.object({
  email: z.string().email('Provide a valid email address'),
  agentName: z.string().optional().or(z.literal('')),
  agent_name: z.string().optional().or(z.literal('')),
  // OAuth-style scoped permissions — request only what you need (see
  // /.well-known/oauth-protected-resource and auth.md). Omit to receive the
  // default scope set.
  scopes: z.array(z.string()).optional(),
});

export type AgentRegisterOutcome =
  | {
      ok: true;
      status: 200;
      body: {
        success: true;
        message: string;
        email: string;
        scopes: string[];
        expiresAt: string;
        confirm_url: string;
      };
    }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Core "start agent registration" logic, shared by `POST /api/v1/agent/register`
 * and the `register_mcp_agent` MCP tool. Same in-process pattern as
 * lib/submitListing.ts — no self-`fetch()` back to this deployment.
 */
export async function registerAgent(
  rawBody: unknown,
): Promise<AgentRegisterOutcome> {
  const result = registerSchema.safeParse(rawBody);
  if (!result.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'Invalid registration payload',
        details: formatZodError(result.error),
      },
    };
  }

  const email = result.data.email.trim().toLowerCase();
  const agentName = (
    result.data.agentName ||
    result.data.agent_name ||
    ''
  ).trim();

  const requestedScopes = result.data.scopes;
  if (requestedScopes) {
    const invalid = requestedScopes.filter((s) => !isValidAgentScope(s));
    if (invalid.length > 0) {
      return {
        ok: false,
        status: 400,
        body: {
          error: 'invalid_scope',
          message: `Unsupported scope(s): ${invalid.join(', ')}.`,
          scopesSupported: AGENT_SCOPES,
        },
      };
    }
  }
  const scopes =
    requestedScopes && requestedScopes.length > 0
      ? Array.from(new Set(requestedScopes.filter(isValidAgentScope)))
      : DEFAULT_AGENT_SCOPES;

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

  const rawCode = generateRegistrationCode();
  const codeHash = await sha256Hex(rawCode);
  const expiresAt = new Date(Date.now() + REGISTRATION_CODE_TTL_MS);
  const scopesJson = serializeAgentScopes(scopes);

  await db
    .insert(agentRegistrationCodes)
    .values({
      email,
      codeHash,
      agentName: agentName || null,
      attempts: 0,
      createdAt: new Date(),
      expiresAt,
      scopes: scopesJson,
    })
    .onConflictDoUpdate({
      target: agentRegistrationCodes.email,
      set: {
        codeHash,
        agentName: agentName || null,
        attempts: 0,
        createdAt: new Date(),
        expiresAt,
        scopes: scopesJson,
      },
    });

  await sendNotificationEmail({
    to: email,
    heading: 'AllMCPs Agent Registration Code',
    message: `Your confirmation code for AllMCPs Agent API registration is: ${rawCode}\n\nSubmit this code along with your email to POST /api/v1/agent/register/confirm (or the confirm_mcp_agent MCP tool) to obtain your bearer token. This code expires in 15 minutes.`,
  });

  return {
    ok: true,
    status: 200,
    body: {
      success: true,
      message:
        'Confirmation code sent to email. Confirm with the code to receive your bearer token.',
      email,
      scopes,
      expiresAt: expiresAt.toISOString(),
      confirm_url: 'https://allmcps.com/api/v1/agent/register/confirm',
    },
  };
}
