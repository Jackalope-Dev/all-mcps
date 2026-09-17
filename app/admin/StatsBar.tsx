'use client';

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Crown,
  Sparkles,
  User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AdminStats } from '@/lib/adminStats';
import { ADMIN_STATS_REFRESH_EVENT } from '@/lib/adminStatsRefresh';

export type KpiCardSelection = {
  tab:
    | 'overview'
    | 'moderation'
    | 'listings'
    | 'analytics'
    | 'social'
    | 'tools';
  filters?: {
    status?: string;
    premium?: string;
    featured?: string;
    health?: string;
    aiEnriched?: string;
    categorySponsor?: string;
    hasToolsError?: string;
  };
};

export function StatsBar({
  initialStats,
  onSelectCard,
  onSelectTab,
}: {
  initialStats: AdminStats;
  onSelectCard?: (selection: KpiCardSelection) => void;
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
    ? Math.round(
        ((stats.aiEnrichedCount || 0) / stats.statusCounts.active) * 100,
      )
    : 0;

  const handleCardClick = (card: (typeof cards)[0]) => {
    if (onSelectCard) {
      onSelectCard(card.action);
    } else if (onSelectTab) {
      onSelectTab(card.action.tab);
    }
  };

  const cards = [
    {
      label: 'Moderation Queue',
      value: String(totalPending),
      subtext:
        `${stats.pendingCounts?.submissions || 0} sub · ${stats.pendingCounts?.edits || 0} edit · ${stats.pendingCounts?.claims || 0} claim · ${stats.pendingCounts?.logos || 0} logo` +
        (stats.pendingCounts?.syncQueue
          ? ` (+${stats.pendingCounts.syncQueue} auto-sync)`
          : ''),
      icon: Clock,
      color: totalPending > 0 ? '#d97706' : 'var(--text-secondary)',
      action: { tab: 'moderation' } as KpiCardSelection,
    },
    {
      label: 'Active Listings',
      value: String(stats.statusCounts.active),
      subtext: `${stats.statusCounts.removed} removed`,
      icon: CheckCircle2,
      color: '#10b981',
      action: {
        tab: 'listings',
        filters: { status: 'active' },
      } as KpiCardSelection,
    },
    {
      label: 'Premium (Dofollow)',
      value: String(stats.premiumCount),
      subtext: 'Paid / verified listings',
      icon: Crown,
      color: 'var(--accent-color)',
      action: {
        tab: 'listings',
        filters: { premium: 'true', status: 'all' },
      } as KpiCardSelection,
    },
    {
      label: 'Featured Boosts',
      value: String(stats.featuredCount),
      subtext: `${stats.categorySponsorsCount || 0} category sponsors`,
      icon: Sparkles,
      color: '#d97706',
      action: {
        tab: 'listings',
        filters: { featured: 'true', status: 'all' },
      } as KpiCardSelection,
    },
    {
      label: 'Unhealthy / Offline',
      value: String(stats.unhealthyCount),
      subtext: 'Needs health re-check',
      icon: AlertTriangle,
      color: stats.unhealthyCount > 0 ? '#ef4444' : 'var(--text-secondary)',
      action: {
        tab: 'listings',
        filters: { health: 'unhealthy', status: 'all' },
      } as KpiCardSelection,
    },
    {
      label: 'AI Enriched',
      value: `${stats.aiEnrichedCount || 0}`,
      subtext: `${aiEnrichedPercent}% of active catalog`,
      icon: Cpu,
      color: '#8b5cf6',
      action: {
        tab: 'listings',
        filters: { aiEnriched: 'true', status: 'all' },
      } as KpiCardSelection,
    },
    {
      label: 'Registered Users',
      value: `${stats.usersCount || 0}`,
      subtext: 'Claimed owners & accounts',
      icon: User,
      color: '#0284c7',
      action: { tab: 'analytics' } as KpiCardSelection,
    },
    {
      label: 'Introspection Errors',
      value: `${stats.toolsIntrospectionErrorCount || 0}`,
      subtext: 'Failed MCP tool discovery',
      icon: AlertCircle,
      color:
        (stats.toolsIntrospectionErrorCount || 0) > 0
          ? '#f59e0b'
          : 'var(--text-secondary)',
      action: {
        tab: 'listings',
        filters: { hasToolsError: 'true', status: 'all' },
      } as KpiCardSelection,
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        marginBottom: '2rem',
      }}
    >
      <ul
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.85rem',
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
      >
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <li
              key={card.label}
              onClick={() => handleCardClick(card)}
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '0.9rem 1rem',
                cursor: 'pointer',
                transition:
                  'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '110px',
              }}
              className="admin-kpi-card hover:border-cyan-500/40 hover:-translate-y-0.5"
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  height: '1.4rem',
                }}
              >
                <span
                  style={{
                    fontSize: '0.725rem',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    letterSpacing: '0.03em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {card.label}
                </span>
                <Icon
                  className="w-4 h-4"
                  style={{ color: card.color, flexShrink: 0 }}
                />
              </div>
              <div
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  lineHeight: 1,
                  margin: '0.25rem 0',
                }}
              >
                {card.value}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  height: '1rem',
                  lineHeight: '1rem',
                }}
              >
                {card.subtext}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
