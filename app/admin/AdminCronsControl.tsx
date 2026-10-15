'use client';

import {
  Activity,
  Cpu,
  Crown,
  ExternalLink,
  Loader2,
  Play,
  ScanSearch,
  Search,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/components/ui/Toast';
import { computeQualityScore, type QualityTier } from '@/lib/qualityScore';
import { AdminCardHead } from './AdminUi';

/** Quality-tier hue (theme-aware palette, unlike the raw tierColor hexes). */
const TIER_HUE: Record<QualityTier, string> = {
  Excellent: 'hue-green',
  Great: 'hue-cyan',
  Good: 'hue-amber',
  Fair: 'hue-indigo',
  Emerging: '',
};

type UtilityAction = {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: any;
  hue: string;
};

const UTILITY_ACTIONS: UtilityAction[] = [
  {
    id: 'health',
    name: 'Health & Reciprocal Badge Check',
    category: 'System Health',
    description:
      'Rechecks listing HTTP endpoints, reciprocal badges, GitHub stars, npm downloads, and active health states.',
    icon: Activity,
    hue: 'hue-green',
  },
  {
    id: 'ai-content',
    name: 'AI Catalog Enrichment Engine',
    category: 'AI & Metadata',
    description:
      'Generates AI summaries, plain-language overviews, key features, and install commands for scraped MCP listings.',
    icon: Sparkles,
    hue: 'hue-blue',
  },
  {
    id: 'enrich',
    name: 'Tool Introspection Sync',
    category: 'MCP Schemas',
    description:
      'Attempts remote MCP tool list introspection for active listings and stores callable JSON tool schemas.',
    icon: Cpu,
    hue: 'hue-violet',
  },
  {
    id: 'indexnow',
    name: 'IndexNow Search Pinger',
    category: 'SEO & Indexing',
    description:
      'Notifies Bing, Yandex, and IndexNow search engines of new and updated listing URLs for rapid indexing.',
    icon: Search,
    hue: 'hue-orange',
  },
  {
    id: 'stale-sweep',
    name: 'Stale Sweep & Jev Triage',
    category: 'Catalog Quality',
    description:
      'Checks npm/PyPI for deprecated or missing packages, flags stale listings (noindex, removed after 30 days), and asks Jev for triage verdicts.',
    icon: Trash2,
    hue: 'hue-teal',
  },
];

export function AdminToolsControl() {
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [lastResults, setLastResults] = useState<
    Record<string, { status: number; text: string; time: string }>
  >({});

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
        throw new Error(
          data.error ||
            data.result?.error ||
            `Action failed with status ${data.statusCode}`,
        );
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
      const res = await fetch(
        `/api/admin/listings?search=${encodeURIComponent(term)}&limit=1`,
      );
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
    action: 'feature' | 'set_premium' | 'unset_premium',
  ) => {
    if (!inspectedServer) return;
    const id = inspectedServer.id;
    setRunningJob(`quick_${action}`);

    try {
      {
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
    <div className="adm-stack">
      {/* Listing inspector & instant action bar */}
      <div className="adm-card">
        <AdminCardHead
          icon={Zap}
          hue="hue-orange"
          title="Listing inspector & instant actions"
        />
        <p className="adm-card-sub">
          Look up any listing by ID or name to inspect its quality score, health
          and engagement, and run 1-click admin actions.
        </p>

        <form
          className="adm-inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleInspectLookup();
          }}
        >
          <div className="adm-search">
            <Search size={16} aria-hidden="true" />
            <input
              className="form-input"
              aria-label="Server ID or name"
              placeholder="Server ID or name (e.g. allmcps-server)…"
              value={inspectorId}
              onChange={(e) => setInspectorId(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={inspecting || !inspectorId.trim()}
            className="btn btn-sm btn-primary"
          >
            <ScanSearch size={14} aria-hidden="true" />
            {inspecting ? 'Inspecting…' : 'Inspect'}
          </button>
        </form>

        {inspectedServer && (
          <div className="adm-inspect">
            {/* Summary header */}
            <div className="adm-inspect-head">
              <div>
                <h4 className="adm-inspect-name">{inspectedServer.name}</h4>
                <span className="adm-inspect-id">
                  ID: {inspectedServer.id} · Category:{' '}
                  {inspectedServer.category}
                </span>
              </div>
              {(() => {
                const qs = computeQualityScore(inspectedServer);
                return (
                  <div className="adm-score">
                    <b>{qs.score}/100</b>
                    <span className={`adm-tag ${TIER_HUE[qs.tier]}`}>
                      {qs.tier}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Vitals */}
            <div className="adm-tags">
              <span className="adm-tag">
                Health: <b>{inspectedServer.healthStatus || 'unknown'}</b>
              </span>
              <span className="adm-tag">
                Views: <b>{(inspectedServer.views || 0).toLocaleString()}</b>
              </span>
              <span className="adm-tag">
                Upvotes:{' '}
                <b>{(inspectedServer.upvotes || 0).toLocaleString()}</b>
              </span>
              {inspectedServer.isPremium && (
                <span className="adm-tag hue-violet">
                  <Crown size={11} aria-hidden="true" /> Premium dofollow
                </span>
              )}
            </div>

            {/* Quick actions */}
            <div className="adm-actions adm-inspect-actions">
              <button
                type="button"
                onClick={() => handleQuickServerAction('feature')}
                disabled={runningJob !== null}
                className="btn btn-sm adm-btn-tint hue-orange"
              >
                <Zap size={14} aria-hidden="true" /> Grant 14d boost
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickServerAction(
                    inspectedServer.isPremium ? 'unset_premium' : 'set_premium',
                  )
                }
                disabled={runningJob !== null}
                className="btn btn-sm adm-btn-tint hue-violet"
              >
                <Crown size={14} aria-hidden="true" />{' '}
                {inspectedServer.isPremium ? 'Unset premium' : 'Mark premium'}
              </button>
              <a
                href={`/mcp/${inspectedServer.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-secondary"
              >
                <ExternalLink size={14} aria-hidden="true" /> View listing
              </a>
            </div>
          </div>
        )}
      </div>

      {/* One-click maintenance jobs */}
      <ul className="adm-jobs">
        {UTILITY_ACTIONS.map((job) => {
          const Icon = job.icon;
          const isRunning = runningJob === job.id;
          const result = lastResults[job.id];

          return (
            <li key={job.id} className="adm-card adm-job">
              <div className="adm-job-head">
                <span className={`tint-tile ${job.hue}`} aria-hidden="true">
                  <Icon size={16} />
                </span>
                <div>
                  <h4 className="adm-job-name">{job.name}</h4>
                  <span className="adm-job-cat">{job.category}</span>
                </div>
              </div>

              <p className="adm-job-desc">{job.description}</p>

              {result && (
                <div
                  className={`adm-job-result ${result.status < 400 ? 'hue-green' : 'hue-red'}`}
                >
                  <div className="adm-job-result-head">
                    <span>Status {result.status}</span>
                    <span>{result.time}</span>
                  </div>
                  <pre className="adm-pre">{result.text}</pre>
                </div>
              )}

              <button
                type="button"
                onClick={() => handleRunJob(job.id)}
                disabled={isRunning || runningJob !== null}
                className="btn btn-sm btn-secondary adm-job-run"
              >
                {isRunning ? (
                  <Loader2 size={14} aria-hidden="true" className="acct-spin" />
                ) : (
                  <Play size={14} aria-hidden="true" />
                )}
                {isRunning ? 'Running…' : 'Run now'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
