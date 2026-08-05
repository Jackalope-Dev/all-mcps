'use client';

import { useEffect, useState } from 'react';
import type { AdminStats } from '@/lib/adminStats';
import { ADMIN_STATS_REFRESH_EVENT } from '@/lib/adminStatsRefresh';
import { Clock, CheckCircle2, Crown, Sparkles, AlertTriangle, Cpu, Eye, Heart, Download } from 'lucide-react';

export function StatsBar({
  initialStats,
  onSelectTab,
}: {
  initialStats: AdminStats;
  onSelectTab?: (tab: string) => void;
}) {
  const [stats, setStats] = useState<AdminStats>(initialStats);

  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch('/api/admin/stats');
        if (!res.ok) return;
        const data = (await res.json()) as AdminStats;
        setStats(data);
      } catch {
        // Best-effort refresh — keep showing the last known stats on failure.
      }
    };
    window.addEventListener(ADMIN_STATS_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(ADMIN_STATS_REFRESH_EVENT, refresh);
  }, []);

  const totalPending = stats.pendingCounts?.total ?? stats.statusCounts.pending;
  const aiEnrichedPercent = stats.statusCounts.active
    ? Math.round(((stats.aiEnrichedCount || 0) / stats.statusCounts.active) * 100)
    : 0;

  const cards = [
    {
      label: 'Moderation Queue',
      value: String(totalPending),
      subtext: `${stats.pendingCounts?.submissions || 0} sub · ${stats.pendingCounts?.edits || 0} edit · ${stats.pendingCounts?.claims || 0} claim`,
      icon: Clock,
      color: totalPending > 0 ? '#fbbf24' : 'var(--text-secondary)',
      tab: 'moderation',
    },
    {
      label: 'Active Listings',
      value: String(stats.statusCounts.active),
      subtext: `${stats.statusCounts.removed} removed`,
      icon: CheckCircle2,
      color: '#10b981',
      tab: 'listings',
    },
    {
      label: 'Premium (Dofollow)',
      value: String(stats.premiumCount),
      subtext: 'Paid / verified listings',
      icon: Crown,
      color: '#00E5FF',
      tab: 'listings',
    },
    {
      label: 'Featured Boosts',
      value: String(stats.featuredCount),
      subtext: 'Active placement boosts',
      icon: Sparkles,
      color: '#ffd700',
      tab: 'listings',
    },
    {
      label: 'Unhealthy / Offline',
      value: String(stats.unhealthyCount),
      subtext: 'Needs health re-check',
      icon: AlertTriangle,
      color: stats.unhealthyCount > 0 ? '#ef4444' : 'var(--text-secondary)',
      tab: 'listings',
    },
    {
      label: 'AI Enriched',
      value: `${stats.aiEnrichedCount || 0}`,
      subtext: `${aiEnrichedPercent}% of active catalog`,
      icon: Cpu,
      color: '#8b5cf6',
      tab: 'analytics',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.85rem',
        }}
      >
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              onClick={() => onSelectTab && onSelectTab(card.tab)}
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem',
                cursor: onSelectTab ? 'pointer' : 'default',
                transition: 'transform 0.15s ease, border-color 0.15s ease',
              }}
              className="admin-kpi-card hover:border-cyan-500/40"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span
                  style={{
                    fontSize: '0.725rem',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    letterSpacing: '0.03em',
                  }}
                >
                  {card.label}
                </span>
                <Icon className="w-4 h-4" style={{ color: card.color }} />
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.2rem' }}>{card.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {card.subtext}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
