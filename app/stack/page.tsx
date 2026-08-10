import React from 'react';
import type { Metadata } from 'next';
import { getNewestActiveServers } from '@/lib/servers';
import { StackBuilderModal } from '@/components/StackBuilderModal';
import { PresetStackGrid } from '@/components/PresetStackGrid';
import { PageShell } from '@/components/PageShell';
import { Layers } from 'lucide-react';

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
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1rem' }}>
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
              color: 'var(--accent-color)',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '1rem',
            }}
          >
            <Layers size={14} /> Multi-Tool Configuration Generator
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            MCP Stack Builder
          </h1>
          <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto' }}>
            Select your favorite MCP tools and export a single unified <code style={{ color: 'var(--accent-color)' }}>claude_desktop_config.json</code> or Cursor setup in seconds.
          </p>
        </div>

        {/* Inline Stack Manager (non-modal) */}
        <StackBuilderModal allServers={servers} isOpen={true} isModal={false} />

        {/* Interactive Featured Preset Stacks */}
        <PresetStackGrid />
      </div>
    </PageShell>
  );
}
