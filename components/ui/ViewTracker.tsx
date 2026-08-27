'use client';

import { Download, Eye } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IconTooltip } from './IconTooltip';

const viewKey = (serverId: string) => `view_${serverId}`;

/**
 * Records a unique listing view (IP-hash + localStorage, same model as upvotes)
 * and displays the live view count next to the listing header.
 */
export function ViewTracker({
  serverId,
  initialCount = 0,
}: {
  serverId: string;
  initialCount?: number;
}) {
  const tracked = useRef(false);
  const [views, setViews] = useState(initialCount || 0);

  useEffect(() => {
    setViews(initialCount || 0);
  }, [initialCount, serverId]);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;

    if (typeof window === 'undefined') return;

    // Client convenience gate (mirrors upvote localStorage). Server still enforces uniqueness.
    try {
      if (window.localStorage.getItem(viewKey(serverId))) {
        return;
      }
    } catch {
      // private mode / blocked storage — still try the network path
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/mcp/${serverId}/metric`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metric: 'view' }),
        });

        if (cancelled) return;

        if (res.ok) {
          setViews((prev) => prev + 1);
          try {
            window.localStorage.setItem(viewKey(serverId), 'true');
          } catch {
            /* ignore */
          }
          return;
        }

        if (res.status === 409) {
          // Already counted for this IP (or racing Strict Mode double-fire)
          try {
            window.localStorage.setItem(viewKey(serverId), 'true');
          } catch {
            /* ignore */
          }
          return;
        }

        // Other errors: leave localStorage clear so a later visit can retry
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
      label={`${views.toLocaleString()} unique views`}
      asSpan
      trigger={
        <div
          className="detail-stat-item"
          style={{ cursor: 'pointer' }}
          role="group"
          aria-label={`${views.toLocaleString()} unique ${views === 1 ? 'view' : 'views'}`}
        >
          <span className="detail-stat-item-label">
            <Eye size={12} aria-hidden="true" /> Views
          </span>
          <span className="detail-stat-item-value">
            {views.toLocaleString()}
          </span>
        </div>
      }
    >
      <span className="mcp-icon-tooltip-title">
        <Eye size={14} style={{ color: 'var(--accent-color)' }} /> Unique Views
      </span>
      <span className="mcp-icon-tooltip-body">
        Total visits recorded for this listing page on AllMCPs.
      </span>
    </IconTooltip>
  );
}

/** Compact installs tile for the sidebar stats grid (count is incremented by CopyBlock / AgentPromptButton). */
export function InstallsStat({ count = 0 }: { count?: number }) {
  const n = count || 0;
  return (
    <IconTooltip
      label={`${n.toLocaleString()} total installs`}
      asSpan
      trigger={
        <div
          className="detail-stat-item"
          style={{ cursor: 'pointer' }}
          role="group"
          aria-label={`${n.toLocaleString()} ${n === 1 ? 'install' : 'installs'}`}
        >
          <span className="detail-stat-item-label">
            <Download size={12} aria-hidden="true" /> Installs
          </span>
          <span className="detail-stat-item-value">{n.toLocaleString()}</span>
        </div>
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
