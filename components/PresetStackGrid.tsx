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
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { toast } from '@/components/ui/Toast';
import { trackFeatureUse } from '@/lib/gtag';
import { saveStackServerIds } from '@/lib/stackStore';

interface PresetStack {
  id: string;
  name: string;
  badge: string;
  description: string;
  icon: React.ReactNode;
  servers: string[];
  displayTools: Array<{ name: string; tag: string }>;
}

const PRESET_STACKS: PresetStack[] = [
  {
    id: 'fullstack-dev',
    name: 'Fullstack Web Developer Stack',
    badge: 'Web Dev',
    description:
      'Git repository management, SQL database introspection, headless browser testing, and persistent agent memory.',
    icon: <Code2 size={18} />,
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
    icon: <Database size={18} />,
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
    icon: <Cloud size={18} />,
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
    icon: <Bot size={18} />,
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
    icon: <Briefcase size={18} />,
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
    icon: <Globe size={18} />,
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
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const handleLoadStack = (preset: PresetStack) => {
    setLoadedId(preset.id);
    trackFeatureUse('stack_builder', {
      action: 'load_preset',
      preset: preset.id,
    });

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

    // Scroll back up to the builder so the change is visible.
    const builderEl = document.getElementById('stack-builder');
    if (builderEl) {
      const reduce = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      builderEl.scrollIntoView({
        behavior: reduce ? 'auto' : 'smooth',
        block: 'start',
      });
    }

    setTimeout(() => {
      setLoadedId(null);
    }, 1600);
  };

  return (
    <section
      id="stack-presets"
      className="stk-presets"
      aria-labelledby="stk-presets-title"
    >
      <div className="stk-presets-head">
        <h2 id="stk-presets-title" className="stk-presets-title">
          Start from a preset
        </h2>
        <p className="stk-presets-sub">
          Curated four-server stacks for common jobs. Loading one replaces your
          current stack.
        </p>
      </div>

      <ul className="stk-presets-grid">
        {PRESET_STACKS.map((preset) => {
          const isLoaded = loadedId === preset.id;
          return (
            <li
              key={preset.id}
              className="stk-preset spotlight"
              data-preset-id={preset.id}
            >
              <div className="stk-preset-top">
                <span className="stk-preset-icon" aria-hidden="true">
                  {preset.icon}
                </span>
                <span className="stk-preset-badge">{preset.badge}</span>
              </div>
              <h3 className="stk-preset-title">{preset.name}</h3>
              <p className="stk-preset-desc">{preset.description}</p>
              <ul className="stk-preset-tools" aria-label="Included servers">
                {preset.displayTools.map((tool) => (
                  <li key={tool.name}>
                    {tool.name}
                    <span>{tool.tag}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => handleLoadStack(preset)}
                className={`btn btn-secondary btn-sm stk-preset-load tl-copy ${isLoaded ? 'is-copied' : ''}`}
              >
                {isLoaded ? (
                  <>
                    <CheckCircle2 size={15} aria-hidden="true" /> Loaded
                  </>
                ) : (
                  <>
                    Load {preset.servers.length} servers{' '}
                    <ArrowRight size={15} aria-hidden="true" />
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
