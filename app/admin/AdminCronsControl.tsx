'use client';

import { useState } from 'react';
import { toast } from '@/components/ui/Toast';
import { Play, Cpu, Sparkles, Activity, Search, Share2, Mail } from 'lucide-react';

type CronJobInfo = {
  id: string;
  name: string;
  schedule: string;
  description: string;
  icon: any;
  color: string;
};

const CRON_JOBS: CronJobInfo[] = [
  {
    id: 'health',
    name: 'Health & Metrics Check',
    schedule: 'Every 6 hours',
    description: 'Rechecks listing URLs, reciprocal badges, GitHub stars, npm download counts, and MCP tool introspection.',
    icon: Activity,
    color: '#10b981',
  },
  {
    id: 'ai-content',
    name: 'AI Content Enrichment',
    schedule: 'Daily at 00:00 UTC',
    description: 'Enriches raw scraped MCP listings with AI summaries, plain-language overviews, key features, and install commands.',
    icon: Sparkles,
    color: '#00E5FF',
  },
  {
    id: 'enrich',
    name: 'Tool Introspection Sync',
    schedule: 'Daily at 04:00 UTC',
    description: 'Attempts remote MCP tool list introspection for listings with active endpoints.',
    icon: Cpu,
    color: '#8b5cf6',
  },
  {
    id: 'highlight',
    name: 'Twitter Highlight Rotation',
    schedule: 'Daily at 14:00 UTC',
    description: 'Rotates least-recently-tweeted active MCP servers and posts highlight tweets to the social queue.',
    icon: Share2,
    color: '#007BFF',
  },
  {
    id: 'indexnow',
    name: 'IndexNow Search Pinger',
    schedule: 'Every 12 hours',
    description: 'Notifies Bing, Yandex, and IndexNow search engines of new and updated listing URLs.',
    icon: Search,
    color: '#f59e0b',
  },
  {
    id: 'newsletter-digest',
    name: 'Weekly Newsletter Digest',
    schedule: 'Mondays at 09:00 UTC',
    description: 'Generates and dispatches the weekly digest email containing new top MCP listings to subscribers.',
    icon: Mail,
    color: '#ec4899',
  },
];

export function AdminCronsControl() {
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [lastResults, setLastResults] = useState<Record<string, { status: number; text: string; time: string }>>({});

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
        throw new Error(data.error || data.result?.error || `Cron failed with status ${data.statusCode}`);
      }

      toast.success(`${jobId} cron completed successfully!`);
      setLastResults((prev) => ({
        ...prev,
        [jobId]: {
          status: data.statusCode,
          text: JSON.stringify(data.result, null, 2),
          time: new Date().toLocaleTimeString(),
        },
      }));
    } catch (err: any) {
      toast.error(`Cron trigger failed`, { description: err?.message });
      setLastResults((prev) => ({
        ...prev,
        [jobId]: {
          status: 500,
          text: err?.message || 'Error executing cron',
          time: new Date().toLocaleTimeString(),
        },
      }));
    } finally {
      setRunningJob(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="admin-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Cpu className="w-5 h-5 text-cyan-400" style={{ color: '#00E5FF' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>System Crons & Background Workers</h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
          Manually trigger background tasks or check execution outputs. Crons execute asynchronously on the edge context.
        </p>
      </div>

      <ul role="list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', listStyle: 'none', margin: 0, padding: 0 }}>
        {CRON_JOBS.map((job) => {
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
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>{job.name}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{job.schedule}</span>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '1rem' }}>
                  {job.description}
                </p>

                {result && (
                  <div
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.75rem',
                      marginBottom: '1rem',
                      maxHeight: '120px',
                      overflowY: 'auto',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: result.status < 400 ? '#10b981' : '#ef4444', marginBottom: '0.25rem' }}>
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  width: '100%',
                  marginTop: '0.5rem',
                }}
              >
                <Play className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
                {isRunning ? 'Executing job...' : 'Run Job Now'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
