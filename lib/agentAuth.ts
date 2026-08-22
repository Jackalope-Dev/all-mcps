import { eq } from 'drizzle-orm';
import { agentTokens, users } from '@/db/schema';

/**
 * OAuth-style scopes an agent token can hold. Each maps to one gated write
 * action — read endpoints stay open/unscoped (see auth.md's capability
 * table). Extend this list (and the corresponding `hasScope` check at the
 * call site) as more agent-authenticated write endpoints are added.
 */
export const AGENT_SCOPES = ['listings:claim'] as const;
export type AgentScope = (typeof AGENT_SCOPES)[number];

/** Legacy tokens/registrations minted before scopes existed carry this — the exact capability set they always had. */
export const DEFAULT_AGENT_SCOPES: AgentScope[] = ['listings:claim'];

export function isValidAgentScope(scope: unknown): scope is AgentScope {
  return typeof scope === 'string' && (AGENT_SCOPES as readonly string[]).includes(scope);
}

/** Parses a stored `scopes` JSON column, falling back to the legacy default for null/malformed values (pre-scopes rows). */
export function parseAgentScopes(raw: unknown): AgentScope[] {
  if (typeof raw !== 'string' || !raw.trim()) return DEFAULT_AGENT_SCOPES;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_AGENT_SCOPES;
    const valid = parsed.filter(isValidAgentScope);
    return valid.length > 0 ? valid : DEFAULT_AGENT_SCOPES;
  } catch {
    return DEFAULT_AGENT_SCOPES;
  }
}

export function serializeAgentScopes(scopes: AgentScope[]): string {
  return JSON.stringify(scopes);
}

export function hasAgentScope(agent: { scopes: AgentScope[] }, scope: AgentScope): boolean {
  return agent.scopes.includes(scope);
}

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

export type AgentIdentity = { userId: string; email: string | null; tokenHash: string; scopes: AgentScope[] };

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
      scopes: agentTokens.scopes,
    })
    .from(agentTokens)
    .innerJoin(users, eq(users.id, agentTokens.userId))
    .where(eq(agentTokens.tokenHash, tokenHash))
    .limit(1);

  const row = rows[0];
  if (!row || row.revokedAt) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) return null;

  return { userId: row.userId, email: row.email ?? null, tokenHash, scopes: parseAgentScopes(row.scopes) };
}
