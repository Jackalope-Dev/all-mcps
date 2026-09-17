/**
 * Jackalope back-office admin adapter (ADR 0006). Read-mostly slice of AllMcps
 * for the Jackalope Hub back office. See lib/backoffice/adapter.ts.
 *
 * Additive + fail-closed: if BACKOFFICE_ADMIN_TOKEN is unset the whole surface
 * 404s (invisible until deliberately configured). Independent of ADMIN_SECRET
 * and the NextAuth admin session.
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { createBackofficeAdapter } from '@/lib/backoffice/adapter';
import { drizzleAuditStore } from '@/lib/backoffice/auditStore';
import { drizzleRepo } from '@/lib/backoffice/repo';

export const dynamic = 'force-dynamic';

async function handle(req: Request): Promise<Response> {
  const token = process.env.BACKOFFICE_ADMIN_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  let env: CloudflareEnv | undefined;
  try {
    env = (await getCloudflareContext()).env;
  } catch {
    return NextResponse.json(
      { error: 'no cloudflare context' },
      { status: 500 },
    );
  }
  if (!env?.DB) {
    return NextResponse.json({ error: 'no database binding' }, { status: 500 });
  }

  const db = drizzle(env.DB as never);
  const adapter = createBackofficeAdapter({
    repo: drizzleRepo(db),
    audit: drizzleAuditStore(db),
    token,
  });
  return adapter.handle(req);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
