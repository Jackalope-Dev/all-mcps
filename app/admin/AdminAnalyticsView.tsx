'use client';

import type { AdminStats } from '@/lib/adminStats';
import { Eye, Heart, Download, Bot, Sparkles, Cpu, Layers } from 'lucide-react';

export function AdminAnalyticsView({ stats }: { stats: AdminStats }) {
  const callerEntries = Object.entries(stats.callerCounts || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="admin-analytics-shell" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="admin-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* LLM & Agent Callers Card */}
        <div className="admin-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Bot className="w-5 h-5 text-cyan-400" style={{ color: '#00E5FF' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>API & Agent Access</h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Calls to programmatic endpoints (/api/v1/*, feeds) by AI agent client types.
          </p>

          {callerEntries.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              No API caller logs recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {callerEntries.map(([caller, count]) => {
                const total = callerEntries.reduce((acc, curr) => acc + curr[1], 0);
                const percent = Math.round((count / (total || 1)) * 100);
                return (
                  <div key={caller}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{caller.replace('_', ' ')}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{count.toLocaleString()} ({percent}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${percent}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #00E5FF, #007BFF)',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Logo Sources Breakdown */}
        <div className="admin-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Layers className="w-5 h-5 text-blue-400" style={{ color: '#007BFF' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Logo Source Distribution</h3>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Where listing logos originate across active and submitted items.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
            {Object.entries(stats.logoSourceCounts).map(([src, count]) => (
              <div
                key={src}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  {src.replace('_', ' ')}
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{count.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Popular Listings & Engagement Card */}
      <div className="admin-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles className="w-5 h-5" style={{ color: '#fbbf24' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Top Viewed MCP Servers</h3>
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Eye className="w-4 h-4" /> {stats.engagement.totalViews.toLocaleString()} Views</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Heart className="w-4 h-4 text-red-400" /> {stats.engagement.totalUpvotes.toLocaleString()} Upvotes</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Download className="w-4 h-4 text-emerald-400" /> {stats.engagement.totalCopies.toLocaleString()} Installs</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {stats.topByViews.map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', width: '20px' }}>#{idx + 1}</span>
                <a
                  href={`/mcp/${item.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontWeight: 600, color: 'white', textDecoration: 'none' }}
                >
                  {item.name}
                </a>
              </div>
              <span style={{ fontSize: '0.85rem', color: '#00E5FF', fontWeight: 600 }}>
                {item.views.toLocaleString()} views
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
