'use client';

import React, { useState } from 'react';
import {
  Layers,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Code2,
  Database,
  Cloud,
  Bot,
  Briefcase,
  Globe,
  Copy,
  Terminal,
  Cpu,
  Workflow,
  Search,
} from 'lucide-react';
import { saveStackServerIds } from '@/lib/stackStore';
import { toast } from '@/components/ui/Toast';

export interface PresetStack {
  id: string;
  name: string;
  badge: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string; // Brand accent hex (e.g. #00e5ff)
  gradientBg: string; // CSS background
  borderGlow: string; // CSS box shadow or border style
  textColor: string; // Theme readable title color
  servers: string[];
  displayTools: Array<{ name: string; tag: string }>;
}

export const PRESET_STACKS: PresetStack[] = [
  {
    id: 'fullstack-dev',
    name: 'Fullstack Web Developer Stack',
    badge: 'Most Popular',
    description: 'Git repository management, SQL database introspection, headless browser testing, and persistent agent memory.',
    icon: <Code2 size={22} />,
    accentColor: '#00e5ff',
    gradientBg: 'linear-gradient(135deg, rgba(0, 229, 255, 0.12) 0%, rgba(0, 123, 255, 0.08) 100%)',
    borderGlow: 'rgba(0, 229, 255, 0.3)',
    textColor: '#00e5ff',
    servers: ['github-github-mcp-server', 'crystaldba-postgres-mcp', 'automatalabs-mcp-server-playwright', 'basicmachines-co-basic-memory'],
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
    description: 'Query SQLite & BigQuery databases, execute Python data analysis scripts, and parse spreadsheet workbooks.',
    icon: <Database size={22} />,
    accentColor: '#a855f7',
    gradientBg: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(124, 58, 237, 0.08) 100%)',
    borderGlow: 'rgba(168, 85, 247, 0.3)',
    textColor: '#c084fc',
    servers: ['jparkerweb-mcp-sqlite', 'ergut-mcp-bigquery-server', 'haris-musa-excel-mcp-server', 'kestra-io-mcp-server-python'],
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
    description: 'Control Kubernetes clusters, manage AWS S3 storage buckets, orchestrate Docker containers, and Cloudflare workers.',
    icon: <Cloud size={22} />,
    accentColor: '#34d399',
    gradientBg: 'linear-gradient(135deg, rgba(52, 211, 153, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)',
    borderGlow: 'rgba(52, 211, 153, 0.3)',
    textColor: '#34d399',
    servers: ['flux159-mcp-server-kubernetes', 'alexei-led-aws-mcp-server', 'docker-hub-mcp', 'cloudflare-mcp-server-cloudflare'],
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
    description: 'Equip your AI agent with long-term graph memory, real-time Brave web search, file system tools, and deep context.',
    icon: <Bot size={22} />,
    accentColor: '#f59e0b',
    gradientBg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.08) 100%)',
    borderGlow: 'rgba(245, 158, 11, 0.3)',
    textColor: '#fbbf24',
    servers: ['basicmachines-co-basic-memory', 'brave-brave-search-mcp-server', 'modelcontextprotocol-server-everything', 'aitytech-agentkits-memory'],
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
    description: 'Streamline team messaging via Slack, search Notion workspaces, monitor Sentry error tracking, and fetch Figma designs.',
    icon: <Briefcase size={22} />,
    accentColor: '#f43f5e',
    gradientBg: 'linear-gradient(135deg, rgba(244, 63, 94, 0.12) 0%, rgba(225, 29, 72, 0.08) 100%)',
    borderGlow: 'rgba(244, 63, 94, 0.3)',
    textColor: '#fb7185',
    servers: ['jtalk22-slack-mcp-server', 'badhansen-notion-mcp', 'getsentry-sentry-mcp', 'glips-figma-context-mcp'],
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
    description: 'Automate browser navigation, query live web indexes, fetch structured page content, and summarize articles automatically.',
    icon: <Globe size={22} />,
    accentColor: '#0ea5e9',
    gradientBg: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
    borderGlow: 'rgba(14, 165, 233, 0.3)',
    textColor: '#38bdf8',
    servers: ['automatalabs-mcp-server-playwright', 'brave-brave-search-mcp-server', 'ashlrai-webfetch', '0xshellming-mcp-summarizer'],
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
          Click &ldquo;Load Stack&rdquo; to instantly load pre-configured multi-tool suites into your builder.
        </p>
      </div>

      <div className="preset-stacks-grid">
        {PRESET_STACKS.map((preset) => {
          const isLoading = loadingId === preset.id;

          return (
            <div
              key={preset.id}
              className="preset-card"
              style={{
                '--preset-accent': preset.accentColor,
                '--preset-bg': preset.gradientBg,
                '--preset-border': preset.borderGlow,
                '--preset-text': preset.textColor,
              } as React.CSSProperties}
            >
              {/* Header Badge & Icon */}
              <div className="preset-card-top">
                <div className="preset-card-icon-wrap" style={{ color: preset.accentColor }}>
                  {preset.icon}
                </div>
                <span className="preset-card-badge" style={{ borderColor: preset.borderGlow, color: preset.textColor }}>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
