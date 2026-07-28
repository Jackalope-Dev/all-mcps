'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye, Download } from 'lucide-react';

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
    <div
      className="listing-metric-pill"
      title="Unique views"
      aria-label={`${views.toLocaleString()} unique ${views === 1 ? 'view' : 'views'}`}
    >
      <Eye size={16} aria-hidden="true" />
      <span>
        {views.toLocaleString()} {views === 1 ? 'View' : 'Views'}
      </span>
    </div>
  );
}

/** Compact installs display for the detail page (count is incremented by CopyBlock / AgentPromptButton). */
export function InstallsStat({ count = 0 }: { count?: number }) {
  const n = count || 0;
  return (
    <div
      className="listing-metric-pill"
      title="Install / copy actions"
      aria-label={`${n.toLocaleString()} ${n === 1 ? 'install' : 'installs'}`}
    >
      <Download size={16} aria-hidden="true" />
      <span>
        {n.toLocaleString()} {n === 1 ? 'Install' : 'Installs'}
      </span>
    </div>
  );
}
