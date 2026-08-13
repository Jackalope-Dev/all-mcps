import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Dices } from 'lucide-react';
import { FeelingLuckyArcade } from '@/components/FeelingLuckyArcade';

const SITE = 'https://allmcps.com';

export const metadata: Metadata = {
  title: 'Feeling Lucky? Discover Random MCP Servers — AllMCPs Arcade',
  description:
    'Spin the retro 80s AllMCPs Arcade slot machine to discover random, high-quality, and hidden gem Model Context Protocol (MCP) servers for Claude, Cursor, and AI agents.',
  alternates: { canonical: `${SITE}/lucky` },
  openGraph: {
    images: [{ url: 'https://allmcps.com/opengraph-image', width: 1200, height: 630, alt: 'AllMCPs Arcade - Feeling Lucky' }],
    title: 'Feeling Lucky? Discover Random MCP Servers | AllMCPs Arcade',
    description:
      'Spin the retro 80s AllMCPs Arcade slot machine to discover random, high-quality, and hidden gem MCP servers.',
    url: `${SITE}/lucky`,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Feeling Lucky? Discover Random MCP Servers | AllMCPs Arcade',
    description: 'Spin the retro 80s AllMCPs Arcade slot machine to discover random MCP servers.',
  },
};

export default function LuckyPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: 'Feeling Lucky? Discover Random MCP Servers — AllMCPs Arcade',
        description: 'Spin the retro 80s AllMCPs Arcade slot machine to discover random MCP servers.',
        url: `${SITE}/lucky`,
        isPartOf: { '@type': 'WebSite', name: 'AllMCPs', url: SITE },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Feeling Lucky', item: `${SITE}/lucky` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="container page-shell" style={{ paddingBottom: '4rem', maxWidth: '840px' }}>
        <nav aria-label="Breadcrumb">
          <ol className="breadcrumb" style={{ marginBottom: '1.5rem' }}>
            <li>
              <Link href="/">Home</Link>
            </li>
            <li className="breadcrumb-separator">
              <ChevronRight size={12} />
            </li>
            <li className="breadcrumb-current">Feeling Lucky</li>
          </ol>
        </nav>

        <header style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 className="text-display" style={{ marginBottom: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.65rem' }}>
            Feeling Lucky? <Dices size={38} style={{ color: 'var(--brand-cyan, #00e5ff)', filter: 'drop-shadow(0 0 8px rgba(0,229,255,0.4))' }} />
          </h1>
          <p className="text-lead" style={{ margin: '0 auto', maxWidth: '640px' }}>
            Step into the AllMCPs Arcade! Spin the cyber slot machine to discover random superpowers,
            hidden sleeper gems, or roll instant triple MCP stacks for your AI agents.
          </p>
        </header>

        <FeelingLuckyArcade />
      </main>
    </>
  );
}
