'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Search,
  Zap,
  Wrench,
  Terminal,
  Copy,
  Check,
  ArrowRight,
  Layers,
  Database,
  Globe,
  Code2,
  Brain,
  Cloud,
  FileText,
  Shield,
  PlusCircle,
  Cpu,
} from 'lucide-react';
import { toast } from './ui/Toast';

interface HeroSectionProps {
  totalCount?: number;
  onSelectSituation?: (query: string, category?: string) => void;
}

const GOALS = [
  {
    id: 'discover',
    icon: Search,
    title: 'Discover Tools',
    tagline: 'Find single MCP servers for specific agent capabilities',
    color: 'var(--accent-color)',
  },
  {
    id: 'stack',
    icon: Layers,
    title: 'Assemble a Stack',
    tagline: 'Combine complementary tools into a single turnkey configuration',
    color: 'var(--verified-green, #10b981)',
  },
  {
    id: 'tools',
    icon: Wrench,
    title: 'Inspect & Validate',
    tagline: 'Test JSON-RPC schemas, validate configs, and check token overhead',
    color: 'var(--chart-series-5, #9333ea)',
  },
  {
    id: 'publish',
    icon: PlusCircle,
    title: 'Publish Server',
    tagline: 'Submit your MCP server for automatic indexing and verification',
    color: 'var(--gold-color, #d97706)',
  },
] as const;

const SITUATIONS = [
  {
    label: 'Query SQL & Databases',
    icon: Database,
    query: 'postgres mysql sqlite database',
    category: '🗄️ Databases',
    slug: 'databases',
    href: '/browse?category=databases&q=postgres+mysql+sqlite+database',
  },
  {
    label: 'Web Scraping & Search',
    icon: Globe,
    query: 'browser scrape search brave playwright',
    category: '🔎 Search & Data Extraction',
    slug: 'search-and-data-extraction',
    href: '/browse?category=search-and-data-extraction&q=browser+scrape+search+playwright',
  },
  {
    label: 'Git & Code Management',
    icon: Code2,
    query: 'github git gitlab repository',
    category: '🔄 Version Control',
    slug: 'version-control',
    href: '/browse?category=version-control&q=github+git+gitlab+repository',
  },
  {
    label: 'Agent Memory & Context',
    icon: Brain,
    query: 'memory vector embeddings knowledge',
    category: '🧠 Knowledge & Memory',
    slug: 'knowledge-and-memory',
    href: '/browse?category=knowledge-and-memory&q=memory+vector+embeddings+knowledge',
  },
  {
    label: 'Cloud & Infrastructure',
    icon: Cloud,
    query: 'aws kubernetes docker cloudflare',
    category: '☁️ Cloud Platforms',
    slug: 'cloud-platforms',
    href: '/browse?category=cloud-platforms&q=aws+kubernetes+docker+cloudflare',
  },
  {
    label: 'Document & PDF Parsing',
    icon: FileText,
    query: 'pdf markdown document excel word',
    category: '💻 Developer Tools',
    slug: 'developer-tools',
    href: '/browse?category=developer-tools&q=pdf+markdown+document+excel+word',
  },
];

export function HeroSection({ totalCount }: HeroSectionProps) {
  const [activeGoal, setActiveGoal] = useState<'discover' | 'stack' | 'tools' | 'publish'>('discover');
  const [copied, setCopied] = useState(false);

  const goalCodeSnippets: Record<string, { title: string; code: string }> = {
    discover: {
      title: '1-Click Deep Install (Cursor / Windsurf)',
      code: `cursor://anysphere.cursor-deeplink/mcp/install?name=postgres&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBtb2RlbGNvbnRleHRwcm90b2NvbC9zZXJ2ZXItcG9zdGdyZXMiXX0=`,
    },
    stack: {
      title: 'claude_desktop_config.json (Combined Stack)',
      code: `{\n  "mcpServers": {\n    "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] },\n    "postgres": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-postgres"] },\n    "memory": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-memory"] }\n  }\n}`,
    },
    tools: {
      title: 'Live Tool Schema Call (~140 tokens overhead)',
      code: `// tools/list -> execute_sql\n{\n  "name": "execute_sql",\n  "description": "Execute raw SQL query against connected PostgreSQL database",\n  "inputSchema": { "type": "object", "properties": { "sql": { "type": "string" } }, "required": ["sql"] }\n}`,
    },
    publish: {
      title: 'Register Server via Catalog API',
      code: `curl -X POST https://allmcps.com/api/v1/submit \\\n  -H "Content-Type: application/json" \\\n  -d '{"url": "https://github.com/your-org/your-mcp-server", "category": "Developer Tools"}'`,
    },
  };

  const handleCopy = () => {
    const snippet = goalCodeSnippets[activeGoal].code;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast.success('Copied snippet to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="container landing-hero-modern animate-fade-in">
      {/* Viewport-Scale Value Proposition */}
      <h1 className="hero-headline">
        Find the exact MCP tools <br className="hidden sm:inline" />
        <span className="hero-headline-gradient">your AI agent needs.</span>
      </h1>

      <p className="hero-sublead">
        The definitive open registry for Model Context Protocol. Connect Claude, Cursor, Windsurf, and custom AI agents to databases, browser tools, APIs, and persistent memory in seconds.
      </p>

      {/* Goal-Oriented Command Center */}
      <div className="hero-goals-card surface">
        {/* Goal Tabs */}
        <div className="hero-goals-tabs" role="tablist" aria-label="Goal switcher">
          {GOALS.map((goal) => {
            const Icon = goal.icon;
            const isActive = activeGoal === goal.id;
            return (
              <button
                key={goal.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveGoal(goal.id as typeof activeGoal)}
                className={`hero-goal-tab ${isActive ? 'is-active' : ''}`}
                style={{ '--goal-color': goal.color } as React.CSSProperties}
              >
                <Icon size={16} className="hero-goal-icon" />
                <span className="hero-goal-tab-title">{goal.title}</span>
              </button>
            );
          })}
        </div>

        {/* Goal Description & Quick Action */}
        <div className="hero-goal-body">
          <div className="hero-goal-header-row">
            <div>
              <span className="hero-goal-badge" style={{ color: GOALS.find((g) => g.id === activeGoal)?.color }}>
                {GOALS.find((g) => g.id === activeGoal)?.title}
              </span>
              <p className="hero-goal-tagline">
                {GOALS.find((g) => g.id === activeGoal)?.tagline}
              </p>
            </div>

            <div className="hero-goal-action-btn-wrap">
              {activeGoal === 'discover' && (
                <Link href="/browse" className="btn btn-primary btn-sm">
                  <Search size={14} /> Search 10,000+ Tools
                </Link>
              )}
              {activeGoal === 'stack' && (
                <Link href="/stack" className="btn btn-primary btn-sm">
                  <Layers size={14} /> Open Stack Builder <ArrowRight size={14} />
                </Link>
              )}
              {activeGoal === 'tools' && (
                <Link href="/tools" className="btn btn-primary btn-sm">
                  <Wrench size={14} /> Explore Dev Tools <ArrowRight size={14} />
                </Link>
              )}
              {activeGoal === 'publish' && (
                <Link href="/submit" className="btn btn-primary btn-sm">
                  <PlusCircle size={14} /> Submit Server <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </div>

          {/* Interactive Code / Output Preview */}
          <div className="hero-terminal-container">
            <div className="hero-terminal-header">
              <div className="hero-terminal-dots">
                <span className="dot dot-red" />
                <span className="dot dot-yellow" />
                <span className="dot dot-green" />
              </div>
              <span className="hero-terminal-title">
                <Terminal size={12} style={{ color: 'var(--accent-color)' }} />
                {goalCodeSnippets[activeGoal].title}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="hero-terminal-copy-btn"
                title="Copy snippet"
                aria-label="Copy snippet"
              >
                {copied ? <Check size={13} style={{ color: 'var(--verified-green)' }} /> : <Copy size={13} />}
                <span className="hero-terminal-copy-label">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="hero-terminal-code">
              <code>{goalCodeSnippets[activeGoal].code}</code>
            </pre>
          </div>
        </div>
      </div>

      {/* Situational Quick-Discovery Matrix ("What are you looking to do?") */}
      <div className="hero-situations-section">
        <div className="hero-situations-title">
          <Sparkles size={14} style={{ color: 'var(--accent-color)' }} />
          <span>Or jump straight to tools by capability:</span>
        </div>
        <div className="hero-situations-grid">
          {SITUATIONS.map((sit) => {
            const Icon = sit.icon;
            return (
              <Link
                key={sit.label}
                href={sit.href}
                className="hero-situation-chip surface-interactive"
              >
                <Icon size={15} className="hero-situation-icon" style={{ color: 'var(--accent-color)' }} />
                <span>{sit.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Supported Client Badges */}
      <div className="hero-clients-strip">
        <span className="hero-clients-label">Seamless 1-click install for:</span>
        <div className="hero-clients-list">
          {[
            { href: '/mcp-for-claude-desktop', label: 'Claude Desktop' },
            { href: '/mcp-for-cursor', label: 'Cursor' },
            { href: '/mcp-for-windsurf', label: 'Windsurf' },
            { href: '/mcp-for-cline', label: 'Cline' },
            { href: '/clients', label: 'VS Code & Zed' },
          ].map((client) => (
            <Link key={client.href} href={client.href} className="hero-client-pill">
              {client.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
