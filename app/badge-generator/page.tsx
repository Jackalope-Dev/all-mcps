import { Metadata } from 'next';
import { PageShell, PageHeader } from '../../components/PageShell';
import { BadgeEmbedBuilder } from '../../components/ui/BadgeEmbedBuilder';

export const metadata: Metadata = {
  title: 'MCP Server Badge Generator & Embed Builder | AllMCPs',
  description: 'Generate dynamic SVG verification badges and embeddable widgets for your Model Context Protocol (MCP) server GitHub README or website.',
  alternates: { canonical: 'https://allmcps.com/badge-generator' },
  openGraph: {
    title: 'MCP Server Badge Generator | AllMCPs',
    description: 'Create dark & light mode SVG badges for your MCP server. Keep the badge dofollow and verify your site to earn a reciprocal dofollow backlink.',
    url: 'https://allmcps.com/badge-generator',
  },
};

export default function BadgeGeneratorPage() {
  return (
    <PageShell variant="tool" panel>
      <PageHeader
        title="MCP Badge & Embed Generator"
        description="Customize dynamic SVG badges for your GitHub README, documentation site, or blog. Keep the badge dofollow and verify your site to turn your listing's website link into a reciprocal dofollow backlink."
      />
      <div style={{ marginTop: '2rem' }}>
        <BadgeEmbedBuilder />
      </div>
    </PageShell>
  );
}
