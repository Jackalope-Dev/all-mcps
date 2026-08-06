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
  showBorder = true,
}: {
  serverId: string;
  initialCount?: number;
  /** Whether this row shows the divider used between sidebar spec rows (false for the last row). */
  showBorder?: boolean;
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
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: showBorder ? '1px solid var(--border-color)' : 'none',
        paddingBottom: showBorder ? '0.5rem' : 0,
      }}
      title="Unique views"
      aria-label={`${views.toLocaleString()} unique ${views === 1 ? 'view' : 'views'}`}
    >
      <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
        <Eye size={14} aria-hidden="true" /> Views
      </span>
      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{views.toLocaleString()}</span>
    </div>
  );
}

/** Compact installs row for the sidebar spec card (count is incremented by CopyBlock / AgentPromptButton). */
export function InstallsStat({ count = 0, showBorder = true }: { count?: number; showBorder?: boolean }) {
  const n = count || 0;
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: showBorder ? '1px solid var(--border-color)' : 'none',
        paddingBottom: showBorder ? '0.5rem' : 0,
      }}
      title="Install / copy actions"
      aria-label={`${n.toLocaleString()} ${n === 1 ? 'install' : 'installs'}`}
    >
      <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
        <Download size={14} aria-hidden="true" /> Installs
      </span>
      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{n.toLocaleString()}</span>
    </div>
  );
}
