/**
 * One /api/mcp/[id]/is-owner request per listing per page view.
 *
 * OwnerZone, ClaimHintLink and AdminListingControls all need the answer and
 * each used to fetch it on mount, so every listing view paid for two to three
 * identical session + D1 lookups. They now share this promise. It is only
 * shared briefly, so a later visit (say, after claiming the listing through
 * client-side navigation) asks again.
 */
export type ListingOwnership = { isOwner: boolean; isAdmin: boolean };

const pending = new Map<string, Promise<ListingOwnership | null>>();
const SHARE_MS = 10_000;

/** Resolves to null when the check failed (network error or non-2xx). */
export function fetchListingOwnership(
  serverId: string,
): Promise<ListingOwnership | null> {
  let p = pending.get(serverId);
  if (!p) {
    p = fetch(`/api/mcp/${serverId}/is-owner`)
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as {
          isOwner?: boolean;
          isAdmin?: boolean;
        };
        return {
          isOwner: Boolean(data?.isOwner),
          isAdmin: Boolean(data?.isAdmin),
        };
      })
      .catch(() => null);
    const current = p;
    pending.set(serverId, current);
    // A failed check may be retried by the next component that mounts.
    current.then((r) => {
      if (r === null && pending.get(serverId) === current)
        pending.delete(serverId);
    });
    setTimeout(() => {
      if (pending.get(serverId) === current) pending.delete(serverId);
    }, SHARE_MS);
  }
  return p;
}
