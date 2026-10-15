import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type React from 'react';
import { ClientLogo } from '@/components/ClientLogo';
import { TopicFilter } from '@/components/content/TopicFilter';
import { MCP_CLIENTS } from '@/lib/clients';
import { serializeJsonLd } from '@/lib/jsonLd';

const SITE = 'https://allmcps.com';

const kindId = (kind: string) => kind.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const metadata: Metadata = {
  title: 'How to Install MCP Servers in Every Client',
  description:
    'Step-by-step setup guides for installing MCP servers in Claude Desktop, Claude Code, Cursor, Windsurf, VS Code, and Cline, with config paths and JSON shape.',
  alternates: { canonical: `${SITE}/clients` },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs',
      },
    ],
    title: 'How to Install MCP Servers in Every Client | AllMCPs',
    description:
      'Setup guides for MCP servers in Claude Desktop, Claude Code, Cursor, Windsurf, VS Code, and Cline.',
    url: `${SITE}/clients`,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How to Install MCP Servers in Every Client | AllMCPs',
    description: 'Setup guides for MCP servers across every major client.',
  },
};

export default function ClientsIndexPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'How to Install MCP Servers in Every Client',
        description: 'Setup guides for MCP servers across every major client.',
        url: `${SITE}/clients`,
        isPartOf: { '@type': 'WebSite', name: 'AllMCPs', url: SITE },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: MCP_CLIENTS.length,
          itemListElement: MCP_CLIENTS.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: `How to Install MCP Servers in ${c.name}`,
            url: `${SITE}/clients/${c.slug}`,
          })),
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
            name: 'MCP Clients',
            item: `${SITE}/clients`,
          },
        ],
      },
    ],
  };

  const kinds = Array.from(new Set(MCP_CLIENTS.map((c) => c.badgeText)));
  const topics = kinds.map((k) => ({
    id: kindId(k),
    label: k,
    count: MCP_CLIENTS.filter((c) => c.badgeText === k).length,
  }));

  return (
    <main className="page-shell content-page content-hub">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <div className="page-shell-inner">
        <header className="content-hub-head animate-in">
          <nav aria-label="Breadcrumb">
            <ol className="crumbs">
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <span aria-current="page">MCP Clients</span>
              </li>
            </ol>
          </nav>
          <h1 className="content-hub-title">
            Install MCP Servers in Any Client
          </h1>
          <p className="content-hub-lede">
            Select your preferred AI client below for step-by-step setup guides,
            OS config file paths, interactive JSON generators, and
            troubleshooting tips.
          </p>
        </header>

        <TopicFilter
          topics={topics}
          total={MCP_CLIENTS.length}
          label="Filter clients by type"
        >
          <ul className="cl-hub-grid">
            {MCP_CLIENTS.map((c, i) => (
              <li
                key={c.slug}
                data-topic={kindId(c.badgeText)}
                className="animate-in"
                style={{ '--i': Math.min(i, 8) } as React.CSSProperties}
              >
                <Link href={`/clients/${c.slug}`} className="cl-hub-card">
                  <span className="cl-hub-card-top">
                    <ClientLogo slug={c.slug} name={c.name} size={40} />
                    <span className="cl-hub-kind">{c.badgeText}</span>
                  </span>
                  <h2 className="cl-hub-name">{c.name}</h2>
                  <code className="cl-hub-file">{c.configFilename}</code>
                  <p className="cl-hub-lead">{c.lead}</p>
                  <span className="guides-card-cta">
                    View setup guide <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </TopicFilter>
      </div>
    </main>
  );
}
