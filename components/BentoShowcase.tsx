'use client';

import React from 'react';
import Link from 'next/link';
import {
  Globe,
  Terminal,
  Layers,
  Wrench,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Code2,
  Cpu,
  Search,
  CheckCircle2,
  FileJson,
  Boxes,
} from 'lucide-react';
import { Card } from './ui/Card';

export function BentoShowcase() {
  return (
    <section className="container bento-section animate-fade-in delay-2">
      <div className="bento-header">
        <div className="bento-eyebrow">
          <Sparkles size={14} style={{ color: 'var(--accent-color)' }} />
          <span>Understanding the Model Context Protocol</span>
        </div>
        <h2 className="bento-title">How AllMCPs accelerates your AI capabilities</h2>
        <p className="bento-subtitle">
          Everything you need to discover, test, package, and deploy real-world tools directly into AI agents &mdash; whether for coding in Cursor or production workflows with Claude.
        </p>
      </div>

      <div className="bento-grid">
        {/* Card 1: 2-Column Wide - Intent-Based Discovery */}
        <Card
          href="/browse"
          hoverable
          className="bento-card bento-card--large bento-card--catalog"
        >
          <div className="bento-card-bg-gradient" />
          <div className="bento-card-content">
            <div className="bento-card-icon-wrap">
              <Search size={22} style={{ color: 'var(--accent-color)' }} />
            </div>
            <span className="bento-card-tag">Goal-Driven Search</span>
            <h3 className="bento-card-heading">Find Tools by Natural Intent</h3>
            <p className="bento-card-text">
              Type what you need your AI to accomplish &mdash; like &ldquo;query production Postgres&rdquo;, &ldquo;scrape dynamic JavaScript pages with Playwright&rdquo;, or &ldquo;search GitHub pull requests&rdquo;. Our semantic search indexes tools by real capabilities and parameters, not just repository names.
            </p>
            <div className="bento-card-cta">
              <span>Explore 10,000+ Tools</span>
              <ArrowRight size={15} />
            </div>
          </div>
        </Card>

        {/* Card 2: 1-Column - 1-Click Deep Install */}
        <Card
          href="/mcp-for-cursor"
          hoverable
          className="bento-card bento-card--standard"
        >
          <div className="bento-card-content">
            <div className="bento-card-icon-wrap">
              <Zap size={22} style={{ color: 'var(--gold-color, #d97706)' }} />
            </div>
            <span className="bento-card-tag">Instant Integration</span>
            <h3 className="bento-card-heading">Zero-Friction 1-Click Installs</h3>
            <p className="bento-card-text">
              Direct deep-link protocol handlers inject servers directly into Cursor, VS Code, and Windsurf without needing to find or edit local JSON configuration files.
            </p>
            <div className="bento-card-cta">
              <span>See Client Setup</span>
              <ArrowRight size={15} />
            </div>
          </div>
        </Card>

        {/* Card 3: 1-Column - Turnkey Multi-Tool Stacks */}
        <Card
          href="/stack"
          hoverable
          className="bento-card bento-card--standard"
        >
          <div className="bento-card-content">
            <div className="bento-card-icon-wrap">
              <Boxes size={22} style={{ color: 'var(--verified-green, #10b981)' }} />
            </div>
            <span className="bento-card-tag">Curated Stacks</span>
            <h3 className="bento-card-heading">Turnkey Workflow Stacks</h3>
            <p className="bento-card-text">
              Assemble pre-tested tool suites for Web Development, Data Science, DevOps, and Research into a unified, deduplicated client configuration in seconds.
            </p>
            <div className="bento-card-cta">
              <span>Build Your Stack</span>
              <ArrowRight size={15} />
            </div>
          </div>
        </Card>

        {/* Card 4: 2-Column Wide - Schema Inspection & Diagnostics */}
        <Card
          href="/tools"
          hoverable
          className="bento-card bento-card--large bento-card--tools"
        >
          <div className="bento-card-bg-gradient" />
          <div className="bento-card-content">
            <div className="bento-card-icon-wrap">
              <Wrench size={22} style={{ color: 'var(--chart-series-5, #9333ea)' }} />
            </div>
            <span className="bento-card-tag">Developer Diagnostic Suite</span>
            <h3 className="bento-card-heading">Live Schema Inspection &amp; Context Budgeting</h3>
            <p className="bento-card-text">
              Inspect live parameter schemas, estimate context window token overhead before installing heavy tools, audit JSON syntax, debug JSON-RPC 2.0 payloads, and convert OpenAPI 3.0 specs to FastMCP server code.
            </p>
            <div className="bento-card-cta">
              <span>Launch Developer Tools</span>
              <ArrowRight size={15} />
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
