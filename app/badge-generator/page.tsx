import { Metadata } from 'next';
import { PageShell, PageHeader } from '../../components/PageShell';
import { BadgeEmbedBuilder } from '../../components/ui/BadgeEmbedBuilder';

export const metadata: Metadata = {
  title: 'MCP Server Badge Generator & Embed Builder | AllMCPs',
  description: 'Generate dynamic SVG verification badges and embeddable widgets for your Model Context Protocol (MCP) server GitHub README or website.',
  alternates: { canonical: 'https://allmcps.com/badge-generator' },
  openGraph: {
    title: 'MCP Server Badge Generator | AllMCPs',
    description: 'Create dark & light mode SVG badges for your MCP server. Auto-verifies your listing upon GitHub README inclusion.',
    url: 'https://allmcps.com/badge-generator',
  },
};

export default function BadgeGeneratorPage() {
  return (
    <PageShell variant="tool" panel>
      <PageHeader
        title="MCP Badge & Embed Generator"
        description="Customize dynamic SVG badges for your GitHub README, documentation site, or blog. Automatically claims verified badge status when added to your repository."
      />
      <div style={{ marginTop: '2rem' }}>
        <BadgeEmbedBuilder />
      </div>
    </PageShell>
  );
}
