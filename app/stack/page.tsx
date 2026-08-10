import React from 'react';
import type { Metadata } from 'next';
import { getNewestActiveServers } from '@/lib/servers';
import { StackBuilderModal } from '@/components/StackBuilderModal';
import { PageShell } from '@/components/PageShell';
import Link from 'next/link';
import { Layers, Sparkles, Plus, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'MCP Stack Builder | Combine Multiple MCP Tools in 1-Click',
  description:
    'Build, customize, and export combined MCP server configuration stacks for Claude Desktop, Cursor, Cline, and Windsurf.',
  alternates: {
    canonical: 'https://allmcps.com/stack',
  },
};

export default async function StackPage() {
  const servers = await getNewestActiveServers(500);

  return (
    <PageShell>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.85rem',
              borderRadius: '20px',
              backgroundColor: 'rgba(0, 229, 255, 0.1)',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              color: '#00e5ff',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '1rem',
            }}
          >
            <Layers size={14} /> Multi-Tool Configuration Generator
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.75rem' }}>
            MCP Stack Builder
          </h1>
          <p style={{ fontSize: '1.05rem', color: '#94a3b8', maxWidth: '640px', margin: '0 auto' }}>
            Select your favorite MCP tools and export a single unified <code style={{ color: '#00e5ff' }}>claude_desktop_config.json</code> or Cursor setup in seconds.
          </p>
        </div>

        <StackBuilderModal allServers={servers} isOpen={true} />

        {/* Preset Popular Stacks */}
        <div style={{ marginTop: '4rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 600, color: '#ffffff', marginBottom: '1.25rem', textAlign: 'center' }}>
            Featured MCP Stacks
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            <div
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '1.25rem',
              }}
            >
              <h3 style={{ fontSize: '1.05rem', color: '#00e5ff', fontWeight: 600, marginBottom: '0.35rem' }}>
                Fullstack Web Developer Stack
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
                GitHub + PostgreSQL + Puppeteer + Memory
              </p>
              <Link
                href="/stack?servers=github-mcp,postgresql-mcp,puppeteer-mcp,memory-mcp"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                  color: '#ffffff',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Load Stack <ArrowRight size={14} />
              </Link>
            </div>

            <div
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '1.25rem',
              }}
            >
              <h3 style={{ fontSize: '1.05rem', color: '#a855f7', fontWeight: 600, marginBottom: '0.35rem' }}>
                Data Scientist & Analytics Stack
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
                SQLite + BigQuery + Python Exec + Excel
              </p>
              <Link
                href="/stack?servers=sqlite-mcp,bigquery-mcp,python-mcp,excel-mcp"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                  color: '#ffffff',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Load Stack <ArrowRight size={14} />
              </Link>
            </div>

            <div
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '1.25rem',
              }}
            >
              <h3 style={{ fontSize: '1.05rem', color: '#34d399', fontWeight: 600, marginBottom: '0.35rem' }}>
                DevOps & Infrastructure Stack
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
                Kubernetes + AWS S3 + Docker + Terminal
              </p>
              <Link
                href="/stack?servers=kubernetes-mcp,aws-s3-mcp,docker-mcp,terminal-mcp"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                  color: '#ffffff',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Load Stack <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
