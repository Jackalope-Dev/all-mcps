'use client';

import React from 'react';
import Link from 'next/link';
import { Bot, Globe, Cpu, Eye, Copy, Search } from 'lucide-react';
import type { SiteStats } from '../lib/siteStats';

function formatCompactNumber(num: number): string {
  if (num >= 1_000_000) {
    const formatted = (num / 1_000_000).toFixed(1);
    return `${formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted}M+`;
  }
  if (num >= 1_000) {
    const formatted = (num / 1_000).toFixed(1);
    return `${formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted}k+`;
  }
  return num.toLocaleString();
}

function formatExactNumber(num: number): string {
  return num.toLocaleString();
}

export function StatsBanner({ stats }: { stats?: SiteStats }) {
  const totalServers = stats?.totalServers ?? 0;
  const aiReads = stats?.aiReads30d ?? 0;
  const botCrawlerReads = stats?.botCrawlerReads30d ?? 0;
  const countries = stats?.countryCount ?? 0;
  const totalViews = stats?.totalViews ?? 0;
  const totalCopies = stats?.totalCopies ?? 0;

  return (
    <div
      className="stats-banner"
      aria-label="Platform statistics"
      style={{
        width: '100%',
        maxWidth: 'var(--container-max)',
        margin: '0.5rem auto 1.25rem',
        padding: '0 var(--space-8)',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        className="stats-banner-pill"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.6rem 1.25rem',
          padding: '0.6rem 1.25rem',
          width: 'fit-content',
          maxWidth: '100%',
          background: 'var(--bg-elevated)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.825rem',
          color: 'var(--text-secondary)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {totalServers > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Cpu size={14} style={{ color: '#34d399' }} />
            <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{formatExactNumber(totalServers)}</strong> MCP Servers
          </span>
        )}

        {totalViews > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
            <Eye size={13} style={{ color: '#38bdf8' }} />
            <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{formatCompactNumber(totalViews)}</strong> Views
          </span>
        )}

        {totalCopies > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
            <Copy size={13} style={{ color: '#f472b6' }} />
            <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{formatCompactNumber(totalCopies)}</strong> Installs
          </span>
        )}

        {(aiReads > 0 || botCrawlerReads > 0) && (
          <Link
            href="/trust"
            title="See the live AI & crawler traffic breakdown"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', color: 'inherit', textDecoration: 'none' }}
          >
            {aiReads > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                <Bot size={14} style={{ color: 'var(--brand-cyan)' }} />
                <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{formatCompactNumber(aiReads)}</strong> AI Reads
              </span>
            )}
            {botCrawlerReads > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                <Search size={13} style={{ color: '#94a3b8' }} />
                <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{formatCompactNumber(botCrawlerReads)}</strong> Crawler Hits
              </span>
            )}
          </Link>
        )}

        {countries > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
            <Globe size={14} style={{ color: '#60a5fa' }} />
            <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{countries}</strong> Countries
          </span>
        )}
      </div>
    </div>
  );
}
