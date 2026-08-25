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

const AI_SUBMISSION_PROMPT = `Please submit my Model Context Protocol server to the AllMCPs directory (https://allmcps.com):

1. Inspect this workspace/repository to extract the server name, repo URL, tool descriptions, and primary category.
2. Send a POST request to https://allmcps.com/api/v1/submit with JSON:
{
  "name": "<Server Name>",
  "url": "<GitHub Repository or Website URL>",
  "email": "<Your Contact Email>",
  "description": "<Description of tools and capabilities>",
  "category": "Developer Tools"
}
3. Report back with the confirmation response and claim link.`;

const PUBLISH_CURL_SNIPPET = `curl -X POST https://allmcps.com/api/v1/submit \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My MCP Server",
    "url": "https://github.com/your-org/your-mcp-server",
    "email": "dev@example.com",
    "category": "Developer Tools"
  }'`;

export function HeroSection({ totalCount }: HeroSectionProps) {
  const [activeGoal, setActiveGoal] = useState<'discover' | 'stack' | 'tools' | 'publish'>('discover');
  const [publishMode, setPublishMode] = useState<'prompt' | 'curl'>('prompt');
  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(AI_SUBMISSION_PROMPT);
    setCopied(true);
    toast.success('Copied AI submission prompt to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(PUBLISH_CURL_SNIPPET);
    setCopied(true);
    toast.success('Copied API cURL command to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const currentGoal = GOALS.find((g) => g.id === activeGoal);

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
              <span className="hero-goal-badge" style={{ color: currentGoal?.color }}>
                {currentGoal?.title}
              </span>
              <p className="hero-goal-tagline">
                {currentGoal?.tagline}
              </p>
            </div>

            <div className="hero-goal-action-btn-wrap">
              {activeGoal === 'discover' && (
                <Link href="/browse" className="btn btn-primary btn-sm">
                  <Search size={14} /> Search 10,000+ Tools <ArrowRight size={14} />
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

          {/* Goal Content: Feature Explanations or Real API Terminal */}
          {activeGoal === 'discover' && (
            <>
              <div className="hero-goal-features-grid">
                <div className="hero-goal-feature-card">
                  <div className="hero-goal-feature-header">
                    <Search size={16} className="hero-goal-feature-icon" />
                    <span className="hero-goal-feature-title">10,000+ Index Entries</span>
                  </div>
                  <p className="hero-goal-feature-desc">
                    Search across thousands of Model Context Protocol servers by capability, keyword, and category.
                  </p>
                </div>
                <div className="hero-goal-feature-card">
                  <div className="hero-goal-feature-header">
                    <Zap size={16} className="hero-goal-feature-icon" />
                    <span className="hero-goal-feature-title">1-Click Deep Installs</span>
                  </div>
                  <p className="hero-goal-feature-desc">
                    Direct install triggers for Cursor, Claude Desktop, Windsurf, and Cline without editing JSON by hand.
                  </p>
                </div>
                <div className="hero-goal-feature-card">
                  <div className="hero-goal-feature-header">
                    <Shield size={16} className="hero-goal-feature-icon" />
                    <span className="hero-goal-feature-title">Safety & Schema Audited</span>
                  </div>
                  <p className="hero-goal-feature-desc">
                    Live health checks, token consumption metrics, and license compliance indicators on every listing.
                  </p>
                </div>
              </div>
              <div className="hero-goal-footer-row">
                <span className="hero-goal-footer-label">Explore more:</span>
                <div className="hero-goal-quick-links">
                  <Link href="/categories" className="hero-goal-quick-link">
                    Browse 20+ Categories
                  </Link>
                  <Link href="/compare" className="hero-goal-quick-link">
                    Compare Servers
                  </Link>
                  <Link href="/what-is-mcp" className="hero-goal-quick-link">
                    Guide: What is MCP?
                  </Link>
                  <Link href="/clients" className="hero-goal-quick-link">
                    Supported Clients
                  </Link>
                </div>
              </div>
            </>
          )}

          {activeGoal === 'stack' && (
            <>
              <div className="hero-goal-features-grid">
                <div className="hero-goal-feature-card">
                  <div className="hero-goal-feature-header">
                    <Layers size={16} className="hero-goal-feature-icon" />
                    <span className="hero-goal-feature-title">Multi-Server Combiner</span>
                  </div>
                  <p className="hero-goal-feature-desc">
                    Bundle database, browser, GitHub, and context memory tools into a unified agent workspace.
                  </p>
                </div>
                <div className="hero-goal-feature-card">
                  <div className="hero-goal-feature-header">
                    <Cpu size={16} className="hero-goal-feature-icon" />
                    <span className="hero-goal-feature-title">Turnkey Config Export</span>
                  </div>
                  <p className="hero-goal-feature-desc">
                    Generate clean, conflict-free configuration files ready to paste directly into your AI client.
                  </p>
                </div>
                <div className="hero-goal-feature-card">
                  <div className="hero-goal-feature-header">
                    <Brain size={16} className="hero-goal-feature-icon" />
                    <span className="hero-goal-feature-title">Context Budget Estimator</span>
                  </div>
                  <p className="hero-goal-feature-desc">
                    Calculate combined schema token overhead across all servers before deploying to agent prompts.
                  </p>
                </div>
              </div>
              <div className="hero-goal-footer-row">
                <span className="hero-goal-footer-label">Related guides & tools:</span>
                <div className="hero-goal-quick-links">
                  <Link href="/tools/config-generator" className="hero-goal-quick-link">
                    Config Generator
                  </Link>
                  <Link href="/mcp-for-claude-desktop" className="hero-goal-quick-link">
                    Claude Desktop Guide
                  </Link>
                  <Link href="/mcp-for-cursor" className="hero-goal-quick-link">
                    Cursor Setup Guide
                  </Link>
                  <Link href="/mcp-for-windsurf" className="hero-goal-quick-link">
                    Windsurf Setup Guide
                  </Link>
                </div>
              </div>
            </>
          )}

          {activeGoal === 'tools' && (
            <>
              <div className="hero-goal-features-grid">
                <div className="hero-goal-feature-card">
                  <div className="hero-goal-feature-header">
                    <Wrench size={16} className="hero-goal-feature-icon" />
                    <span className="hero-goal-feature-title">JSON-RPC Schema Inspector</span>
                  </div>
                  <p className="hero-goal-feature-desc">
                    Interactively inspect MCP tool parameters, schemas, and return formats in real time.
                  </p>
                </div>
                <div className="hero-goal-feature-card">
                  <div className="hero-goal-feature-header">
                    <Cpu size={16} className="hero-goal-feature-icon" />
                    <span className="hero-goal-feature-title">Token Overhead Calculator</span>
                  </div>
                  <p className="hero-goal-feature-desc">
                    Accurately measure prompt token consumption for any individual server or complete toolset.
                  </p>
                </div>
                <div className="hero-goal-feature-card">
                  <div className="hero-goal-feature-header">
                    <Shield size={16} className="hero-goal-feature-icon" />
                    <span className="hero-goal-feature-title">Config Auditor & Validator</span>
                  </div>
                  <p className="hero-goal-feature-desc">
                    Validate client configs, detect syntax errors, and fix broken server arguments automatically.
                  </p>
                </div>
              </div>
              <div className="hero-goal-footer-row">
                <span className="hero-goal-footer-label">Developer utilities:</span>
                <div className="hero-goal-quick-links">
                  <Link href="/tools/config-validator" className="hero-goal-quick-link">
                    Config Validator
                  </Link>
                  <Link href="/tools/config-auditor" className="hero-goal-quick-link">
                    Config Auditor
                  </Link>
                  <Link href="/tools/openapi-to-mcp" className="hero-goal-quick-link">
                    OpenAPI to MCP
                  </Link>
                  <Link href="/mcp-troubleshooting" className="hero-goal-quick-link">
                    Troubleshooting Guide
                  </Link>
                </div>
              </div>
            </>
          )}

          {activeGoal === 'publish' && (
            <>
              <div className="hero-goal-features-grid">
                <div className="hero-goal-feature-card">
                  <div className="hero-goal-feature-header">
                    <Globe size={16} className="hero-goal-feature-icon" />
                    <span className="hero-goal-feature-title">Instant Registry Discovery</span>
                  </div>
                  <p className="hero-goal-feature-desc">
                    Reach thousands of AI developers, Claude Desktop users, and autonomous coding agents worldwide.
                  </p>
                </div>
                <div className="hero-goal-feature-card">
                  <div className="hero-goal-feature-header">
                    <Shield size={16} className="hero-goal-feature-icon" />
                    <span className="hero-goal-feature-title">Automated Health & Badges</span>
                  </div>
                  <p className="hero-goal-feature-desc">
                    Continuous uptime monitoring, schema analysis, and dynamic embeddable shields for your repo README.
                  </p>
                </div>
                <div className="hero-goal-feature-card">
                  <div className="hero-goal-feature-header">
                    <Brain size={16} className="hero-goal-feature-icon" />
                    <span className="hero-goal-feature-title">1-Click Agent Handoff</span>
                  </div>
                  <p className="hero-goal-feature-desc">
                    Copy the prompt below into Cursor, Claude, or your coding agent to submit automatically.
                  </p>
                </div>
              </div>

              {/* Friendly AI Agent Prompt Box / cURL Toggle */}
              <div className="hero-prompt-card">
                <div className="hero-prompt-header">
                  <div className="hero-prompt-title">
                    <Sparkles size={14} style={{ color: 'var(--gold-color, #d97706)' }} />
                    <span>{publishMode === 'prompt' ? 'AI Agent Submission Prompt' : 'REST Catalog API Endpoint'}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div className="hero-prompt-toggle-wrap">
                      <button
                        type="button"
                        onClick={() => setPublishMode('prompt')}
                        className={`hero-prompt-toggle-btn ${publishMode === 'prompt' ? 'is-active' : ''}`}
                      >
                        Prompt for AI
                      </button>
                      <button
                        type="button"
                        onClick={() => setPublishMode('curl')}
                        className={`hero-prompt-toggle-btn ${publishMode === 'curl' ? 'is-active' : ''}`}
                      >
                        cURL API
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={publishMode === 'prompt' ? handleCopyPrompt : handleCopyCurl}
                      className="hero-prompt-copy-btn"
                      title={publishMode === 'prompt' ? 'Copy prompt for your AI agent' : 'Copy cURL command'}
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copied ? 'Copied!' : publishMode === 'prompt' ? 'Copy Prompt for AI' : 'Copy cURL'}</span>
                    </button>
                  </div>
                </div>

                <pre className="hero-prompt-content">
                  <code>{publishMode === 'prompt' ? AI_SUBMISSION_PROMPT : PUBLISH_CURL_SNIPPET}</code>
                </pre>
              </div>

              <div className="hero-goal-footer-row">
                <span className="hero-goal-footer-label">Developer resources:</span>
                <div className="hero-goal-quick-links">
                  <Link href="/docs/api" className="hero-goal-quick-link">
                    REST API Docs
                  </Link>
                  <Link href="/build-mcp-server" className="hero-goal-quick-link">
                    Build an MCP Server
                  </Link>
                  <Link href="/deploy-mcp-server" className="hero-goal-quick-link">
                    Deploy & Hosting Guide
                  </Link>
                  <Link href="/badge-generator" className="hero-goal-quick-link">
                    Badge Generator
                  </Link>
                </div>
              </div>
            </>
          )}
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
