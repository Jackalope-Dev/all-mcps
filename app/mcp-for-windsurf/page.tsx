import type { Metadata } from 'next';
import { ClientLanding } from '@/components/clients/ClientLanding';
import { serializeJsonLd } from '@/lib/jsonLd';
import { getCuratedStarterServers } from '@/lib/servers';

export const metadata: Metadata = {
  title: 'Top MCP Servers for Windsurf Cascade — Setup Guide',
  description:
    'Discover top Model Context Protocol (MCP) tools for Codeium Windsurf. Setup guide and configuration for mcp_config.json.',
  alternates: { canonical: 'https://allmcps.com/mcp-for-windsurf' },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'Top MCP Servers for Windsurf | AllMCPs',
    description:
      'Connect Windsurf Cascade agent to databases, APIs, and CLI tools over MCP.',
    url: 'https://allmcps.com/mcp-for-windsurf',
  },
};

export default async function WindsurfMcpPage() {
  const topServers = await getCuratedStarterServers(12);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        name: 'Best MCP Servers for Windsurf Cascade',
        description:
          'Guide to configuring Model Context Protocol (MCP) servers in Codeium Windsurf Cascade editor.',
        url: 'https://allmcps.com/mcp-for-windsurf',
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Where is the Windsurf mcp_config.json file located?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'The configuration file is located at ~/.codeium/windsurf/mcp_config.json.',
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
            name: 'Windsurf',
            item: 'https://allmcps.com/mcp-for-windsurf',
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
        slug="windsurf"
        crumb={'Windsurf'}
        titleLead={'Best MCP Servers for'}
        titleName={'Windsurf Cascade'}
        lede={
          'Extend Codeium Windsurf Cascade with external tools, APIs, and local databases via Model Context Protocol.'
        }
        primaryLabel={'Top Windsurf MCP Tools'}
        guideLabel={'Windsurf Setup Guide'}
        serversHeading={'Windsurf Compatible MCP Servers'}
        faq={{
          q: 'Where is the Windsurf mcp_config.json file located?',
          a: 'The configuration file is located at ~/.codeium/windsurf/mcp_config.json.',
        }}
        servers={topServers}
      />
    </>
  );
}
