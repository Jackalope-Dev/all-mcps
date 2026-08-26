'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Layers,
  Wrench,
  PlusCircle,
  ArrowRight,
  Copy,
  Check,
  Terminal,
} from 'lucide-react';
import { toast } from './ui/Toast';
import { AmbientCodeBackground } from './ui/AmbientCodeBackground';
import { ScrambleCode } from './ui/ScrambleCode';

interface HeroSectionProps {
  totalCount?: number;
}

const STACK_PRESETS: Record<string, { label: string; config: string; tools: string[] }> = {
  fullstack: {
    label: 'Fullstack Dev',
    tools: ['GitHub', 'PostgreSQL', 'Playwright', 'Memory'],
    config: `{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@automatalabs/mcp-server-playwright"]
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}`,
  },
  data: {
    label: 'Data Science',
    tools: ['SQLite', 'BigQuery', 'Python Exec'],
    config: `{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite", "--db-path", "/data/analytics.db"]
    },
    "bigquery": {
      "command": "npx",
      "args": ["-y", "mcp-bigquery-server"]
    },
    "python-exec": {
      "command": "uvx",
      "args": ["mcp-server-python"]
    }
  }
}`,
  },
  devops: {
    label: 'DevOps / Cloud',
    tools: ['Kubernetes', 'AWS S3', 'Docker Hub'],
    config: `{
  "mcpServers": {
    "kubernetes": {
      "command": "npx",
      "args": ["-y", "mcp-server-kubernetes"]
    },
    "aws-s3": {
      "command": "npx",
      "args": ["-y", "aws-mcp-server"]
    },
    "docker": {
      "command": "npx",
      "args": ["-y", "docker-hub-mcp"]
    }
  }
}`,
  },
  agent: {
    label: 'AI Agent Power',
    tools: ['Brave Search', 'Filesystem', 'Memory'],
    config: `{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}`,
  },
};

const INSPECT_SAMPLES: Record<string, { label: string; path: string; schema: string }> = {
  allmcps: {
    label: 'AllMCPs Server',
    path: '/mcp/allmcps-server.md',
    schema: `// GET https://allmcps.com/api/mcp -> tools/list
{
  "tools": [
    {
      "name": "search_mcp_servers",
      "description": "Search directory for MCP servers by keyword or capability",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": { "type": "string", "description": "Search query" },
          "limit": { "type": "number", "default": 10 }
        },
        "required": ["query"]
      }
    },
    {
      "name": "get_mcp_install_config",
      "description": "Get ready-to-paste client JSON config",
      "inputSchema": {
        "type": "object",
        "properties": {
          "server_name": { "type": "string" },
          "client": { "type": "string", "enum": ["claude", "cursor", "windsurf", "cline"] }
        },
        "required": ["server_name"]
      }
    }
  ]
}`,
  },
  postgres: {
    label: 'PostgreSQL MCP',
    path: '/mcp/crystaldba-postgres-mcp.md',
    schema: `// Tool introspection: @modelcontextprotocol/server-postgres
{
  "tools": [
    {
      "name": "query_database",
      "description": "Execute read-only SQL queries against connected Postgres instance",
      "inputSchema": {
        "type": "object",
        "properties": {
          "sql": { "type": "string", "description": "SQL statement" }
        },
        "required": ["sql"]
      }
    },
    {
      "name": "list_tables",
      "description": "Retrieve schema metadata and table structures"
    }
  ]
}`,
  },
  github: {
    label: 'GitHub MCP',
    path: '/mcp/github-github-mcp-server.md',
    schema: `// Tool introspection: @modelcontextprotocol/server-github
{
  "tools": [
    { "name": "search_repositories", "description": "Find repositories on GitHub" },
    { "name": "get_pull_request", "description": "Inspect PR diff, comments, and CI status" },
    { "name": "create_or_update_file", "description": "Write code changes via git commit" }
  ]
}`,
  },
};

const PUBLISH_MODES = {
  agent: {
    label: 'Agent Prompt',
    cmd: `Submit this workspace as an MCP server to AllMCPs.

POST https://allmcps.com/api/v1/submit
Content-Type: application/json

{
  "name": "<server name from this repo>",
  "url": "<GitHub or website URL>",
  "email": "<maintainer email>",
  "description": "<what the tools do>",
  "category": "Developer Tools"
}

Report the response and claim verification link.`,
  },
  curl: {
    label: 'cURL API Request',
    cmd: `curl -s -X POST https://allmcps.com/api/v1/submit \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My MCP Server",
    "url": "https://github.com/you/your-mcp",
    "email": "you@example.com",
    "description": "PostgreSQL tools for autonomous agents",
    "category": "Databases"
  }'`,
  },
};

const QUICK_SEARCH_CHIPS = ['postgres', 'github', 'playwright', 'sqlite', 'brave', 'docker'];

const GOALS = [
  {
    id: 'discover',
    icon: Search,
    title: 'Discover',
    colorVar: 'var(--tab-discover, #00e5ff)',
    kicker: '[ 01 / 04 ] · Dynamic Query',
    tagline: 'Search MCP servers by capability, database, or tool.',
    ctaHref: '/browse',
    ctaLabel: 'Browse All Servers',
    outputLabel: 'GET /api/v1/search',
  },
  {
    id: 'stack',
    icon: Layers,
    title: 'Stack',
    colorVar: 'var(--tab-stack, #c084fc)',
    kicker: '[ 02 / 04 ] · Config Bundler',
    tagline: 'Combine multiple tools into one ready-to-paste client configuration.',
    ctaHref: '/stack',
    ctaLabel: 'Open Stack Builder',
    outputLabel: 'claude_desktop_config.json',
  },
  {
    id: 'inspect',
    icon: Wrench,
    title: 'Inspect',
    colorVar: 'var(--tab-inspect, #fbbf24)',
    kicker: '[ 03 / 04 ] · Tool Introspection',
    tagline: 'Inspect executable tool schemas, verify parameters, and test endpoints.',
    ctaHref: '/tools/protocol-inspector',
    ctaLabel: 'Launch Inspector',
    outputLabel: 'JSON-RPC Tool Schema',
  },
  {
    id: 'publish',
    icon: PlusCircle,
    title: 'Publish',
    colorVar: 'var(--tab-publish, #34d399)',
    kicker: '[ 04 / 04 ] · Open Registry',
    tagline: 'Submit your MCP server to reach thousands of AI developers & agents.',
    ctaHref: '/submit',
    ctaLabel: 'Submit MCP Server',
    outputLabel: 'POST /api/v1/submit',
  },
] as const;

const CLIENTS = [
  { href: '/mcp-for-claude-desktop', label: 'Claude Desktop' },
  { href: '/mcp-for-cursor', label: 'Cursor' },
  { href: '/mcp-for-windsurf', label: 'Windsurf' },
  { href: '/mcp-for-cline', label: 'Cline' },
  { href: '/clients', label: 'VS Code & Zed' },
] as const;

type GoalId = (typeof GOALS)[number]['id'];

function searchCurl(q: string) {
  const query = encodeURIComponent(q.trim() || 'postgres');
  return `curl -s "https://allmcps.com/api/v1/search?q=${query}&limit=5"`;
}

export function HeroSection({ totalCount }: HeroSectionProps) {
  const router = useRouter();
  const [activeGoal, setActiveGoal] = useState<GoalId>('discover');
  const [copied, setCopied] = useState<boolean>(false);
  const [query, setQuery] = useState('postgres');
  const [selectedStackPreset, setSelectedStackPreset] = useState<string>('fullstack');
  const [selectedInspectSample, setSelectedInspectSample] = useState<string>('allmcps');
  const [selectedPublishMode, setSelectedPublishMode] = useState<'agent' | 'curl'>('agent');

  const catalogLabel =
    typeof totalCount === 'number' && totalCount > 0
      ? totalCount.toLocaleString('en-US')
      : 'thousands of';

  const goals = useMemo(
    () =>
      GOALS.map((goal) =>
        goal.id === 'discover'
          ? {
              ...goal,
              tagline: `Search ${catalogLabel} MCP servers by capability, database, or tool.`,
            }
          : goal
      ),
    [catalogLabel]
  );

  const current = goals.find((g) => g.id === activeGoal) ?? goals[0];

  const output = useMemo(() => {
    if (activeGoal === 'discover') return searchCurl(query);
    if (activeGoal === 'stack') return STACK_PRESETS[selectedStackPreset]?.config || STACK_PRESETS.fullstack.config;
    if (activeGoal === 'inspect') return INSPECT_SAMPLES[selectedInspectSample]?.schema || INSPECT_SAMPLES.allmcps.schema;
    return PUBLISH_MODES[selectedPublishMode].cmd;
  }, [activeGoal, query, selectedStackPreset, selectedInspectSample, selectedPublishMode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const runDiscover = (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/browse?q=${encodeURIComponent(q)}` : '/browse');
  };

  return (
    <section className="landing-hero-section">
      <AmbientCodeBackground />

      <div className="container landing-hero-modern">
        <p className="hero-kicker enter-up" style={{ '--stagger': '0ms' } as React.CSSProperties}>
          <span className="hero-kicker-tag">[ 200 OK ]</span>
          MCP server directory
        </p>

        <h1 className="hero-headline enter-up" style={{ '--stagger': '80ms' } as React.CSSProperties}>
          Find the MCP server
          <br className="hidden sm:inline" />{' '}
          <span className="hero-headline-gradient">your agent needs.</span>
        </h1>

        <p className="hero-sublead enter-up" style={{ '--stagger': '160ms' } as React.CSSProperties}>
          Search {catalogLabel} MCP servers. Install in Claude, Cursor, Windsurf, or Cline.{' '}
          <Link href="/what-is-mcp" style={{ color: 'var(--brand-cyan)', textDecoration: 'none' }}>What is MCP?</Link>
        </p>

        <div className="hero-cta-row enter-up" style={{ '--stagger': '240ms' } as React.CSSProperties}>
          <Link href="/browse" className="btn btn-primary hero-cta-btn">
            Browse MCP servers <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/stack" className="btn btn-secondary hero-cta-btn">
            Build a Stack
          </Link>
        </div>

        {/* Interactive Hero Playground Card */}
        <div
          className="hero-playground surface grid-crosshair grid-crosshair-tl grid-crosshair-br enter-up"
          style={{
            '--stagger': '320ms',
            '--tab-accent': current.colorVar,
            borderColor: 'var(--border-color)',
          } as React.CSSProperties}
        >
          {/* Tab Navigation with Dedicated Color Pops */}
          <div className="hero-playground-tabs" role="tablist" aria-label="What do you want to do?">
            {goals.map((goal) => {
              const Icon = goal.icon;
              const isActive = activeGoal === goal.id;
              return (
                <button
                  key={goal.id}
                  type="button"
                  role="tab"
                  data-goal={goal.id}
                  aria-selected={isActive}
                  onClick={() => setActiveGoal(goal.id)}
                  className={`hero-playground-tab ${isActive ? 'is-active' : ''}`}
                  style={
                    isActive
                      ? {
                          color: goal.colorVar,
                          borderBottomColor: goal.colorVar,
                        }
                      : {}
                  }
                >
                  <Icon
                    size={15}
                    style={{ color: isActive ? goal.colorVar : 'inherit', transition: 'color 0.2s ease' }}
                    aria-hidden="true"
                  />
                  <span>{goal.title}</span>
                </button>
              );
            })}
          </div>

          <div className="hero-playground-body">
            {/* Interactive Left Column */}
            <div className="hero-playground-intro">
              <span
                className="hero-playground-eyebrow"
                style={{ color: current.colorVar }}
              >
                {current.kicker}
              </span>

              <p className="hero-playground-tagline">{current.tagline}</p>

              {/* Tab 1: Discover View */}
              {activeGoal === 'discover' && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <form className="hero-playground-search" onSubmit={runDiscover} role="search">
                    <Search size={15} style={{ color: current.colorVar, flexShrink: 0 }} aria-hidden="true" />
                    <input
                      type="search"
                      name="q"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search postgres, github, browser…"
                      aria-label="Search MCP servers"
                      autoComplete="off"
                    />
                    <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '0.35rem 0.75rem' }}>
                      Search
                    </button>
                  </form>

                  <div className="hero-playground-search-tags">
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Quick tags:</span>
                    {QUICK_SEARCH_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setQuery(chip)}
                        className="hero-playground-search-tag"
                        style={query === chip ? { borderColor: current.colorVar, color: current.colorVar } : {}}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>

                  <Link href="/browse" className="hero-playground-cta-link" style={{ color: current.colorVar, marginTop: '0.25rem' }}>
                    <span>Browse complete catalog</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              )}

              {/* Tab 2: Stack View */}
              {activeGoal === 'stack' && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {Object.entries(STACK_PRESETS).map(([key, item]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedStackPreset(key)}
                        className={`hero-playground-preset-btn ${selectedStackPreset === key ? 'is-active' : ''}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', margin: '0.2rem 0' }}>
                    {STACK_PRESETS[selectedStackPreset]?.tools.map((t) => (
                      <span key={t} className="hero-tool-pill">
                        ✓ {t}
                      </span>
                    ))}
                  </div>

                  <Link href="/stack" className="hero-playground-cta-link" style={{ color: current.colorVar }}>
                    <span>Open multi-tool Stack Builder</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              )}

              {/* Tab 3: Inspect View */}
              {activeGoal === 'inspect' && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {Object.entries(INSPECT_SAMPLES).map(([key, item]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedInspectSample(key)}
                        className={`hero-playground-preset-btn ${selectedInspectSample === key ? 'is-active' : ''}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <Link href="/tools/protocol-inspector" className="hero-playground-cta-link" style={{ color: current.colorVar, marginTop: '0.5rem' }}>
                    <span>Launch Protocol Inspector & Debugger</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              )}

              {/* Tab 4: Publish View */}
              {activeGoal === 'publish' && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {(['agent', 'curl'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSelectedPublishMode(mode)}
                        className={`hero-playground-preset-btn ${selectedPublishMode === mode ? 'is-active' : ''}`}
                      >
                        {PUBLISH_MODES[mode].label}
                      </button>
                    ))}
                  </div>

                  <Link href="/submit" className="hero-playground-cta-link" style={{ color: current.colorVar, marginTop: '0.5rem' }}>
                    <span>Submit MCP server via Web Form</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              )}
            </div>

            {/* Terminal Output Right Column */}
            <div className="hero-playground-output">
              <div className="hero-playground-output-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }} />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }} />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#27c93f', display: 'inline-block' }} />
                  <span className="hero-playground-output-label" style={{ marginLeft: '0.4rem' }}>
                    <Terminal size={12} style={{ color: current.colorVar }} aria-hidden="true" />
                    <span>[ {current.outputLabel} ]</span>
                  </span>
                </div>

                <div className="hero-playground-copy-row">
                  <button
                    type="button"
                    className="hero-playground-copy"
                    onClick={handleCopy}
                    style={copied ? { borderColor: '#10b981', color: '#10b981' } : {}}
                  >
                    {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <pre className="hero-playground-code">
                <code>
                  <ScrambleCode text={output} replayKey={`${activeGoal}:${selectedStackPreset}:${selectedInspectSample}:${selectedPublishMode}:${output}`} />
                </code>
              </pre>
            </div>
          </div>
        </div>

        {/* Client badges */}
        <div className="hero-clients-strip">
          <span className="hero-clients-label">Works out of the box with</span>
          <div className="hero-clients-list">
            {CLIENTS.map((client) => (
              <Link key={client.href} href={client.href} className="hero-client-pill">
                {client.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
