'use client';

import React from 'react';
import { ArrowRight, Boxes, Search, Wrench, Zap } from 'lucide-react';
import { Card } from './ui/Card';

export function BentoShowcase() {
  return (
    <section className="container bento-section animate-fade-in delay-2">
      <div className="bento-header">
        <h2 className="bento-title">Directory, stacks, and tools</h2>
        <p className="bento-subtitle">Find a server, combine a stack, or inspect it before install.</p>
      </div>

      <div className="bento-grid">
        <Card
          href="/browse"
          hoverable
          glow
          crosshair
          className="bento-card bento-card--large bento-card--catalog"
        >
          <div className="bento-card-bg-gradient" />
          <div className="bento-card-content">
            <div className="bento-card-icon-wrap">
              <Search size={22} style={{ color: 'var(--accent-color)' }} />
            </div>
            <h3 className="bento-card-heading">Search MCP servers</h3>
            <p className="bento-card-text">
              Search by the job: query Postgres, scrape a page, review a GitHub PR.
            </p>
            <div className="bento-card-cta">
              <span>Browse the directory</span>
              <ArrowRight size={15} />
            </div>
          </div>
        </Card>

        <Card
          href="/mcp-for-cursor"
          hoverable
          glow
          crosshair
          className="bento-card bento-card--standard"
        >
          <div className="bento-card-content">
            <div className="bento-card-icon-wrap">
              <Zap size={22} style={{ color: 'var(--gold-color, #d97706)' }} />
            </div>
            <h3 className="bento-card-heading">One-click install</h3>
            <p className="bento-card-text">
              Add a server to Cursor, Claude Desktop, Windsurf, or Cline.
            </p>
            <div className="bento-card-cta">
              <span>Client setup</span>
              <ArrowRight size={15} />
            </div>
          </div>
        </Card>

        <Card
          href="/stack"
          hoverable
          glow
          crosshair
          className="bento-card bento-card--standard"
        >
          <div className="bento-card-content">
            <div className="bento-card-icon-wrap">
              <Boxes size={22} style={{ color: 'var(--verified-green, #10b981)' }} />
            </div>
            <h3 className="bento-card-heading">Build a stack</h3>
            <p className="bento-card-text">Combine MCP servers into one client config.</p>
            <div className="bento-card-cta">
              <span>Stack builder</span>
              <ArrowRight size={15} />
            </div>
          </div>
        </Card>

        <Card
          href="/tools"
          hoverable
          glow
          crosshair
          className="bento-card bento-card--large bento-card--tools"
        >
          <div className="bento-card-bg-gradient" />
          <div className="bento-card-content">
            <div className="bento-card-icon-wrap">
              <Wrench size={22} style={{ color: 'var(--chart-series-5, #9333ea)' }} />
            </div>
            <h3 className="bento-card-heading">Inspect before you install</h3>
            <p className="bento-card-text">Check tools, tokens, and config on any listing.</p>
            <div className="bento-card-cta">
              <span>Developer tools</span>
              <ArrowRight size={15} />
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
