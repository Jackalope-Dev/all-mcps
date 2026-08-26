'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bot, Cpu, Wrench, Eye, Loader2 } from 'lucide-react';
import type { SiteStats } from '../lib/siteStats';

function formatCompactNumber(num: number): string {
  if (num >= 1_000_000) {
    const formatted = (num / 1_000_000).toFixed(1);
    return `${formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted}M+`;
  }
  if (num >= 1_000) {
    const formatted = (num / 1_000).toFixed(1);
    return `${formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted}k+`;
  }
  return num.toLocaleString('en-US');
}

function formatExactNumber(num: number): string {
  return num.toLocaleString('en-US');
}

function hasCountableStats(stats?: SiteStats) {
  if (!stats) return false;
  return (stats.totalServers ?? 0) > 0 || (stats.toolsIndexed ?? 0) > 0 || (stats.totalViews ?? 0) > 0;
}

export function StatsBanner({ stats: initialStats }: { stats?: SiteStats }) {
  const [stats, setStats] = useState(initialStats);
  const [loaded, setLoaded] = useState(() => hasCountableStats(initialStats));

  // The homepage shell is ISR-cached (see app/page.tsx), so these numbers can
  // be frozen to a stale/zeroed build-time snapshot — see app/api/site-stats.
  // Refetch live on mount so the banner self-corrects instead of staying stuck.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/site-stats')
      .then((res) => (res.ok ? (res.json() as Promise<SiteStats>) : null))
      .then((fresh) => {
        if (cancelled) return;
        if (fresh) setStats(fresh);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the homepage proof strip to high-signal metrics; full breakdown lives on /trust.
  const totalServers = stats?.totalServers ?? 0;
  const aiReads = stats?.aiReads30d ?? 0;
  const toolsIndexed = stats?.toolsIndexed ?? 0;
  const totalViews = stats?.totalViews ?? 0;
  const hasCountStat = totalServers > 0 || toolsIndexed > 0 || totalViews > 0;

  // The Trust link is always rendered — including mid-load and even if every
  // count comes back zero — so this pill never disappears out from under a
  // reader who was about to click through to /trust. It also means the
  // loading state reuses the exact same "stats-banner-pill" markup as the
  // loaded state (just swapping the first item for a spinner), so the pill's
  // height matches on both sides of the fetch instead of a shorter skeleton
  // guess growing once data lands.
  return (
    <div className="stats-banner" aria-label="Platform statistics">
      <Link
        href="/trust"
        className="stats-banner-pill"
        title="View the live verified registry and traffic analytics on /trust"
      >
        {!loaded ? (
          <span className="stats-banner-item">
            <Loader2 size={13} className="animate-spin" style={{ color: 'var(--text-secondary)' }} aria-hidden="true" />
            Loading site stats…
          </span>
        ) : (
          <>
            {totalServers > 0 && (
              <span className="stats-banner-item">
                <Cpu size={14} style={{ color: '#34d399', flexShrink: 0 }} aria-hidden="true" />
                <span><strong>{formatExactNumber(totalServers)}</strong>&nbsp;MCP servers</span>
              </span>
            )}

            {toolsIndexed > 0 && (
              <span className="stats-banner-item">
                <span className="stats-banner-dot" aria-hidden="true">
                  •
                </span>
                <Wrench size={13} style={{ color: '#fbbf24', flexShrink: 0 }} aria-hidden="true" />
                <span><strong>{formatCompactNumber(toolsIndexed)}</strong>&nbsp;tools indexed</span>
              </span>
            )}

            {totalViews > 0 && (
              <span className="stats-banner-item">
                <span className="stats-banner-dot" aria-hidden="true">
                  •
                </span>
                <Eye size={13} style={{ color: '#60a5fa', flexShrink: 0 }} aria-hidden="true" />
                <span><strong>{formatCompactNumber(totalViews)}</strong>&nbsp;views</span>
              </span>
            )}

            {aiReads > 0 && (
              <span className="stats-banner-item">
                <span className="stats-banner-dot" aria-hidden="true">
                  •
                </span>
                <Bot size={14} style={{ color: 'var(--tab-discover, #00e5ff)', flexShrink: 0 }} aria-hidden="true" />
                <span><strong>{formatCompactNumber(aiReads)}</strong>&nbsp;AI reads</span>
              </span>
            )}
          </>
        )}
      </Link>
    </div>
  );
}
