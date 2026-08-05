'use client';

import React from 'react';
import { Bot, Globe, Cpu, Sparkles } from 'lucide-react';
import type { SiteStats } from '../lib/siteStats';

function formatCompactNumber(num: number): string {
  if (num >= 1_000_000) {
    const formatted = (num / 1_000_000).toFixed(1);
    return `${formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted}M+`;
  }
  if (num >= 1_000) {
    return `${Math.floor(num / 1_000)}k+`;
  }
  return num.toLocaleString();
}

function formatExactNumber(num: number): string {
  return num.toLocaleString();
}

export function StatsBanner({ stats }: { stats?: SiteStats }) {
  const aiReads = stats?.aiReads30d ?? 4600000;
  const aiSystems = stats?.aiSystemCount ?? 34;
  const monthlyVisitors = stats?.monthlyVisitors ?? 788113;
  const countries = stats?.countryCount ?? 168;
  const totalServers = stats?.totalServers ?? 3200;
  const featuredSystems = stats?.featuredAiSystems ?? [
    'ChatGPT',
    'Claude',
    'Cursor',
    'Perplexity',
    'Gemini',
  ];

  return (
    <div
      aria-label="Platform reach and statistics"
      style={{
        width: '100%',
        maxWidth: 'var(--container-max)',
        margin: '1.25rem auto 1.75rem',
        padding: '0 var(--space-8)',
      }}
    >
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 'var(--radius-xl)',
          padding: '1.5rem 1.75rem',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top subtle brand gradient bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, #00e5ff 0%, #007bff 50%, rgba(0, 229, 255, 0.2) 100%)',
          }}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.5rem',
            alignItems: 'center',
          }}
        >
          {/* Stat 1: AI Agent Queries */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(0, 229, 255, 0.12)',
                border: '1px solid rgba(0, 229, 255, 0.25)',
                color: 'var(--brand-cyan)',
                flexShrink: 0,
                marginTop: '0.125rem',
              }}
            >
              <Bot size={20} aria-hidden="true" />
            </div>
            <div>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.25,
                }}
              >
                Read{' '}
                <span
                  style={{
                    background: 'var(--brand-gradient)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {formatCompactNumber(aiReads)}
                </span>{' '}
                times
              </div>
              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  marginTop: '0.25rem',
                  lineHeight: 1.45,
                }}
              >
                by <strong style={{ color: 'var(--text-primary)' }}>{aiSystems} AI systems</strong>{' '}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(last 30d)</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.35rem',
                  marginTop: '0.5rem',
                }}
              >
                {featuredSystems.map((system) => (
                  <span
                    key={system}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.45rem',
                      borderRadius: 'var(--radius-full)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {system}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Stat 2: Human Reach & Traffic */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(0, 123, 255, 0.15)',
                border: '1px solid rgba(0, 123, 255, 0.3)',
                color: '#60a5fa',
                flexShrink: 0,
                marginTop: '0.125rem',
              }}
            >
              <Globe size={20} aria-hidden="true" />
            </div>
            <div>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.25,
                }}
              >
                {formatExactNumber(monthlyVisitors)}
              </div>
              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  marginTop: '0.25rem',
                  lineHeight: 1.45,
                }}
              >
                monthly visitors across{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{countries} countries</strong>
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.725rem',
                  color: 'var(--brand-cyan)',
                  marginTop: '0.5rem',
                  fontWeight: 500,
                }}
              >
                <Sparkles size={12} /> Worldwide distribution for submitted tools
              </div>
            </div>
          </div>

          {/* Stat 3: Catalog Depth & Readiness */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#34d399',
                flexShrink: 0,
                marginTop: '0.125rem',
              }}
            >
              <Cpu size={20} aria-hidden="true" />
            </div>
            <div>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.25,
                }}
              >
                {formatExactNumber(totalServers)}+ MCP Servers
              </div>
              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  marginTop: '0.25rem',
                  lineHeight: 1.45,
                }}
              >
                indexed, introspected &amp; ready to install
              </div>
              <div
                style={{
                  fontSize: '0.725rem',
                  color: 'var(--text-secondary)',
                  marginTop: '0.5rem',
                }}
              >
                Updated daily with introspection &amp; health checks
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
