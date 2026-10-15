import type { Metadata } from 'next';
import Link from 'next/link';
import type React from 'react';
import { FeelingLuckyArcade } from '@/components/FeelingLuckyArcade';
import { serializeJsonLd } from '@/lib/jsonLd';

const SITE = 'https://allmcps.com';

export const metadata: Metadata = {
  title: 'Feeling Lucky? Discover Random MCP Servers',
  description:
    'Spin the AllMCPs arcade to discover random and hidden-gem Model Context Protocol (MCP) servers for Claude, Cursor, and other AI agents.',
  alternates: { canonical: `${SITE}/lucky` },
  openGraph: {
    images: [
      {
        url: 'https://allmcps.com/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'AllMCPs Arcade - Feeling Lucky',
      },
    ],
    title: 'Feeling Lucky? Discover Random MCP Servers | AllMCPs Arcade',
    description:
      'Spin the retro 80s AllMCPs Arcade slot machine to discover random, high-quality, and hidden gem MCP servers.',
    url: `${SITE}/lucky`,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Feeling Lucky? Discover Random MCP Servers | AllMCPs Arcade',
    description:
      'Spin the retro 80s AllMCPs Arcade slot machine to discover random MCP servers.',
  },
};

export default function LuckyPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Feeling Lucky? Discover Random MCP Servers — AllMCPs Arcade',
        description:
          'Spin the retro 80s AllMCPs Arcade slot machine to discover random MCP servers.',
        url: `${SITE}/lucky`,
        isPartOf: { '@type': 'WebSite', name: 'AllMCPs', url: SITE },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Feeling Lucky',
            item: `${SITE}/lucky`,
          },
        ],
      },
    ],
  };

  return (
    <main className="tl-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <div className="tl-container lucky-page">
        <nav aria-label="Breadcrumb">
          <ol className="crumbs tl-crumbs">
            <li>
              <Link href="/">Home</Link>
            </li>
            <li aria-current="page">Feeling Lucky</li>
          </ol>
        </nav>

        <header className="lucky-head animate-in">
          <h1 className="tl-hub-title">Feeling lucky?</h1>
          <p className="tl-hub-lead">
            Spin to discover random superpowers, hidden sleeper gems, or roll an
            instant triple MCP stack for your AI agents.
          </p>
        </header>

        <div className="animate-in" style={{ '--i': 1 } as React.CSSProperties}>
          <FeelingLuckyArcade />
        </div>
      </div>
    </main>
  );
}
