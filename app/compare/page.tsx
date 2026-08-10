import React from 'react';
import type { Metadata } from 'next';
import { getNewestActiveServers, type Server } from '@/lib/servers';
import { PageShell } from '@/components/PageShell';
import Link from 'next/link';
import { Scale, ArrowRight, Search, Sparkles } from 'lucide-react';
import { CompareSelector } from '@/components/CompareSelector';

export const metadata: Metadata = {
  title: 'Compare MCP Servers Side-by-Side | AllMCPs',
  description:
    'Compare Model Context Protocol (MCP) servers side-by-side. Evaluate feature matrices, tools, GitHub stars, authentication models, and install configurations.',
  alternates: {
    canonical: 'https://allmcps.com/compare',
  },
};

export default async function CompareIndexPage() {
  const servers = await getNewestActiveServers(300);

  return (
    <PageShell>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2.5rem 1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.85rem',
              borderRadius: '20px',
              backgroundColor: 'rgba(168, 85, 247, 0.1)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              color: '#a855f7',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '1rem',
            }}
          >
            <Scale size={14} /> Side-by-Side Feature Matrix
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Compare MCP Servers
          </h1>
          <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
            Select 2 to 4 servers to evaluate tool capabilities, installation requirements, and community metrics side-by-side.
          </p>
        </div>

        <CompareSelector servers={servers} />

        {/* Popular Comparisons */}
        <div style={{ marginTop: '3.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
            Popular Server Comparisons
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <Link
              href="/mcp/crystaldba-postgres-mcp/vs/jparkerweb-mcp-sqlite"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.25rem',
                textDecoration: 'none',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#00e5ff' }}>
                  Postgres MCP vs. SQLite MCP
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Compare relational database tools
                </div>
              </div>
              <ArrowRight size={16} style={{ color: '#00e5ff', flexShrink: 0 }} />
            </Link>

            <Link
              href="/mcp/github-github-mcp-server/vs/jmrplens-gitlab-mcp-server"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.25rem',
                textDecoration: 'none',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#a855f7' }}>
                  GitHub MCP vs. GitLab MCP
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Compare Git platform tools & APIs
                </div>
              </div>
              <ArrowRight size={16} style={{ color: '#a855f7', flexShrink: 0 }} />
            </Link>

            <Link
              href="/mcp/automatalabs-mcp-server-playwright/vs/microsoft-playwright-mcp"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.25rem',
                textDecoration: 'none',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#34d399' }}>
                  Automata Playwright vs. Microsoft Playwright
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Compare browser automation tools
                </div>
              </div>
              <ArrowRight size={16} style={{ color: '#34d399', flexShrink: 0 }} />
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
