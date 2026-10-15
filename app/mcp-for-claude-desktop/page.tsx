import type { Metadata } from 'next';
import { ClientLanding } from '@/components/clients/ClientLanding';
import { serializeJsonLd } from '@/lib/jsonLd';
import { getCuratedStarterServers } from '@/lib/servers';

export const metadata: Metadata = {
  title: 'Top MCP Servers for Claude Desktop — Setup Guide',
  description:
    'Discover top Model Context Protocol (MCP) tools for Anthropic Claude Desktop. Interactive setup guide for claude_desktop_config.json on macOS and Windows.',
  alternates: { canonical: 'https://allmcps.com/mcp-for-claude-desktop' },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'Top MCP Servers for Claude Desktop | AllMCPs',
    description:
      'Connect Claude Desktop to local files, SQLite databases, GitHub, and API integrations over MCP.',
    url: 'https://allmcps.com/mcp-for-claude-desktop',
  },
};

export default async function ClaudeDesktopMcpPage() {
  const topServers = await getCuratedStarterServers(12);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        name: 'Top MCP Servers for Claude Desktop',
        description:
          'Guide to configuring Model Context Protocol (MCP) servers in Anthropic Claude Desktop.',
        url: 'https://allmcps.com/mcp-for-claude-desktop',
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Where is claude_desktop_config.json located?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'On macOS: ~/Library/Application Support/Claude/claude_desktop_config.json. On Windows: %APPDATA%\\Claude\\claude_desktop_config.json.',
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
            name: 'Claude Desktop',
            item: 'https://allmcps.com/mcp-for-claude-desktop',
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
        slug="claude-desktop"
        crumb={'Claude Desktop'}
        titleLead={'Top MCP Servers for'}
        titleName={'Claude Desktop'}
        lede={
          'Connect Claude Desktop directly to your desktop files, databases, and development tools. Generate pre-formatted JSON snippets or browse verified servers.'
        }
        primaryLabel={'Browse Compatible Servers'}
        guideLabel={'Full Setup Guide'}
        serversHeading={'Featured Claude Desktop Servers'}
        faq={{
          q: 'Where is claude_desktop_config.json located?',
          a: 'On macOS: ~/Library/Application Support/Claude/claude_desktop_config.json. On Windows: %APPDATA%\\Claude\\claude_desktop_config.json.',
        }}
        servers={topServers}
      />
    </>
  );
}
