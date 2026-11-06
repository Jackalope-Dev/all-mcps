import { getCloudflareContext } from '@opennextjs/cloudflare';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import { type AcpResult, handleAcp } from '@/lib/acp';
import type { AgentIdentity } from '@/lib/agentAuth';

type Op = (ctx: {
  db: DrizzleD1Database;
  env: unknown;
  agent: AgentIdentity;
  body: Record<string, unknown>;
}) => Promise<AcpResult>;

/** Binds an ACP operation to the Worker's env and D1. */
export async function acpRoute(req: Request, op: Op): Promise<Response> {
  const { env } = await getCloudflareContext();
  const db: DrizzleD1Database = drizzle(env.DB);
  return handleAcp(req, { env, db }, ({ agent, body }) =>
    op({ db, env, agent, body }),
  );
}
