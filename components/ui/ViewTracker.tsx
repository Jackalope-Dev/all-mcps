'use client';

import { Download, Eye } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IconTooltip } from './IconTooltip';

/**
 * Records a listing view on every page load (the server also bumps the
 * windowed ranking count when due) and displays the public view count next to
 * the listing header.
 */
export function ViewTracker({
  serverId,
  initialCount = 0,
}: {
  serverId: string;
  initialCount?: number;
}) {
  // Listing already tracked by this mount, so Strict Mode's double effect
  // doesn't count twice while client-side navigation to another listing does.
  const tracked = useRef<string | null>(null);
  const [views, setViews] = useState(initialCount || 0);

  // Re-sync the displayed count when the listing or its server-rendered count
  // changes (adjusted during render, React's "reset state on prop change" pattern).
  const [syncedFor, setSyncedFor] = useState({ initialCount, serverId });
  if (
    syncedFor.initialCount !== initialCount ||
    syncedFor.serverId !== serverId
  ) {
    setSyncedFor({ initialCount, serverId });
    setViews(initialCount || 0);
  }

  useEffect(() => {
    if (tracked.current === serverId) return;
    tracked.current = serverId;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/mcp/${serverId}/metric`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metric: 'view' }),
        });
        if (!cancelled && res.ok) setViews((prev) => prev + 1);
      } catch (e) {
        console.error('Failed to track view:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [serverId]);

  return (
    <IconTooltip
      label={`${views.toLocaleString()} views`}
      asSpan
      trigger={
        <fieldset
          className="detail-stat-item fieldset-plain"
          style={{ cursor: 'pointer' }}
          aria-label={`${views.toLocaleString()} ${views === 1 ? 'view' : 'views'}`}
        >
          <span className="detail-stat-item-label">
            <Eye size={12} aria-hidden="true" /> Views
          </span>
          <span className="detail-stat-item-value">
            {views.toLocaleString()}
          </span>
        </fieldset>
      }
    >
      <span className="mcp-icon-tooltip-title">
        <Eye size={14} style={{ color: 'var(--accent-color)' }} /> Views
      </span>
      <span className="mcp-icon-tooltip-body">
        Total visits recorded for this listing page on AllMCPs.
      </span>
    </IconTooltip>
  );
}

/** Compact installs tile for the sidebar stats grid (count is incremented by CopyBlock / the listing InstallPanel). */
export function InstallsStat({ count = 0 }: { count?: number }) {
  const n = count || 0;
  return (
    <IconTooltip
      label={`${n.toLocaleString()} total installs`}
      asSpan
      trigger={
        <fieldset
          className="detail-stat-item fieldset-plain"
          style={{ cursor: 'pointer' }}
          aria-label={`${n.toLocaleString()} ${n === 1 ? 'install' : 'installs'}`}
        >
          <span className="detail-stat-item-label">
            <Download size={12} aria-hidden="true" /> Installs
          </span>
          <span className="detail-stat-item-value">{n.toLocaleString()}</span>
        </fieldset>
      }
    >
      <span className="mcp-icon-tooltip-title">
        <Download size={14} style={{ color: 'var(--accent-color)' }} /> Installs
        &amp; Copy Actions
      </span>
      <span className="mcp-icon-tooltip-body">
        Total times users copied install commands or configuration snippets for
        this server.
      </span>
    </IconTooltip>
  );
}
