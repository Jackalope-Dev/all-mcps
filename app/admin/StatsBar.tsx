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
      label: 'Moderation queue',
      value: String(totalPending),
      subtext:
        `${stats.pendingCounts?.submissions || 0} sub · ${stats.pendingCounts?.edits || 0} edit · ${stats.pendingCounts?.claims || 0} claim · ${stats.pendingCounts?.logos || 0} logo` +
        (stats.pendingCounts?.syncQueue
          ? ` (+${stats.pendingCounts.syncQueue} auto-sync)`
          : ''),
      icon: Clock,
      hue: totalPending > 0 ? 'hue-amber' : '',
      alert: totalPending > 0,
      action: { tab: 'moderation' } as KpiCardSelection,
    },
    {
      label: 'Active listings',
      value: String(stats.statusCounts.active),
      subtext: `${stats.statusCounts.removed} removed`,
      icon: CheckCircle2,
      hue: 'hue-green',
      alert: false,
      action: {
        tab: 'listings',
        filters: { status: 'active' },
      } as KpiCardSelection,
    },
    {
      label: 'Premium (dofollow)',
      value: String(stats.premiumCount),
      subtext: 'Paid / verified listings',
      icon: Crown,
      hue: 'hue-violet',
      alert: false,
      action: {
        tab: 'listings',
        filters: { premium: 'true', status: 'all' },
      } as KpiCardSelection,
    },
    {
      label: 'Featured boosts',
      value: String(stats.featuredCount),
      subtext: `${stats.categorySponsorsCount || 0} category sponsors`,
      icon: Sparkles,
      hue: 'hue-orange',
      alert: false,
      action: {
        tab: 'listings',
        filters: { featured: 'true', status: 'all' },
      } as KpiCardSelection,
    },
    {
      label: 'Unhealthy / offline',
      value: String(stats.unhealthyCount),
      subtext: 'Needs health re-check',
      icon: AlertTriangle,
      hue: stats.unhealthyCount > 0 ? 'hue-red' : '',
      alert: stats.unhealthyCount > 0,
      action: {
        tab: 'listings',
        filters: { health: 'unhealthy', status: 'all' },
      } as KpiCardSelection,
    },
    {
      label: 'AI enriched',
      value: `${stats.aiEnrichedCount || 0}`,
      subtext: `${aiEnrichedPercent}% of active catalog`,
      icon: Cpu,
      hue: 'hue-indigo',
      alert: false,
      action: {
        tab: 'listings',
        filters: { aiEnriched: 'true', status: 'all' },
      } as KpiCardSelection,
    },
    {
      label: 'Registered users',
      value: `${stats.usersCount || 0}`,
      subtext: 'Claimed owners & accounts',
      icon: User,
      hue: 'hue-blue',
      alert: false,
      action: { tab: 'analytics' } as KpiCardSelection,
    },
    {
      label: 'Introspection errors',
      value: `${stats.toolsIntrospectionErrorCount || 0}`,
      subtext: 'Failed MCP tool discovery',
      icon: AlertCircle,
      hue: (stats.toolsIntrospectionErrorCount || 0) > 0 ? 'hue-amber' : '',
      alert: (stats.toolsIntrospectionErrorCount || 0) > 0,
      action: {
        tab: 'listings',
        filters: { hasToolsError: 'true', status: 'all' },
      } as KpiCardSelection,
    },
  ];

  return (
    <ul className="adm-kpis" aria-label="Key metrics">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <li key={card.label}>
            <button
              type="button"
              onClick={() => handleCardClick(card)}
              className={`adm-kpi ${card.hue || 'is-quiet'}${card.alert ? ' is-alert' : ''}`}
            >
              <span className="adm-kpi-top">
                <span className="tint-tile" aria-hidden="true">
                  <Icon size={15} />
                </span>
                <span className="adm-kpi-label">{card.label}</span>
              </span>
              <span className="adm-kpi-value">{card.value}</span>
              <span className="adm-kpi-sub" title={card.subtext}>
                {card.subtext}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
