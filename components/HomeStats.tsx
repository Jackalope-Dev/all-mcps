'use client';

import {
  Bot,
  Check,
  Copy,
  Eye,
  LayoutGrid,
  type LucideIcon,
  Server,
  Wrench,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Hue } from '../lib/palette';
import type { SiteStats } from '../lib/siteStats';
import { toast } from './ui/Toast';

function hasCountableStats(stats?: SiteStats) {
  return Boolean(
    stats &&
      ((stats.totalServers ?? 0) > 0 ||
        (stats.toolsIndexed ?? 0) > 0 ||
        (stats.totalViews ?? 0) > 0),
  );
}

function formatStat(n: number, compact: boolean): string {
  if (!compact || n < 10_000) return Math.round(n).toLocaleString('en-US');
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  return `${Math.round(n / 1_000).toLocaleString('en-US')}k`;
}

/**
 * Renders the final value on the server (no-JS / crawlers / no layout
 * shift). On the client, a number that starts off-screen resets to zero and
 * counts up once when it scrolls into view. Skipped under reduced motion and
 * when it is already visible at mount.
 */
function CountUp({ value, compact }: { value: number; compact: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || value <= 0) return;
    setShown(value);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return;

    setShown(0);
    let raf = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const duration = 1400;
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - (1 - t) ** 4;
          setShown(value * eased);
          if (t < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return (
    <span ref={ref} className="tabular">
      {formatStat(shown, compact)}
    </span>
  );
}

export function HomeStats({
  stats: initialStats,
  fallbackServers,
}: {
  stats?: SiteStats;
  fallbackServers: number;
}) {
  const [stats, setStats] = useState(initialStats);

  // The homepage is ISR-cached, so these numbers can be a zeroed build-time
  // snapshot (see app/api/site-stats). Refetch only in that case.
  useEffect(() => {
    if (hasCountableStats(initialStats)) return;
    let cancelled = false;
    fetch('/api/site-stats')
      .then((res) => (res.ok ? (res.json() as Promise<SiteStats>) : null))
      .then((fresh) => {
        if (!cancelled && fresh) setStats(fresh);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialStats]);

  const items = [
    {
      label: 'MCP servers listed',
      icon: Server as LucideIcon,
      hue: 'blue' as Hue,
      min: 1,
      value: Math.max(stats?.totalServers ?? 0, fallbackServers),
      compact: false,
    },
    {
      label: 'tools indexed',
      icon: Wrench as LucideIcon,
      hue: 'violet' as Hue,
      min: 100,
      value: stats?.toolsIndexed ?? 0,
      compact: true,
    },
    {
      label: 'categories',
      icon: LayoutGrid as LucideIcon,
      hue: 'amber' as Hue,
      min: 5,
      value: stats?.categoryCount ?? 0,
      compact: false,
    },
    {
      label: 'AI system reads, 30 days',
      icon: Bot as LucideIcon,
      hue: 'pink' as Hue,
      min: 100,
      value: stats?.aiReads30d ?? 0,
      compact: true,
    },
    {
      label: 'listing views',
      icon: Eye as LucideIcon,
      hue: 'teal' as Hue,
      min: 100,
      value: stats?.totalViews ?? 0,
      compact: true,
    },
  ]
    // Tiny counts (e.g. a sparse local/dev catalog) read as a weakness, not
    // proof — only show a stat once it is meaningfully large.
    .filter((item) => item.value >= item.min)
    .slice(0, 4);

  if (items.length === 0) return null;

  return (
    <dl className="home-stats">
      {items.map((item) => (
        <div key={item.label} className="home-stat">
          <dt className={`home-stat-label hue-${item.hue}`}>
            <span className="home-stat-icon tint-tile" aria-hidden="true">
              <item.icon size={13} />
            </span>
            {item.label}
          </dt>
          <dd className="home-stat-value">
            <CountUp value={item.value} compact={item.compact} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(command).then(
      () => {
        setCopied(true);
        toast.success('Copied to clipboard');
        setTimeout(() => setCopied(false), 1800);
      },
      () => toast.error('Could not copy — select the text instead'),
    );
  };

  return (
    <div className="home-copy">
      <code>
        <span className="home-copy-prompt" aria-hidden="true">
          $
        </span>
        {command}
      </code>
      <button
        type="button"
        className="btn btn-ghost btn-sm btn-icon home-copy-btn"
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy command'}
      >
        {copied ? (
          <Check size={15} aria-hidden="true" />
        ) : (
          <Copy size={15} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
