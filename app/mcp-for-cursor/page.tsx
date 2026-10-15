import type { Metadata } from 'next';
import { ClientLanding } from '@/components/clients/ClientLanding';
import { serializeJsonLd } from '@/lib/jsonLd';
import { getCuratedStarterServers } from '@/lib/servers';

export const metadata: Metadata = {
  title: 'Top MCP Servers for Cursor IDE — Setup Guide',
  description:
    'Discover top Model Context Protocol (MCP) tools for Cursor IDE. Interactive setup guide for Cursor MCP server configurations on macOS and Windows.',
  alternates: { canonical: 'https://allmcps.com/mcp-for-cursor' },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'Top MCP Servers for Cursor | AllMCPs',
    description:
      'Connect Cursor AI editor to databases, APIs, and custom agent tools over MCP.',
    url: 'https://allmcps.com/mcp-for-cursor',
  },
};

export default async function CursorMcpPage() {
  const topServers = await getCuratedStarterServers(12);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        name: 'Best MCP Servers for Cursor IDE',
        description:
          'Guide to configuring Model Context Protocol (MCP) servers in Cursor AI editor.',
        url: 'https://allmcps.com/mcp-for-cursor',
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Where is the Cursor MCP config file located?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Cursor MCP config can be placed in .cursor/mcp.json at your project root, or added under Cursor Settings -> Features -> MCP Server.',
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
            name: 'Cursor IDE',
            item: 'https://allmcps.com/mcp-for-cursor',
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
        slug="cursor"
        crumb={'Cursor IDE'}
        titleLead={'Best MCP Servers for'}
        titleName={'Cursor IDE'}
        lede={
          'Connect Cursor Composer and AI agents directly to local databases, file systems, GitHub repositories, and external APIs using Model Context Protocol (MCP).'
        }
        primaryLabel={'Top Cursor MCP Servers'}
        guideLabel={'Full Cursor Setup Guide'}
        serversHeading={'Top Compatible MCP Servers for Cursor'}
        faq={{
          q: 'Where is the Cursor MCP config file located?',
          a: 'Cursor MCP config can be placed in .cursor/mcp.json at your project root, or added under Cursor Settings -> Features -> MCP Server.',
        }}
        servers={topServers}
      />
    </>
  );
}
