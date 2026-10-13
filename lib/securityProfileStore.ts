import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { listingSignals } from '../db/schema';
import {
  buildSecurityProfile,
  parseSecurityProfile,
  type SandboxObservations,
  type ToolDefinition,
  toolsChanged,
} from './securityProfile';
import { upsertSignals } from './signalStore';

/**
 * Rebuild and store a listing's security profile from freshly observed tools.
 * Shared by the E2B result route and the health cron's live remote handshake,
 * so both transports feed the same profile and the same change detection.
 *
 * Sandbox observations from a previous run are kept when this run has none
 * (a remote handshake never has any), so a health-cron pass does not erase
 * what the sandbox saw.
 */
export async function storeSecurityProfile(
  db: DrizzleD1Database<any>,
  serverId: string,
  tools: ToolDefinition[],
  sandbox: SandboxObservations | undefined,
  now: Date,
  /**
   * The stored profile JSON when the caller already loaded it; skips the read.
   */
  previousRaw?: string | null,
): Promise<{ changed: boolean }> {
  let raw = previousRaw;
  if (raw === undefined) {
    const [row] = await db
      .select({ securityProfile: listingSignals.securityProfile })
      .from(listingSignals)
      .where(eq(listingSignals.serverId, serverId))
      .limit(1);
    raw = row?.securityProfile ?? null;
  }
  const previous = parseSecurityProfile(raw);
  const next = buildSecurityProfile(tools, sandbox ?? previous?.sandbox, now);
  const changed = toolsChanged(previous, next);
  // An unchanged tool surface with no new sandbox data needs no write — the
  // health cron revisits remote listings every 15 minutes.
  if (previous && !changed && !sandbox) {
    return { changed: false };
  }
  await upsertSignals(db, serverId, {
    securityProfile: JSON.stringify(next),
    ...(changed ? { toolsChangedAt: now } : {}),
  });
  return { changed };
}
