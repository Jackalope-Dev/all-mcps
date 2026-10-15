import type { Metadata } from 'next';
import { PresetStackGrid } from '@/components/PresetStackGrid';
import { StackBuilderModal } from '@/components/StackBuilderModal';
import { ToolPage } from '@/components/tools/ToolPage';
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
    <ToolPage
      href="/stack"
      crumb="Stack Builder"
      title="MCP Stack Builder"
      description={
        <p>
          Select your favorite MCP tools and export a single unified{' '}
          <code>claude_desktop_config.json</code> or Cursor setup in seconds.
        </p>
      }
      meta={['Free', 'No sign-in', 'Saved in this browser', 'Shareable link']}
    >
      <StackBuilderModal allServers={servers} isOpen={true} isModal={false} />
      <PresetStackGrid />
    </ToolPage>
  );
}
