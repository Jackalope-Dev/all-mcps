import { BookOpen, ChevronRight, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ClientConfigSection } from '@/components/clients/ClientConfigSection';
import { ServerConfigCopyButton } from '@/components/clients/ServerConfigCopyButton';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { SafeMarkdown } from '@/components/ui/SafeMarkdown';
import { ServerAvatar } from '@/components/ui/ServerAvatar';
import { mcpClientBySlug } from '@/lib/clients';
import { parseServerName } from '@/lib/displayName';
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
  const client = mcpClientBySlug('claude-desktop');

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main
        className="container page-shell"
        style={{
          paddingTop: 'var(--space-8)',
          paddingBottom: 'var(--space-16)',
        }}
      >
        <nav aria-label="Breadcrumb" style={{ marginBottom: '2rem' }}>
          <ol className="breadcrumb">
            <li>
              <Link href="/">Home</Link>
            </li>
            <li className="breadcrumb-separator">
              <ChevronRight size={12} />
            </li>
            <li>
              <Link href="/clients">Clients</Link>
            </li>
            <li className="breadcrumb-separator">
              <ChevronRight size={12} />
            </li>
            <li className="breadcrumb-current">Claude Desktop</li>
          </ol>
        </nav>

        <section style={{ maxWidth: '800px', marginBottom: '3rem' }}>
          <Badge variant="verified" style={{ marginBottom: '1rem' }}>
            Claude Desktop Directory & Generator
          </Badge>
          <h1 className="text-display" style={{ marginBottom: '1rem' }}>
            Top MCP Servers for{' '}
            <span className="text-brand-gradient">Claude Desktop</span>
          </h1>
          <p className="text-lead" style={{ marginBottom: '1.5rem' }}>
            Connect Claude Desktop directly to your desktop files, databases,
            and development tools. Generate pre-formatted JSON snippets or
            browse verified servers.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link href="#top-servers" className="btn btn-primary">
              Browse Compatible Servers
            </Link>
            <Link
              href="/clients/claude-desktop"
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <BookOpen size={16} /> Full Setup Guide
            </Link>
          </div>
        </section>

        {/* Interactive Config Generator */}
        {client && (
          <ClientConfigSection client={client} featuredServers={topServers} />
        )}

        {/* Featured Servers List */}
        <section id="top-servers" style={{ marginBottom: '4rem' }}>
          <h2
            className="text-section"
            style={{
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Sparkles size={20} style={{ color: 'var(--accent-color)' }} />{' '}
            Featured Claude Desktop Servers
          </h2>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {topServers.map((server) => {
              const { displayName, org } = parseServerName(server.name);
              return (
                <li key={server.id}>
                  <Card
                    href={`/mcp/${server.id}`}
                    hoverable
                    className="directory-card-uniform"
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <ServerAvatar
                        name={server.name}
                        logoUrl={server.logoUrl}
                        category={server.category}
                        size={40}
                      />
                      <div
                        className="directory-card-title-block"
                        style={{ marginBottom: 0 }}
                      >
                        <h3
                          className="directory-card-title-text"
                          style={{ fontSize: '1.05rem' }}
                        >
                          {displayName}
                        </h3>
                        {org && (
                          <div className="directory-card-org-text">{org}</div>
                        )}
                      </div>
                    </div>
                    <div className="directory-card-desc-block">
                      <SafeMarkdown
                        content={server.description || ''}
                        isInline
                      />
                    </div>
                    <div
                      className="directory-card-footer"
                      style={{
                        justifyContent: 'space-between',
                        marginTop: 'auto',
                        paddingTop: '0.75rem',
                      }}
                    >
                      <Badge variant="category">{server.category}</Badge>
                      <ServerConfigCopyButton
                        clientSlug="claude-desktop"
                        serverName={server.name}
                      />
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </>
  );
}
