'use client';

import {
  ArrowRight,
  Bot,
  Briefcase,
  CheckCircle2,
  Cloud,
  Code2,
  Database,
  Globe,
  Sparkles,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { toast } from '@/components/ui/Toast';
import { saveStackServerIds } from '@/lib/stackStore';

export interface PresetStack {
  id: string;
  name: string;
  badge: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string; // Brand accent hex (e.g. #00e5ff) — drives Card's accent border/icon/badge color
  servers: string[];
  displayTools: Array<{ name: string; tag: string }>;
}

export const PRESET_STACKS: PresetStack[] = [
  {
    id: 'fullstack-dev',
    name: 'Fullstack Web Developer Stack',
    badge: 'Most Popular',
    description:
      'Git repository management, SQL database introspection, headless browser testing, and persistent agent memory.',
    icon: <Code2 size={22} />,
    // Uses the theme accent token (not a fixed hex like the other presets)
    // because raw #00e5ff cyan text/border reads fine on dark but fails
    // contrast on a white light-theme surface — var(--accent-color) already
    // resolves to a darker, readable blue in light theme everywhere else.
    accentColor: 'var(--accent-color)',
    servers: [
      'github-github-mcp-server',
      'crystaldba-postgres-mcp',
      'automatalabs-mcp-server-playwright',
      'basicmachines-co-basic-memory',
    ],
    displayTools: [
      { name: 'GitHub', tag: 'DevOps' },
      { name: 'PostgreSQL', tag: 'Database' },
      { name: 'Playwright', tag: 'Testing' },
      { name: 'Memory', tag: 'State' },
    ],
  },
  {
    id: 'data-science',
    name: 'Data Science & Analytics Stack',
    badge: 'Data & AI',
    description:
      'Query SQLite & BigQuery databases, execute Python data analysis scripts, and parse spreadsheet workbooks.',
    icon: <Database size={22} />,
    accentColor: '#a855f7',
    servers: [
      'jparkerweb-mcp-sqlite',
      'ergut-mcp-bigquery-server',
      'haris-musa-excel-mcp-server',
      'kestra-io-mcp-server-python',
    ],
    displayTools: [
      { name: 'SQLite', tag: 'Database' },
      { name: 'BigQuery', tag: 'Analytics' },
      { name: 'Excel', tag: 'Spreadsheet' },
      { name: 'Python Exec', tag: 'Code' },
    ],
  },
  {
    id: 'devops-cloud',
    name: 'DevOps & Cloud Infrastructure Stack',
    badge: 'Infrastructure',
    description:
      'Control Kubernetes clusters, manage AWS S3 storage buckets, orchestrate Docker containers, and Cloudflare workers.',
    icon: <Cloud size={22} />,
    accentColor: '#34d399',
    servers: [
      'flux159-mcp-server-kubernetes',
      'alexei-led-aws-mcp-server',
      'docker-hub-mcp',
      'cloudflare-mcp-server-cloudflare',
    ],
    displayTools: [
      { name: 'Kubernetes', tag: 'K8s' },
      { name: 'AWS S3', tag: 'Cloud' },
      { name: 'Docker Hub', tag: 'Containers' },
      { name: 'Cloudflare', tag: 'Edge' },
    ],
  },
  {
    id: 'ai-power-agent',
    name: 'Autonomous AI Agent Stack',
    badge: 'Superpower',
    description:
      'Equip your AI agent with long-term graph memory, real-time Brave web search, file system tools, and deep context.',
    icon: <Bot size={22} />,
    accentColor: '#f59e0b',
    servers: [
      'basicmachines-co-basic-memory',
      'brave-brave-search-mcp-server',
      'modelcontextprotocol-server-everything',
      'aitytech-agentkits-memory',
    ],
    displayTools: [
      { name: 'Basic Memory', tag: 'Memory' },
      { name: 'Brave Search', tag: 'Search' },
      { name: 'Server Everything', tag: 'System' },
      { name: 'Agent Memory', tag: 'Context' },
    ],
  },
  {
    id: 'team-productivity',
    name: 'Productivity & Team Ops Stack',
    badge: 'Collaboration',
    description:
      'Streamline team messaging via Slack, search Notion workspaces, monitor Sentry error tracking, and fetch Figma designs.',
    icon: <Briefcase size={22} />,
    accentColor: '#f43f5e',
    servers: [
      'jtalk22-slack-mcp-server',
      'badhansen-notion-mcp',
      'getsentry-sentry-mcp',
      'glips-figma-context-mcp',
    ],
    displayTools: [
      { name: 'Slack', tag: 'Chat' },
      { name: 'Notion', tag: 'Docs' },
      { name: 'Sentry', tag: 'Errors' },
      { name: 'Figma', tag: 'Design' },
    ],
  },
  {
    id: 'web-scraping-research',
    name: 'Web Scraping & Content Research Stack',
    badge: 'Web & Search',
    description:
      'Automate browser navigation, query live web indexes, fetch structured page content, and summarize articles automatically.',
    icon: <Globe size={22} />,
    accentColor: '#0ea5e9',
    servers: [
      'automatalabs-mcp-server-playwright',
      'brave-brave-search-mcp-server',
      'ashlrai-webfetch',
      '0xshellming-mcp-summarizer',
    ],
    displayTools: [
      { name: 'Playwright', tag: 'Scraper' },
      { name: 'Brave Search', tag: 'Web' },
      { name: 'Web Fetch', tag: 'Extract' },
      { name: 'Summarizer', tag: 'AI' },
    ],
  },
];

export function PresetStackGrid() {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleLoadStack = (preset: PresetStack) => {
    setLoadingId(preset.id);

    // Save stack IDs to store & update state
    saveStackServerIds(preset.servers);

    // Update URL parameter without page reload
    if (typeof window !== 'undefined') {
      const shareUrl = `/stack?servers=${encodeURIComponent(preset.servers.join(','))}`;
      window.history.pushState(null, '', shareUrl);
    }

    toast.success(`Loaded "${preset.name}" into your stack!`, {
      description: `${preset.servers.length} MCP server tools ready to configure and export.`,
    });

    // Smooth scroll up to stack builder section
    const builderEl = document.getElementById('stack-builder');
    if (builderEl) {
      builderEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setTimeout(() => {
      setLoadingId(null);
    }, 600);
  };

  return (
    <div className="preset-stacks-wrapper">
      <div className="preset-stacks-header">
        <div className="preset-stacks-pill">
          <Sparkles size={14} /> Curated Configurations
        </div>
        <h2 className="preset-stacks-title">Featured Preset Stacks</h2>
        <p className="preset-stacks-subtitle">
          Click &ldquo;Load Stack&rdquo; to instantly load pre-configured
          multi-tool suites into your builder.
        </p>
      </div>

      <div className="preset-stacks-grid">
        {PRESET_STACKS.map((preset) => {
          const isLoading = loadingId === preset.id;

          return (
            <Card
              key={preset.id}
              accent={preset.accentColor}
              padding="md"
              className="preset-card"
              data-preset-id={preset.id}
            >
              {/* Header Badge & Icon */}
              <div className="preset-card-top">
                <div
                  className="preset-card-icon-wrap"
                  style={{ color: 'var(--card-accent)' }}
                >
                  {preset.icon}
                </div>
                <span
                  className="preset-card-badge"
                  style={{
                    borderColor: 'var(--card-accent)',
                    color: 'var(--card-accent)',
                  }}
                >
                  {preset.badge}
                </span>
              </div>

              {/* Title & Description */}
              <h3 className="preset-card-title">{preset.name}</h3>
              <p className="preset-card-desc">{preset.description}</p>

              {/* Tool Chips */}
              <div className="preset-card-chips">
                {preset.displayTools.map((tool, idx) => (
                  <span key={idx} className="preset-tool-pill">
                    <span className="preset-tool-name">{tool.name}</span>
                    <span className="preset-tool-tag">{tool.tag}</span>
                  </span>
                ))}
              </div>

              {/* Card Footer Actions */}
              <div className="preset-card-footer">
                <button
                  type="button"
                  onClick={() => handleLoadStack(preset)}
                  disabled={isLoading}
                  className="preset-card-load-btn"
                >
                  {isLoading ? (
                    <>
                      <CheckCircle2 size={15} className="spin-icon" /> Loaded!
                    </>
                  ) : (
                    <>
                      Load Stack <ArrowRight size={15} />
                    </>
                  )}
                </button>

                <span className="preset-card-count">
                  {preset.servers.length} Tools
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
