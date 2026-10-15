'use client';

import {
  AlertCircle,
  BarChart2,
  Bot,
  Download,
  Eye,
  Heart,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { AdminStats } from '@/lib/adminStats';
import { AdminCardHead } from './AdminUi';
import { CatalogCoverageCard } from './CatalogCoverageCard';

/** Ranked share bars (label, count, percent of total). */
function ShareBars({
  entries,
  hue,
  empty,
}: {
  entries: [string, number][];
  hue: string;
  empty: string;
}) {
  if (entries.length === 0) {
    return <p className="adm-card-empty">{empty}</p>;
  }
  const total = entries.reduce((acc, curr) => acc + curr[1], 0);
  return (
    <ul className={`adm-bars ${hue}`}>
      {entries.map(([key, count]) => {
        const percent = Math.round((count / (total || 1)) * 100);
        return (
          <li key={key}>
            <div className="adm-bar-row">
              <span className="adm-bar-label">{key.replace('_', ' ')}</span>
              <span className="adm-num">
                {count.toLocaleString()} ({percent}%)
              </span>
            </div>
            <div className="adm-bar">
              <span style={{ width: `${percent}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminAnalyticsView({ stats }: { stats: AdminStats }) {
  const callerEntries = Object.entries(stats.callerCounts || {}).sort(
    (a, b) => b[1] - a[1],
  );
  const surfaceEntries = Object.entries(stats.surfaceImpressions || {}).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <div className="adm-stack">
      <CatalogCoverageCard />

      <div className="adm-grid-2">
        {/* LLM & agent callers */}
        <div className="adm-card">
          <AdminCardHead icon={Bot} hue="hue-cyan" title="API & agent access" />
          <p className="adm-card-sub">
            Calls to programmatic endpoints (/api/v1/*, feeds) by AI agent
            client types.
          </p>
          <ShareBars
            entries={callerEntries}
            hue="hue-cyan"
            empty="No API caller logs recorded yet."
          />
        </div>

        {/* Surface impressions */}
        <div className="adm-card">
          <AdminCardHead
            icon={BarChart2}
            hue="hue-green"
            title="Surface impressions"
          />
          <p className="adm-card-sub">
            Impressions captured by site surface location (homepage, search,
            category hubs).
          </p>
          <ShareBars
            entries={surfaceEntries}
            hue="hue-green"
            empty="No surface impression logs recorded yet."
          />
        </div>
      </div>

      {/* Logo sources */}
      <div className="adm-card">
        <AdminCardHead
          icon={Layers}
          hue="hue-blue"
          title="Logo source distribution"
        />
        <p className="adm-card-sub">
          Where listing logos originate across active and submitted items.
        </p>
        <ul className="adm-tiles">
          {Object.entries(stats.logoSourceCounts).map(([src, count]) => (
            <li key={src} className="adm-tile">
              <div className="adm-tile-label">{src.replace('_', ' ')}</div>
              <div className="adm-tile-value">{count.toLocaleString()}</div>
            </li>
          ))}
        </ul>
      </div>

      {/* Recent tool introspection errors */}
      {stats.recentToolsErrors && stats.recentToolsErrors.length > 0 && (
        <div className="adm-card adm-card--warn">
          <AdminCardHead
            icon={AlertCircle}
            hue="hue-amber"
            title="Recent MCP introspection failures"
          />
          <p className="adm-card-sub">
            Listings that failed remote tool discovery on their last check.
          </p>
          <ul className="adm-rows">
            {stats.recentToolsErrors.map((item) => (
              <li key={item.id} className="is-stacked">
                <div className="adm-row-top">
                  <a
                    href={`/mcp/${item.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="adm-row-link"
                  >
                    {item.name}
                  </a>
                  <span className="adm-num">
                    {item.toolsCheckedAt
                      ? new Date(item.toolsCheckedAt).toLocaleDateString()
                      : 'Unchecked'}
                  </span>
                </div>
                <code className="adm-error-code">{item.toolsError}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Popular listings & engagement */}
      <div className="adm-card">
        <AdminCardHead
          icon={Sparkles}
          hue="hue-orange"
          title="Top viewed MCP servers"
          aside={
            <div className="adm-inline-stats">
              <span>
                <Eye size={14} aria-hidden="true" />
                {stats.engagement.totalViews.toLocaleString()} views
              </span>
              <span>
                <Heart size={14} aria-hidden="true" />
                {stats.engagement.totalUpvotes.toLocaleString()} upvotes
              </span>
              <span>
                <Download size={14} aria-hidden="true" />
                {stats.engagement.totalCopies.toLocaleString()} installs
              </span>
            </div>
          }
        />
        {stats.topByViews.length === 0 ? (
          <p className="adm-card-empty">No listing views recorded yet.</p>
        ) : (
          <ol className="adm-rows">
            {stats.topByViews.map((item, idx) => (
              <li key={item.id}>
                <span className="adm-row-start">
                  <span className="adm-rank">#{idx + 1}</span>
                  <a
                    href={`/mcp/${item.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="adm-row-link"
                  >
                    {item.name}
                  </a>
                </span>
                <span className="adm-num adm-num--accent">
                  {item.views.toLocaleString()} views
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
