import type { Metadata } from 'next';
import { ClientLanding } from '@/components/clients/ClientLanding';
import { serializeJsonLd } from '@/lib/jsonLd';
import { getCuratedStarterServers } from '@/lib/servers';

export const metadata: Metadata = {
  title: 'Top MCP Servers for Cline & Roo Code — Setup Guide',
  description:
    'Discover top Model Context Protocol (MCP) tools for Cline and Roo Code in VS Code. Setup guide and configuration for cline_mcp_settings.json.',
  alternates: { canonical: 'https://allmcps.com/mcp-for-cline' },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'Top MCP Servers for Cline | AllMCPs',
    description:
      'Supercharge Cline autonomous coding in VS Code with MCP tools for GitHub, databases, and web search.',
    url: 'https://allmcps.com/mcp-for-cline',
  },
};

export default async function ClineMcpPage() {
  const topServers = await getCuratedStarterServers(12);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        name: 'Top MCP Servers for Cline & VS Code',
        description:
          'Guide to configuring Model Context Protocol (MCP) servers in Cline and VS Code.',
        url: 'https://allmcps.com/mcp-for-cline',
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Where is the cline_mcp_settings.json file located?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'In VS Code, open the Cline side panel settings tab or edit settings directly in line with your workspace config.',
            },
          },
        ],
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
            name: 'Clients',
            item: 'https://allmcps.com/clients',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'Cline / VS Code',
            item: 'https://allmcps.com/mcp-for-cline',
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <ClientLanding
        slug="cline"
        crumb={'Cline / VS Code'}
        titleLead={'Top MCP Servers for'}
        titleName={'Cline / VS Code'}
        lede={
          'Connect Cline in VS Code directly to databases, web search, GitHub repositories, and system tools using Model Context Protocol.'
        }
        primaryLabel={'Browse Cline MCP Servers'}
        guideLabel={'Cline Setup Guide'}
        serversHeading={'Cline Compatible MCP Servers'}
        faq={{
          q: 'Where is the cline_mcp_settings.json file located?',
          a: 'In VS Code, open the Cline side panel settings tab or edit settings directly in line with your workspace config.',
        }}
        servers={topServers}
      />
    </>
  );
}
