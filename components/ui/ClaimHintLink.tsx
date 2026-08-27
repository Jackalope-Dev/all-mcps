'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { trackFeatureUse } from '../../lib/gtag';

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
    (async () => {
      try {
        const res = await fetch(`/api/mcp/${serverId}/is-owner`);
        const data = res.ok
          ? ((await res.json()) as { isOwner?: boolean })
          : null;
        if (!cancelled) setShowHint(!data?.isOwner);
      } catch {
        // Network error — leave the hint hidden rather than guessing.
      }
    })();
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
