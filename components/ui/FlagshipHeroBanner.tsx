'use client';

import React, { useState } from 'react';
import { Sparkles, Terminal, Search, Send, BadgeCheck, Copy, Check, ExternalLink, ArrowDown } from 'lucide-react';
import Link from 'next/link';

interface FlagshipHeroBannerProps {
  serverId: string;
  serverName: string;
}

export function FlagshipHeroBanner({ serverId, serverName }: FlagshipHeroBannerProps) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const samplePrompt = `Install and configure the ${serverName} MCP server (npx -y allmcps-server) so you can search the AllMCPs directory, look up MCP server install configs, and submit new MCP tools directly from your prompts.`;

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(samplePrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {
      // ignore copy fallback
    }
  };

  return (
    <section
      className="surface flagship-hero-banner"
      style={{
        marginBottom: '2rem',
        borderRadius: '16px',
        padding: '1.75rem',
        border: '1px solid rgba(0, 229, 255, 0.35)',
        background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(124, 58, 237, 0.08) 50%, rgba(16, 185, 129, 0.05) 100%)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative ambient background blur element */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '220px',
          height: '220px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 229, 255, 0.25) 0%, rgba(0, 0, 0, 0) 70%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Banner Top Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.25rem 0.65rem',
              borderRadius: '20px',
              background: 'linear-gradient(90deg, rgba(0,229,255,0.2), rgba(168,85,247,0.2))',
              border: '1px solid rgba(0,229,255,0.4)',
              color: 'var(--brand-cyan)',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <Sparkles size={13} style={{ color: 'var(--brand-cyan)' }} />
            Official Directory Meta-Server
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
            }}
          >
            <BadgeCheck size={14} style={{ color: '#10b981' }} /> 8 Native MCP Tools
          </span>
        </div>

        {/* Banner Heading */}
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            lineHeight: 1.3,
            margin: '0 0 0.65rem',
          }}
        >
          Supercharge Your AI Coding Agent with AllMCPs Meta-Tools
        </h2>

        {/* Banner Description */}
        <p
          style={{
            fontSize: '0.95rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            margin: '0 0 1.25rem',
            maxWidth: '780px',
          }}
        >
          Equip <strong>Claude Desktop</strong>, <strong>Cursor</strong>, <strong>Windsurf</strong>, or <strong>Antigravity</strong> with programmatic access to search 10,000+ Model Context Protocol servers, generate instant client configuration JSON, verify listing claims, and submit new MCP tools straight from your prompt window.
        </p>

        {/* Feature Grid Pills */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.25rem',
          }}
        >
          <div
            style={{
              padding: '0.75rem 0.85rem',
              borderRadius: '10px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Search size={18} style={{ color: 'var(--brand-cyan)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                Directory Search &amp; Configs
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Search listings and get setup JSON on demand.
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '0.75rem 0.85rem',
              borderRadius: '10px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Send size={18} style={{ color: '#a855f7', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                Agentic Submissions
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Submit newly created MCP repos to AllMCPs.
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '0.75rem 0.85rem',
              borderRadius: '10px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Terminal size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                Zero-Config Bridge
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Run <code>npx -y allmcps-server</code> directly over stdio.
              </div>
            </div>
          </div>
        </div>

        {/* Action Button Strip */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={copyPrompt}
            className="btn btn-primary"
            style={{
              padding: '0.55rem 1rem',
              fontSize: '0.875rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            {copiedPrompt ? <Check size={16} /> : <Copy size={16} />}
            <span>{copiedPrompt ? 'Prompt Copied!' : 'Copy Agent Setup Prompt'}</span>
          </button>

          <a
            href="#tools-schema"
            className="btn btn-secondary"
            style={{
              padding: '0.55rem 1rem',
              fontSize: '0.875rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <ArrowDown size={16} /> Inspect 8 MCP Tool Schemas
          </a>

          <Link
            href="/docs/api"
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.55rem 0.75rem',
              textDecoration: 'none',
            }}
          >
            <span>REST API Documentation</span>
            <ExternalLink size={13} />
          </Link>
        </div>
      </div>
    </section>
  );
}
