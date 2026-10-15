import { ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { ToolPage } from '../../components/tools/ToolPage';
import { BadgeEmbedBuilder } from '../../components/ui/BadgeEmbedBuilder';

export const metadata: Metadata = {
  title: 'MCP Server Badge Generator & Embed Builder',
  description:
    'Generate dynamic SVG verification badges and embeddable widgets for your Model Context Protocol (MCP) server GitHub README or website.',
  alternates: { canonical: 'https://allmcps.com/badge-generator' },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'MCP Server Badge Generator | AllMCPs',
    description:
      'Create dark & light mode SVG badges for your MCP server. Keep the badge dofollow and verify your site to earn a reciprocal dofollow backlink.',
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
        description:
          'Generate dynamic SVG verification badges and embeddable widgets for your Model Context Protocol (MCP) server GitHub README or website.',
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
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://allmcps.com',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Tools',
            item: 'https://allmcps.com/tools',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'Badge Generator',
            item: 'https://allmcps.com/badge-generator',
          },
        ],
      },
    ],
  };

  return (
    <ToolPage
      href="/badge-generator"
      crumb="Badge Generator"
      title="MCP Badge & Embed Generator"
      description={
        <p>
          Generate dynamic SVG badges in 3 easy steps: select your MCP server,
          customize the badge style &amp; metric, then copy the Markdown or HTML
          snippet for your GitHub README or project site.
        </p>
      }
      meta={['Free', 'No sign-in', 'Live SVG, always up to date']}
      jsonLd={[jsonLd]}
    >
      <div className="tl-alert tl-alert--ok bdg-dofollow">
        <ShieldCheck size={18} aria-hidden="true" />
        <p>
          <strong>Free dofollow path:</strong> claim your listing, verify the
          product website, then embed a badge <em>without</em>{' '}
          <code>nofollow</code>. We recheck periodically. Premium listings get
          dofollow without a badge — see <a href="/pricing#premium">Premium</a>.
        </p>
      </div>
      <BadgeEmbedBuilder />
    </ToolPage>
  );
}
