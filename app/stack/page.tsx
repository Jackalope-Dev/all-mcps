import { Layers } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHeader, PageShell } from '@/components/PageShell';
import { PresetStackGrid } from '@/components/PresetStackGrid';
import { StackBuilderModal } from '@/components/StackBuilderModal';
import { getNewestActiveServers } from '@/lib/servers';

export const metadata: Metadata = {
  title: 'MCP Stack Builder: Combine Tools in 1-Click',
  description:
    'Build, customize, and export combined MCP server configuration stacks for Claude Desktop, Cursor, Cline, and Windsurf.',
  alternates: {
    canonical: 'https://allmcps.com/stack',
  },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'MCP Stack Builder: Combine Tools in 1-Click | AllMCPs',
    description:
      'Build, customize, and export combined MCP server configuration stacks for Claude Desktop, Cursor, Cline, and Windsurf.',
    url: 'https://allmcps.com/stack',
  },
};

export default async function StackPage() {
  const servers = await getNewestActiveServers(500);

  return (
    <PageShell>
      <div
        style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1rem' }}
      >
        <PageHeader
          centered
          badge={
            <>
              <Layers size={14} /> Multi-Tool Configuration Generator
            </>
          }
          title="MCP Stack Builder"
          description={
            <>
              Select your favorite MCP tools and export a single unified{' '}
              <code style={{ color: 'var(--accent-color)' }}>
                claude_desktop_config.json
              </code>{' '}
              or Cursor setup in seconds.
            </>
          }
        />

        {/* Inline Stack Manager (non-modal) */}
        <StackBuilderModal allServers={servers} isOpen={true} isModal={false} />

        {/* Interactive Featured Preset Stacks */}
        <PresetStackGrid />
      </div>
    </PageShell>
  );
}
