'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { trackFeatureUse } from '../../lib/gtag';
import { fetchListingOwnership } from '../../lib/listingOwnershipClient';

/**
 * Renders the "own this listing?" nudge only for confirmed non-owners. Fetched
 * client-side (instead of the detail page checking the session server-side) so
 * the page itself stays cacheable — see app/api/mcp/[id]/is-owner/route.ts.
 * Starts hidden and only appears once the check resolves, so an actual owner
 * never sees it flash in.
 */
export function ClaimHintLink({ serverId }: { serverId: string }) {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // A failed check (null) leaves the hint hidden rather than guessing.
    fetchListingOwnership(serverId).then((data) => {
      if (!cancelled && data) setShowHint(!data.isOwner);
    });
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  if (!showHint) return null;

  return (
    <Link
      href={`/mcp/${serverId}/claim`}
      onClick={() => trackFeatureUse('claim_listing', { server_id: serverId })}
      style={{ color: 'var(--accent-color)' }}
    >
      Own this listing? Claim it to help us verify it.
    </Link>
  );
}
