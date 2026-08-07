'use client';

import { useState } from 'react';
import { toast } from '@/components/ui/Toast';
import {
  Wrench,
  Play,
  Sparkles,
  Activity,
  Search,
  Share2,
  Mail,
  Cpu,
  ShieldCheck,
  Crown,
  ExternalLink,
  RefreshCw,
  Plus,
  Zap,
} from 'lucide-react';
import { computeQualityScore, tierColor } from '@/lib/qualityScore';

type UtilityAction = {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: any;
  color: string;
};

const UTILITY_ACTIONS: UtilityAction[] = [
  {
    id: 'health',
    name: 'Health & Reciprocal Badge Check',
    category: 'System Health',
    description: 'Rechecks listing HTTP endpoints, reciprocal badges, GitHub stars, npm downloads, and active health states.',
    icon: Activity,
    color: '#10b981',
  },
  {
    id: 'ai-content',
    name: 'AI Catalog Enrichment Engine',
    category: 'AI & Metadata',
    description: 'Generates AI summaries, plain-language overviews, key features, and install commands for scraped MCP listings.',
    icon: Sparkles,
    color: '#0284c7',
  },
  {
    id: 'enrich',
    name: 'Tool Introspection Sync',
    category: 'MCP Schemas',
    description: 'Attempts remote MCP tool list introspection for active listings and stores callable JSON tool schemas.',
    icon: Cpu,
    color: '#8b5cf6',
  },
  {
    id: 'highlight',
    name: 'Twitter Spotlight Queue',
    category: 'Social Marketing',
    description: 'Rotates least-recently-tweeted active MCP servers and enqueues a highlight tweet for RSS broadcast.',
    icon: Share2,
    color: '#2563eb',
  },
  {
    id: 'indexnow',
    name: 'IndexNow Search Pinger',
    category: 'SEO & Indexing',
    description: 'Notifies Bing, Yandex, and IndexNow search engines of new and updated listing URLs for rapid indexing.',
    icon: Search,
    color: '#d97706',
  },
];

export function AdminToolsControl() {
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [lastResults, setLastResults] = useState<Record<string, { status: number; text: string; time: string }>>({});
  
  // Interactive Server Inspector
  const [inspectorId, setInspectorId] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [inspectedServer, setInspectedServer] = useState<any | null>(null);

  const handleRunJob = async (jobId: string) => {
    setRunningJob(jobId);
    try {
      const res = await fetch('/api/admin/crons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: jobId }),
      });
      const data: any = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.result?.error || `Action failed with status ${data.statusCode}`);
      }

      toast.success(`${jobId} action completed successfully!`);
      setLastResults((prev) => ({
        ...prev,
        [jobId]: {
          status: data.statusCode,
          text: JSON.stringify(data.result, null, 2),
          time: new Date().toLocaleTimeString(),
        },
      }));
    } catch (err: any) {
      toast.error(`Action trigger failed`, { description: err?.message });
      setLastResults((prev) => ({
        ...prev,
        [jobId]: {
          status: 500,
          text: err?.message || 'Error executing action',
          time: new Date().toLocaleTimeString(),
        },
      }));
    } finally {
      setRunningJob(null);
    }
  };

  const handleInspectLookup = async () => {
    const term = inspectorId.trim();
    if (!term) {
      toast.error('Enter a Server ID or slug to inspect.');
      return;
    }

    setInspecting(true);
    setInspectedServer(null);
    try {
      const res = await fetch(`/api/admin/listings?search=${encodeURIComponent(term)}&limit=1`);
      const data: any = await res.json();

      if (!res.ok || !data.items || data.items.length === 0) {
        throw new Error('Server not found in directory catalog.');
      }

      setInspectedServer(data.items[0]);
      toast.success(`Loaded metadata for "${data.items[0].name}"`);
    } catch (err: any) {
      toast.error('Inspection failed', { description: err?.message });
    } finally {
      setInspecting(false);
    }
  };

  const handleQuickServerAction = async (
    action: 'feature' | 'set_premium' | 'unset_premium' | 'queue_tweet'
  ) => {
    if (!inspectedServer) return;
    const id = inspectedServer.id;
    setRunningJob(`quick_${action}`);

    try {
      if (action === 'queue_tweet') {
        const res = await fetch('/api/admin/social', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'queue_tweet', serverId: id }),
        });
        const data: any = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to queue tweet');
        toast.success(`Queued tweet for "${inspectedServer.name}"!`);
      } else {
        const payload: any = { id, action };
        if (action === 'feature') payload.days = 14;

        const res = await fetch('/api/admin/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data: any = await res.json();
        if (!res.ok) throw new Error(data.error || 'Action failed');

        toast.success(data.message || 'Action completed');
        // Refresh inspection card
        handleInspectLookup();
      }
    } catch (err: any) {
      toast.error('Quick action failed', { description: err?.message });
    } finally {
      setRunningJob(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div className="admin-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Wrench size={20} style={{ color: 'var(--accent-color)' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Admin Tools & Maintenance Utilities
          </h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          Run one-click site maintenance scripts, inspect server quality metrics, or execute quick administrative overrides.
        </p>
      </div>

      {/* Interactive Server Inspector Console */}
      <div className="admin-card" style={{ padding: '1.25rem' }}>
        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={16} style={{ color: '#d97706' }} />
          Listing Inspector & Instant Action Bar
        </h4>
        <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Look up any listing by ID to inspect Quality Score, Tool Schemas, Health state, and execute 1-click admin actions.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input
            className="form-input"
            style={{ flex: 1, minWidth: '260px' }}
            placeholder="Type server ID or name (e.g. allmcps-server)..."
            value={inspectorId}
            onChange={(e) => setInspectorId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInspectLookup()}
          />
          <button
            onClick={handleInspectLookup}
            disabled={inspecting || !inspectorId.trim()}
            className="admin-btn"
            style={{ background: 'var(--accent-color)', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Search size={14} /> {inspecting ? 'Inspecting…' : 'Inspect Server'}
          </button>
        </div>

        {inspectedServer && (
          <div
            style={{
              background: 'rgba(128, 128, 128, 0.05)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '1rem 1.15rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}
          >
            {/* Inspector Summary Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h5 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {inspectedServer.name}
                </h5>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>ID: {inspectedServer.id} · Category: {inspectedServer.category}</span>
              </div>
              {(() => {
                const qs = computeQualityScore(inspectedServer);
                const color = tierColor(qs.tier);
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{qs.score}/100</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color, background: `${color}22`, border: `1px solid ${color}55`, borderRadius: '999px', padding: '0.15rem 0.55rem' }}>
                      {qs.tier}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Vitals Pills */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
              <span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', background: 'rgba(128, 128, 128, 0.1)', border: '1px solid var(--border-color)' }}>
                Health: <strong>{inspectedServer.healthStatus || 'unknown'}</strong>
              </span>
              <span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', background: 'rgba(128, 128, 128, 0.1)', border: '1px solid var(--border-color)' }}>
                Views: <strong>{(inspectedServer.views || 0).toLocaleString()}</strong>
              </span>
              <span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', background: 'rgba(128, 128, 128, 0.1)', border: '1px solid var(--border-color)' }}>
                Upvotes: <strong>{(inspectedServer.upvotes || 0).toLocaleString()}</strong>
              </span>
              {inspectedServer.isPremium && (
                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', fontWeight: 700 }}>
                  ★ Premium Dofollow
                </span>
              )}
            </div>

            {/* Quick Actions Bar */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
              <button
                onClick={() => handleQuickServerAction('feature')}
                disabled={runningJob !== null}
                className="admin-btn"
                style={{ background: '#d97706', fontSize: '0.78rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <Zap size={13} /> Grant 14d Boost
              </button>
              <button
                onClick={() => handleQuickServerAction(inspectedServer.isPremium ? 'unset_premium' : 'set_premium')}
                disabled={runningJob !== null}
                className="admin-btn"
                style={{ background: '#0284c7', fontSize: '0.78rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <Crown size={13} /> {inspectedServer.isPremium ? 'Unset Premium' : 'Mark Premium'}
              </button>
              <button
                onClick={() => handleQuickServerAction('queue_tweet')}
                disabled={runningJob !== null}
                className="admin-btn"
                style={{ background: '#2563eb', fontSize: '0.78rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <Share2 size={13} /> Enqueue Tweet
              </button>
              <a
                href={`/mcp/${inspectedServer.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-btn"
                style={{ background: 'rgba(128, 128, 128, 0.1)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontSize: '0.78rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}
              >
                <ExternalLink size={13} /> View Listing
              </a>
            </div>
          </div>
        )}
      </div>

      {/* One-Click Maintenance Utility Actions Grid */}
      <ul role="list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', listStyle: 'none', margin: 0, padding: 0 }}>
        {UTILITY_ACTIONS.map((job) => {
          const Icon = job.icon;
          const isRunning = runningJob === job.id;
          const result = lastResults[job.id];

          return (
            <li
              key={job.id}
              className="admin-card"
              style={{
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${job.color}15`, border: `1px solid ${job.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon className="w-4 h-4" style={{ color: job.color }} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>{job.name}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{job.category}</span>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '1rem' }}>
                  {job.description}
                </p>

                {result && (
                  <div
                    style={{
                      background: 'rgba(128, 128, 128, 0.05)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.75rem',
                      marginBottom: '1rem',
                      maxHeight: '120px',
                      overflowY: 'auto',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: result.status < 400 ? '#10b981' : '#ef4444', marginBottom: '0.25rem', fontWeight: 600 }}>
                      <span>Status {result.status}</span>
                      <span>{result.time}</span>
                    </div>
                    <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                      {result.text}
                    </pre>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleRunJob(job.id)}
                disabled={isRunning || runningJob !== null}
                className="admin-btn"
                style={{
                  background: isRunning ? 'var(--text-secondary)' : job.color,
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  width: '100%',
                  marginTop: '0.5rem',
                }}
              >
                <Play className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
                {isRunning ? 'Executing script...' : 'Run Action Now'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Backwards compatibility export
export const AdminCronsControl = AdminToolsControl;
