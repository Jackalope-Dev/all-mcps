import { eq } from 'drizzle-orm';
import { agentTokens, users } from '@/db/schema';

/** SHA-256 hex digest — used to store tokens/codes at rest without keeping the plaintext. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Opaque bearer token for POST /api/v1/agent/claim and /revoke. Prefixed so leaked tokens are greppable/identifiable in logs. */
export function generateAgentToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return 'amcp_' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 6-digit email confirmation code for POST /api/v1/agent/register. */
export function generateRegistrationCode(): string {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
}

export const AGENT_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
export const REGISTRATION_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const MAX_CODE_ATTEMPTS = 5;

export type AgentIdentity = { userId: string; email: string | null; tokenHash: string };

/**
 * Resolves an `Authorization: Bearer <token>` header to the agent's backing
 * user account, or null if missing/malformed/unknown/expired/revoked. Does
 * not throw — callers turn a null into the 401 response shape they want.
 */
export async function resolveAgentAuth(
  db: any,
  authorizationHeader: string | null
): Promise<AgentIdentity | null> {
  const match = authorizationHeader?.match(/^Bearer\s+(\S+)$/i);
  if (!match) return null;
  const token = match[1];
  const tokenHash = await sha256Hex(token);

  const rows = await db
    .select({
      userId: agentTokens.userId,
      expiresAt: agentTokens.expiresAt,
      revokedAt: agentTokens.revokedAt,
      email: users.email,
    })
    .from(agentTokens)
    .innerJoin(users, eq(users.id, agentTokens.userId))
    .where(eq(agentTokens.tokenHash, tokenHash))
    .limit(1);

  const row = rows[0];
  if (!row || row.revokedAt) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) return null;

  return { userId: row.userId, email: row.email ?? null, tokenHash };
}
