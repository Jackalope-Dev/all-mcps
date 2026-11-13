import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { servers } from '../db/schema';
import {
  backoffSummary,
  CLEARED_BACKOFF,
  type EndpointProbeOutcome,
  nextBackoffState,
} from './endpointBackoff';
import { callMcpEndpoint } from './mcpIntrospect';
import { upsertSignals } from './signalStore';
import { isSafeSubmissionUrl } from './urlSafety';

type EndpointRow = {
  id: string;
  url: string;
  remoteEndpointUrl: string | null;
  installKind: string | null;
  installPackage: string | null;
};

/** The hosted endpoint the health cron handshakes for this listing, if any. */
function listingEndpoint(row: EndpointRow): string | null {
  if (row.remoteEndpointUrl) return row.remoteEndpointUrl;
  if (
    row.installKind === 'remote' &&
    row.installPackage &&
    row.installPackage !== row.url
  ) {
    return row.installPackage;
  }
  return null;
}

/**
 * Admin "Check health" and an approved endpoint edit: drop any backoff and
 * handshake the endpoint now, so a fixed endpoint (or one that has unblocked
 * us) doesn't wait out a 30-day pause. Records the answer the way the health
 * cron would, starting a fresh backoff if it still fails. Never throws.
 */
export async function recheckEndpointNow(
  db: DrizzleD1Database<any>,
  row: EndpointRow,
  now: Date = new Date(),
): Promise<{ endpoint: string | null; healthy: boolean | null; note: string }> {
  const endpoint = listingEndpoint(row);
  try {
    if (!endpoint || !isSafeSubmissionUrl(endpoint)) {
      await upsertSignals(db, row.id, CLEARED_BACKOFF);
      return { endpoint: null, healthy: null, note: 'No hosted endpoint.' };
    }
    const outcome: EndpointProbeOutcome = await callMcpEndpoint(endpoint, {
      method: 'tools/list',
    }).catch(() => ({ ok: false, error: 'Connection failed.' }));
    const state = nextBackoffState(null, endpoint, outcome, now);
    await db
      .update(servers)
      .set({
        remoteEndpointHealthy: outcome.ok,
        remoteEndpointCheckedAt: now,
        ...(outcome.ok ? { remoteEndpointHealthyAt: now } : {}),
      })
      .where(eq(servers.id, row.id));
    await upsertSignals(db, row.id, state);
    return {
      endpoint,
      healthy: outcome.ok,
      note: outcome.ok
        ? 'Endpoint answered.'
        : (backoffSummary(state, now) ?? 'Endpoint failed.'),
    };
  } catch (error) {
    console.error(`[endpoint-recheck] ${row.id} failed`, error);
    return { endpoint, healthy: null, note: 'Recheck failed.' };
  }
}
