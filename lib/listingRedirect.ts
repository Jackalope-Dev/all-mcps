/**
 * 308 hops for retired duplicate listings. `getServerById` returns the
 * requested row unchanged; pages and public APIs call these helpers.
 */

import { permanentRedirect } from 'next/navigation';

export type RedirectableListing = {
  id: string;
  status?: string | null;
  redirectTo?: string | null;
};

export type MergeTargetRow = {
  id: string;
  status: string;
  redirectTo?: string | null;
};

/** Canonical id to 308 to, or null if this row should render in place. */
export function listingRedirectTarget(
  requestedId: string,
  server: RedirectableListing | null | undefined,
): string | null {
  if (!server) return null;
  const target = server.redirectTo?.trim() ?? '';
  if (!target || target === requestedId) return null;
  return target;
}

/** Site path for a 308, preserving `/readme`, `/claim`, `/vs/:other`, etc. */
export function listingRedirectPath(
  requestedId: string,
  server: RedirectableListing | null | undefined,
  restPath = '',
): string | null {
  const target = listingRedirectTarget(requestedId, server);
  if (!target) return null;
  const suffix =
    !restPath || restPath.startsWith('/') ? restPath : `/${restPath}`;
  return `/mcp/${target}${suffix}`;
}

/** Throws a 308 when the requested listing has been merged or retargeted. */
export function redirectIfListingMoved(
  requestedId: string,
  server: RedirectableListing | null | undefined,
  restPath = '',
): void {
  const path = listingRedirectPath(requestedId, server, restPath);
  if (path) permanentRedirect(path);
}

/**
 * Walk `redirectTo` on the merge target so we store the terminal canonical
 * id, reject cycles, and refuse a non-active destination.
 */
export async function resolveCanonicalMergeTarget(
  sourceId: string,
  firstTargetId: string,
  lookup: (id: string) => Promise<MergeTargetRow | undefined>,
): Promise<{ canonicalId: string } | { error: string }> {
  const source = sourceId.trim();
  let current = firstTargetId.trim();
  if (!current) {
    return { error: 'targetId is required for merge_duplicate.' };
  }
  if (current === source) {
    return { error: 'Cannot merge a listing into itself.' };
  }

  const visited = new Set<string>([source]);
  for (let hops = 0; hops < 20; hops++) {
    if (visited.has(current)) {
      return { error: 'Merge would create a redirect cycle.' };
    }
    const row = await lookup(current);
    if (!row) {
      return { error: `Target listing "${current}" not found.` };
    }
    visited.add(current);
    const next = row.redirectTo?.trim() ?? '';
    if (!next) {
      if (row.status !== 'active') {
        return { error: `Target listing "${current}" is not active.` };
      }
      return { canonicalId: current };
    }
    current = next;
  }
  return { error: 'Redirect chain is too long.' };
}

/** 308 both sides of `/mcp/:id/vs/:other` when either listing has moved. */
export function compareRedirectPath(
  id: string,
  other: string,
  left: RedirectableListing | null | undefined,
  right: RedirectableListing | null | undefined,
): string | null {
  const leftTarget = listingRedirectTarget(id, left);
  const rightTarget = listingRedirectTarget(other, right);
  if (!leftTarget && !rightTarget) return null;
  const a = leftTarget ?? id;
  const b = rightTarget ?? other;
  if (a === b) return null;
  return `/mcp/${a}/vs/${b}`;
}
