import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { servers, stdioVerificationPilot } from '../../../../../db/schema';
import { isCronAuthorized } from '../../../../../lib/cronAuth';
import { formatZodError } from '../../../../../lib/zodError';

/**
 * Records E2B stdio-verification pilot outcomes to the standalone
 * `stdio_verification_pilot` table (success-rate/timing/cost history), and —
 * now that the approach is validated (sendStdin race fixed, uvx bootstrapped,
 * claim atomicity fixed, sequenced behind the LLM install validator; see the
 * clean 291-listing run with 0 opaque errors that graduated this) — also
 * promotes 'ok' results into servers.tools/tools_source, the same
 * 'introspected' tier the health cron's live remote handshake writes (see
 * app/api/cron/health/route.ts): a completed stdio tools/list in a real
 * sandbox is just as authoritative as a live HTTP handshake, not a guess.
 *
 * Finalizes the `pending` claim row /batch inserted for this listing rather
 * than inserting a fresh row — keeps one row per attempt and is what makes
 * the batch endpoint's "exclude anything already in this table" claim logic
 * correct. Falls back to inserting if no pending row is found (e.g. the
 * claim was already reclaimed as stale) so a result is never silently lost.
 */
const STATUSES = [
  'ok',
  'install_failed',
  'handshake_failed',
  'timeout',
  'error',
] as const;

const toolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  parameters: z.unknown().optional(),
});

const resultSchema = z.object({
  serverId: z.string().min(1),
  status: z.enum(STATUSES),
  tools: z.array(toolSchema).optional(),
  error: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

const bodySchema = z.union([
  resultSchema,
  z.object({ results: z.array(resultSchema).min(1) }),
]);

export async function POST(req: Request) {
  try {
    if (!(await isCronAuthorized(req))) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 },
      );
    }
    const results =
      'results' in parsed.data ? parsed.data.results : [parsed.data];

    let env: any;
    try {
      const ctx = await getCloudflareContext();
      env = ctx.env;
    } catch {
      throw new Error('Could not get Cloudflare context.');
    }
    if (!env?.DB) throw new Error('Database binding not found');

    const db = drizzle(env.DB as any);
    const now = new Date();

    for (const r of results) {
      const updated = await db
        .update(stdioVerificationPilot)
        .set({
          status: r.status,
          toolCount: r.tools?.length ?? null,
          tools: r.tools && r.tools.length > 0 ? JSON.stringify(r.tools) : null,
          error: r.error ? r.error.slice(0, 500) : null,
          durationMs: r.durationMs ?? null,
          checkedAt: now,
        })
        .where(
          and(
            eq(stdioVerificationPilot.serverId, r.serverId),
            eq(stdioVerificationPilot.status, 'pending'),
          ),
        )
        .returning({ id: stdioVerificationPilot.id });

      if (updated.length === 0) {
        // No pending row found (claim was reclaimed as stale, or this is a
        // late/duplicate result from an abandoned run) — upsert on the
        // server_id unique constraint instead of a blind insert, which would
        // otherwise throw if some row for this listing already exists.
        const values = {
          serverId: r.serverId,
          status: r.status,
          toolCount: r.tools?.length ?? null,
          tools: r.tools && r.tools.length > 0 ? JSON.stringify(r.tools) : null,
          error: r.error ? r.error.slice(0, 500) : null,
          durationMs: r.durationMs ?? null,
          checkedAt: now,
        };
        await db
          .insert(stdioVerificationPilot)
          .values(values)
          .onConflictDoUpdate({
            target: stdioVerificationPilot.serverId,
            set: values,
          });
      }

      if (r.status === 'ok' && r.tools && r.tools.length > 0) {
        await db
          .update(servers)
          .set({
            tools: JSON.stringify(r.tools),
            toolsSource: 'introspected',
            toolsCheckedAt: now,
            toolsError: null,
          })
          .where(eq(servers.id, r.serverId));
      }
    }

    return NextResponse.json({ success: true, recorded: results.length });
  } catch (error: any) {
    console.error('stdio-pilot result error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    );
  }
}
