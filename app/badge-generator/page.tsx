import { Metadata } from 'next';
import { PageShell, PageHeader } from '../../components/PageShell';
import { BadgeEmbedBuilder } from '../../components/ui/BadgeEmbedBuilder';

export const metadata: Metadata = {
  title: 'MCP Server Badge Generator & Embed Builder',
  description: 'Generate dynamic SVG verification badges and embeddable widgets for your Model Context Protocol (MCP) server GitHub README or website.',
  alternates: { canonical: 'https://allmcps.com/badge-generator' },
  openGraph: {
    title: 'MCP Server Badge Generator | AllMCPs',
    description: 'Create dark & light mode SVG badges for your MCP server. Keep the badge dofollow and verify your site to earn a reciprocal dofollow backlink.',
    url: 'https://allmcps.com/badge-generator',
  },
};

export default function BadgeGeneratorPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'MCP Server Badge Generator & Embed Builder',
        description: 'Generate dynamic SVG verification badges and embeddable widgets for your Model Context Protocol (MCP) server GitHub README or website.',
        url: 'https://allmcps.com/badge-generator',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'All',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://allmcps.com' },
          { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://allmcps.com/tools' },
          { '@type': 'ListItem', position: 3, name: 'Badge Generator', item: 'https://allmcps.com/badge-generator' },
        ],
      },
    ],
  };

  return (
    <PageShell variant="tool" panel>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHeader
        title="MCP Badge & Embed Generator"
        description="Generate dynamic SVG badges in 3 easy steps: 1. Select your MCP server, 2. Customize badge style & metric, 3. Copy the Markdown or HTML snippet for your GitHub README or project site."
      />
      <div
        style={{
          marginTop: '1.25rem',
          padding: '1rem 1.15rem',
          borderRadius: 12,
          border: '1px solid rgba(16,185,129,0.3)',
          background: 'rgba(16,185,129,0.08)',
          fontSize: '0.9rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.55,
        }}
      >
        <strong style={{ color: '#34d399' }}>Free dofollow path:</strong> claim your listing, verify
        the product website, then embed a badge <em>without</em> <code>nofollow</code>. We recheck
        periodically. Premium listings get dofollow without a badge — see{' '}
        <a href="/pricing#premium" style={{ color: 'var(--accent-color)' }}>
          Premium
        </a>
        .
      </div>
      <div style={{ marginTop: '2rem' }}>
        <BadgeEmbedBuilder />
      </div>
    </PageShell>
  );
}
